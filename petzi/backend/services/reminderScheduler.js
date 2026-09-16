const db = require("../database");
const emailService = require("./emailService");

/**
 * reminderScheduler.js
 * Automatic background scheduler for Petzi Notifications & Reminders.
 * Detects upcoming appointments, medication schedules, vaccines, supplies, and grooming.
 * Features strict deduplication using unique reminder keys, retry resilience, and user preferences.
 */

let schedulerInterval = null;
let isScanRunning = false;

// Helper to format Date into YYYY-MM-DD
function getLocalDateString(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Helper to format Date into HH:MM (24-hr)
function getLocalTimeString(d = new Date()) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

// Helper to convert 12h/24h time string into minutes from midnight
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const cleanStr = timeStr.trim().toUpperCase();
    
    // Check if 12h AM/PM format
    const match12 = cleanStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (match12) {
        let h = parseInt(match12[1], 10);
        const m = parseInt(match12[2], 10);
        const meridian = match12[3];
        if (meridian === "PM" && h < 12) h += 12;
        if (meridian === "AM" && h === 12) h = 0;
        return h * 60 + m;
    }

    // Standard 24h HH:MM format
    const match24 = cleanStr.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
        const h = parseInt(match24[1], 10);
        const m = parseInt(match24[2], 10);
        return h * 60 + m;
    }

    return null;
}

// Helper to check user preferences
function getUserPreferences(userId) {
    return new Promise((resolve) => {
        db.get("SELECT * FROM notification_preferences WHERE user_id = ?", [userId], (err, row) => {
            if (err || !row) {
                // Default settings: all enabled
                resolve({
                    email_enabled: 1,
                    in_app_enabled: 1,
                    appointment_reminders: 1,
                    medication_reminders: 1,
                    vaccine_reminders: 1,
                    timing_preference: "24h,1h"
                });
            } else {
                resolve(row);
            }
        });
    });
}

// Helper to insert in-app notification & optionally dispatch email
async function dispatchNotification({
    userId,
    petId,
    type,
    referenceId,
    reminderKey,
    title,
    message,
    actionUrl,
    userEmail,
    userName,
    details = [],
    actionText = "Open Petzi"
}) {
    // 1. Check if reminder_key already exists to prevent duplicate processing
    const existing = await new Promise((resolve) => {
        db.get("SELECT id, email_status FROM notifications WHERE reminder_key = ?", [reminderKey], (err, row) => {
            if (err) resolve(null);
            else resolve(row);
        });
    });

    if (existing) {
        // Already processed
        return;
    }

    const prefs = await getUserPreferences(userId);

    // 2. Insert In-App Notification if enabled
    let inAppInserted = false;
    let notificationId = null;

    if (prefs.in_app_enabled) {
        const insertSql = `
            INSERT INTO notifications (user_id, pet_id, type, reference_id, reminder_key, title, message, action_url, is_read, email_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `;
        const initialEmailStatus = prefs.email_enabled ? 'pending' : 'skipped';
        const nowIso = new Date().toISOString();

        notificationId = await new Promise((resolve) => {
            db.run(insertSql, [userId, petId || null, type, referenceId || null, reminderKey, title, message, actionUrl || "/dashboard", initialEmailStatus, nowIso], function(err) {
                if (err) {
                    // Ignore UNIQUE constraint collision
                    if (!err.message.includes("UNIQUE")) {
                        console.error("[Scheduler] Error inserting notification:", err.message);
                    }
                    resolve(null);
                } else {
                    resolve(this.lastID);
                }
            });
        });

        if (notificationId) inAppInserted = true;
    }

    // If duplicate prevented at DB level, return
    if (!inAppInserted && prefs.in_app_enabled) {
        return;
    }

    // 3. Send Email Reminder if enabled
    if (prefs.email_enabled && userEmail) {
        try {
            const emailResult = await emailService.sendReminderEmail({
                toEmail: userEmail,
                userName: userName,
                title: title,
                message: message,
                reminderType: type,
                details: details,
                actionUrl: actionUrl,
                actionText: actionText
            });

            if (notificationId) {
                let emailStatus = 'failed';
                if (emailResult.simulated) {
                    emailStatus = 'simulated';
                } else if (emailResult.success) {
                    emailStatus = 'sent';
                }
                const sentAtIso = emailResult.success && !emailResult.simulated ? new Date().toISOString() : null;
                db.run(
                    `UPDATE notifications SET email_status = ?, email_sent_at = ? WHERE id = ?`,
                    [emailStatus, sentAtIso, notificationId]
                );
            }
        } catch (emailErr) {
            console.error("[Scheduler] Email delivery exception:", emailErr.message);
            if (notificationId) {
                db.run("UPDATE notifications SET email_status = 'failed' WHERE id = ?", [notificationId]);
            }
        }
    }
}

/**
 * Resend email for a specific notification
 */
async function resendNotificationEmail(notificationId, userId = null) {
    return new Promise((resolve) => {
        let sql = `
            SELECT n.*, u.name AS user_name, u.email AS user_email, p.name AS pet_name
            FROM notifications n
            JOIN users u ON n.user_id = u.id
            LEFT JOIN pets p ON n.pet_id = p.id
            WHERE n.id = ?
        `;
        const params = [notificationId];
        if (userId) {
            sql += " AND n.user_id = ?";
            params.push(userId);
        }

        db.get(sql, params, async (err, notif) => {
            if (err) {
                return resolve({ success: false, error: "Database error querying notification" });
            }
            if (!notif) {
                return resolve({ success: false, error: "Notification not found or access denied" });
            }
            if (!notif.user_email) {
                return resolve({ success: false, error: "User has no registered email" });
            }

            const details = [];
            if (notif.pet_name) {
                details.push({ label: "Pet", value: notif.pet_name });
            }
            details.push({ label: "Notification Type", value: notif.type.toUpperCase() });

            try {
                const emailResult = await emailService.sendReminderEmail({
                    toEmail: notif.user_email,
                    userName: notif.user_name,
                    title: notif.title,
                    message: notif.message,
                    reminderType: notif.type,
                    details: details,
                    actionUrl: notif.action_url || "/dashboard",
                    actionText: "View in Petzi"
                });

                let emailStatus = 'failed';
                if (emailResult.simulated) {
                    emailStatus = 'simulated';
                } else if (emailResult.success) {
                    emailStatus = 'sent';
                }
                const sentAtIso = emailResult.success && !emailResult.simulated ? new Date().toISOString() : null;

                db.run(
                    `UPDATE notifications SET email_status = ?, email_sent_at = ? WHERE id = ?`,
                    [emailStatus, sentAtIso, notificationId],
                    (updErr) => {
                        if (updErr) console.error("[Scheduler] Error updating notification status:", updErr.message);
                    }
                );

                resolve(emailResult);
            } catch (err) {
                resolve({ success: false, error: err.message });
            }
        });
    });
}

/**
 * Retry all failed or pending emails for a user
 */
async function retryFailedNotifications(userId) {
    return new Promise((resolve) => {
        const sql = `
            SELECT id FROM notifications
            WHERE user_id = ? AND (email_status = 'failed' OR email_status = 'pending')
            ORDER BY created_at DESC LIMIT 20
        `;
        db.all(sql, [userId], async (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return resolve({ total: 0, sent: 0, failed: 0 });
            }

            let sentCount = 0;
            let failedCount = 0;

            for (const row of rows) {
                const res = await resendNotificationEmail(row.id, userId);
                if (res && res.success) {
                    sentCount++;
                } else {
                    failedCount++;
                }
            }

            resolve({ total: rows.length, sent: sentCount, failed: failedCount });
        });
    });
}

/**
 * Check upcoming appointments
 */
async function processAppointmentReminders() {
    return new Promise((resolve) => {
        const now = new Date();
        const todayStr = getLocalDateString(now);
        
        // Calculate tomorrow's date
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowStr = getLocalDateString(tomorrow);

        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const sql = `
            SELECT 
                a.id AS appointment_id,
                a.pet_id,
                a.appointment_date,
                a.appointment_time,
                a.disease,
                a.notes,
                a.status,
                p.name AS pet_name,
                p.user_id,
                u.name AS user_name,
                u.email AS user_email,
                v.name AS vet_name,
                v.specialization AS vet_specialization,
                c.name AS clinic_name,
                c.address AS clinic_address,
                c.city AS clinic_city
            FROM appointments a
            JOIN pets p ON a.pet_id = p.id
            JOIN users u ON p.user_id = u.id
            JOIN vets v ON a.vet_id = v.id
            JOIN clinics c ON a.clinic_id = c.id
            WHERE (a.status IS NULL OR a.status != 'Cancelled')
              AND (a.appointment_date = ? OR a.appointment_date = ?)
        `;

        db.all(sql, [todayStr, tomorrowStr], async (err, appointments) => {
            if (err) {
                console.error("[Scheduler] Error querying appointments:", err.message);
                return resolve();
            }

            if (!appointments || appointments.length === 0) return resolve();

            for (const appt of appointments) {
                const apptMinutes = parseTimeToMinutes(appt.appointment_time);
                if (apptMinutes === null) continue;

                // Case 1: 24-Hour Reminder (for tomorrow)
                if (appt.appointment_date === tomorrowStr) {
                    const reminderKey = `appt_${appt.appointment_id}_24h_${appt.appointment_date}`;
                    await dispatchNotification({
                        userId: appt.user_id,
                        petId: appt.pet_id,
                        type: 'appointment',
                        referenceId: appt.appointment_id,
                        reminderKey: reminderKey,
                        title: `Appointment Reminder: Tomorrow at ${appt.appointment_time}`,
                        message: `Reminder that ${appt.pet_name} has a veterinary appointment tomorrow with ${appt.vet_name} (${appt.vet_specialization || 'Vet'}) at ${appt.clinic_name}.`,
                        actionUrl: `/appointments.html`,
                        userEmail: appt.user_email,
                        userName: appt.user_name,
                        details: [
                            { label: "Pet", value: appt.pet_name },
                            { label: "Date & Time", value: `${appt.appointment_date} at ${appt.appointment_time}` },
                            { label: "Doctor", value: appt.vet_name },
                            { label: "Clinic", value: `${appt.clinic_name}, ${appt.clinic_address || ''} ${appt.clinic_city || ''}` },
                            { label: "Reason / Note", value: appt.disease || "General Consultation" }
                        ],
                        actionText: "View Appointment Details"
                    });
                }

                // Case 2: Today's reminders (1 hour before, 30 min before, or at start time)
                if (appt.appointment_date === todayStr) {
                    const diffMinutes = apptMinutes - currentTotalMinutes;

                    // 1 hour before reminder (window between 45 and 75 minutes before)
                    if (diffMinutes >= 45 && diffMinutes <= 75) {
                        const reminderKey = `appt_${appt.appointment_id}_1h_${appt.appointment_date}`;
                        await dispatchNotification({
                            userId: appt.user_id,
                            petId: appt.pet_id,
                            type: 'appointment',
                            referenceId: appt.appointment_id,
                            reminderKey: reminderKey,
                            title: `Upcoming Appointment in 1 Hour: ${appt.pet_name}`,
                            message: `${appt.pet_name}'s appointment with ${appt.vet_name} is in 1 hour at ${appt.appointment_time}. Please prepare to head to ${appt.clinic_name}.`,
                            actionUrl: `/appointments.html`,
                            userEmail: appt.user_email,
                            userName: appt.user_name,
                            details: [
                                { label: "Pet", value: appt.pet_name },
                                { label: "Time", value: `Today at ${appt.appointment_time}` },
                                { label: "Doctor", value: appt.vet_name },
                                { label: "Clinic", value: `${appt.clinic_name}, ${appt.clinic_address || ''}` }
                            ],
                            actionText: "View Appointments"
                        });
                    }

                    // 30 mins before reminder
                    if (diffMinutes >= 20 && diffMinutes <= 35) {
                        const reminderKey = `appt_${appt.appointment_id}_30m_${appt.appointment_date}`;
                        await dispatchNotification({
                            userId: appt.user_id,
                            petId: appt.pet_id,
                            type: 'appointment',
                            referenceId: appt.appointment_id,
                            reminderKey: reminderKey,
                            title: `Appointment starting in 30 minutes!`,
                            message: `Appointment for ${appt.pet_name} at ${appt.clinic_name} starts at ${appt.appointment_time}.`,
                            actionUrl: `/appointments.html`,
                            userEmail: appt.user_email,
                            userName: appt.user_name,
                            details: [
                                { label: "Pet", value: appt.pet_name },
                                { label: "Scheduled Time", value: appt.appointment_time },
                                { label: "Location", value: appt.clinic_name }
                            ]
                        });
                    }

                    // Due now / Today's general reminder
                    if (diffMinutes > 0 && diffMinutes <= 15) {
                        const reminderKey = `appt_${appt.appointment_id}_now_${appt.appointment_date}`;
                        await dispatchNotification({
                            userId: appt.user_id,
                            petId: appt.pet_id,
                            type: 'appointment',
                            referenceId: appt.appointment_id,
                            reminderKey: reminderKey,
                            title: `Appointment is starting now: ${appt.appointment_time}`,
                            message: `${appt.pet_name}'s appointment with ${appt.vet_name} at ${appt.clinic_name} is scheduled for now.`,
                            actionUrl: `/appointments.html`,
                            userEmail: appt.user_email,
                            userName: appt.user_name,
                            details: [
                                { label: "Pet", value: appt.pet_name },
                                { label: "Doctor", value: appt.vet_name },
                                { label: "Clinic", value: appt.clinic_name }
                            ]
                        });
                    }
                }
            }

            resolve();
        });
    });
}

/**
 * Check active medication schedules
 */
async function processMedicationReminders() {
    return new Promise((resolve) => {
        const now = new Date();
        const todayStr = getLocalDateString(now);
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const sql = `
            SELECT 
                m.*,
                p.name AS pet_name,
                p.user_id,
                u.name AS user_name,
                u.email AS user_email
            FROM medications m
            JOIN pets p ON m.pet_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE (m.start_date IS NULL OR m.start_date <= ?)
              AND (m.end_date IS NULL OR m.end_date >= ?)
        `;

        db.all(sql, [todayStr, todayStr], async (err, medications) => {
            if (err) {
                console.error("[Scheduler] Error querying medications:", err.message);
                return resolve();
            }

            if (!medications || medications.length === 0) return resolve();

            for (const med of medications) {
                const medMinutes = parseTimeToMinutes(med.reminder_time);
                if (medMinutes === null) continue;

                // Match if current time is within +/- 5 minutes of medication reminder time
                const diff = Math.abs(currentTotalMinutes - medMinutes);
                if (diff <= 5) {
                    const reminderKey = `med_${med.id}_${todayStr}_${med.reminder_time.replace(/\s+/g, '_')}`;
                    await dispatchNotification({
                        userId: med.user_id,
                        petId: med.pet_id,
                        type: 'medication',
                        referenceId: med.id,
                        reminderKey: reminderKey,
                        title: `Medication Due: ${med.medication_name} for ${med.pet_name}`,
                        message: `Time to give ${med.pet_name} their scheduled dose of ${med.medication_name} (${med.dosage}). ${med.notes ? 'Note: ' + med.notes : ''}`,
                        actionUrl: `/index.html#medications`,
                        userEmail: med.user_email,
                        userName: med.user_name,
                        details: [
                            { label: "Pet", value: med.pet_name },
                            { label: "Medication", value: med.medication_name },
                            { label: "Dosage", value: med.dosage },
                            { label: "Frequency", value: med.frequency || "Daily" },
                            { label: "Instructions", value: med.notes || "None" }
                        ],
                        actionText: "Open Medication Log"
                    });
                }
            }

            resolve();
        });
    });
}

/**
 * Check vaccination due dates
 */
async function processVaccineReminders() {
    return new Promise((resolve) => {
        const now = new Date();
        const todayStr = getLocalDateString(now);

        const sql = `
            SELECT 
                v.*,
                p.name AS pet_name,
                p.user_id,
                u.name AS user_name,
                u.email AS user_email
            FROM vaccinations v
            JOIN pets p ON v.pet_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE v.next_due_date IS NOT NULL AND v.next_due_date != ''
        `;

        db.all(sql, [], async (err, vaccines) => {
            if (err) {
                console.error("[Scheduler] Error querying vaccinations:", err.message);
                return resolve();
            }

            if (!vaccines || vaccines.length === 0) return resolve();

            for (const vax of vaccines) {
                const dueDate = new Date(vax.next_due_date);
                if (isNaN(dueDate.getTime())) continue;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);

                const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                // 3-day reminder
                if (diffDays === 3) {
                    const reminderKey = `vax_${vax.id}_3d_${vax.next_due_date}`;
                    await dispatchNotification({
                        userId: vax.user_id,
                        petId: vax.pet_id,
                        type: 'vaccination',
                        referenceId: vax.id,
                        reminderKey: reminderKey,
                        title: `Vaccination Due in 3 Days: ${vax.vaccine_name}`,
                        message: `${vax.pet_name}'s ${vax.vaccine_name} vaccination is due on ${vax.next_due_date}. Please schedule an appointment if needed.`,
                        actionUrl: `/index.html#vaccines`,
                        userEmail: vax.user_email,
                        userName: vax.user_name,
                        details: [
                            { label: "Pet", value: vax.pet_name },
                            { label: "Vaccine", value: vax.vaccine_name },
                            { label: "Due Date", value: vax.next_due_date },
                            { label: "Veterinarian", value: vax.veterinarian || "Not specified" }
                        ],
                        actionText: "View Vaccine Schedule"
                    });
                }

                // 1-day reminder
                if (diffDays === 1) {
                    const reminderKey = `vax_${vax.id}_1d_${vax.next_due_date}`;
                    await dispatchNotification({
                        userId: vax.user_id,
                        petId: vax.pet_id,
                        type: 'vaccination',
                        referenceId: vax.id,
                        reminderKey: reminderKey,
                        title: `Vaccination Due Tomorrow: ${vax.vaccine_name}`,
                        message: `${vax.pet_name}'s ${vax.vaccine_name} vaccination is due tomorrow (${vax.next_due_date}).`,
                        actionUrl: `/index.html#vaccines`,
                        userEmail: vax.user_email,
                        userName: vax.user_name,
                        details: [
                            { label: "Pet", value: vax.pet_name },
                            { label: "Vaccine", value: vax.vaccine_name },
                            { label: "Due Date", value: vax.next_due_date }
                        ],
                        actionText: "View Vaccine Schedule"
                    });
                }

                // Due today reminder
                if (diffDays === 0) {
                    const reminderKey = `vax_${vax.id}_due_${vax.next_due_date}`;
                    await dispatchNotification({
                        userId: vax.user_id,
                        petId: vax.pet_id,
                        type: 'vaccination',
                        referenceId: vax.id,
                        reminderKey: reminderKey,
                        title: `Vaccination Due Today: ${vax.vaccine_name}`,
                        message: `${vax.pet_name}'s vaccination for ${vax.vaccine_name} is due today (${vax.next_due_date}).`,
                        actionUrl: `/index.html#vaccines`,
                        userEmail: vax.user_email,
                        userName: vax.user_name,
                        details: [
                            { label: "Pet", value: vax.pet_name },
                            { label: "Vaccine", value: vax.vaccine_name },
                            { label: "Due Date", value: vax.next_due_date }
                        ],
                        actionText: "View Vaccine Schedule"
                    });
                }
            }

            resolve();
        });
    });
}

/**
 * Check grooming due dates
 */
async function processGroomingReminders() {
    return new Promise((resolve) => {
        const now = new Date();
        const todayStr = getLocalDateString(now);

        const sql = `
            SELECT 
                g.*,
                p.name AS pet_name,
                p.user_id,
                u.name AS user_name,
                u.email AS user_email
            FROM grooming g
            JOIN pets p ON g.pet_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE g.next_due_date = ?
        `;

        db.all(sql, [todayStr], async (err, list) => {
            if (err || !list || list.length === 0) return resolve();

            for (const item of list) {
                const reminderKey = `groom_${item.id}_${todayStr}`;
                await dispatchNotification({
                    userId: item.user_id,
                    petId: item.pet_id,
                    type: 'grooming',
                    referenceId: item.id,
                    reminderKey: reminderKey,
                    title: `Grooming Reminder: ${item.grooming_type} for ${item.pet_name}`,
                    message: `${item.pet_name} is scheduled for ${item.grooming_type} today.`,
                    actionUrl: `/index.html#grooming`,
                    userEmail: item.user_email,
                    userName: item.user_name,
                    details: [
                        { label: "Pet", value: item.pet_name },
                        { label: "Service", value: item.grooming_type },
                        { label: "Date", value: todayStr },
                        { label: "Notes", value: item.notes || "None" }
                    ],
                    actionText: "View Grooming Schedule"
                });
            }

            resolve();
        });
    });
}

/**
 * Master scanner function called on interval
 */
async function runReminderScan() {
    if (isScanRunning) return;
    isScanRunning = true;

    try {
        await processAppointmentReminders();
        await processMedicationReminders();
        await processVaccineReminders();
        await processGroomingReminders();
    } catch (err) {
        console.error("[Scheduler] Error in reminder scan cycle:", err.message);
    } finally {
        isScanRunning = false;
    }
}

/**
 * Start the background scheduler
 */
function startScheduler(intervalMs = 30000) {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
    }

    console.log(`[Scheduler] Automatic Reminder Service started (checking every ${intervalMs / 1000}s)`);
    // Run an initial scan immediately
    setTimeout(() => {
        runReminderScan();
    }, 2000);

    // Run periodically
    schedulerInterval = setInterval(runReminderScan, intervalMs);
}

/**
 * Stop the background scheduler
 */
function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log("[Scheduler] Automatic Reminder Service stopped");
    }
}

module.exports = {
    startScheduler,
    stopScheduler,
    runReminderScan,
    dispatchNotification,
    resendNotificationEmail,
    retryFailedNotifications
};
