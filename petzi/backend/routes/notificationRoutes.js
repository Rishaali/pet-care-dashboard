const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");
const emailService = require("../services/emailService");
const { resendNotificationEmail, retryFailedNotifications } = require("../services/reminderScheduler");

// GET /api/notifications/email-config - Retrieve current email server config
router.get("/email-config", authMiddleware, (req, res) => {
    try {
        const config = emailService.getEmailConfig();
        res.status(200).json(config);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch email config", details: err.message });
    }
});

// PUT /api/notifications/email-config - Update email server config dynamically
router.put("/email-config", authMiddleware, async (req, res) => {
    const { mode, email, app_password } = req.body;

    try {
        const result = await emailService.updateEmailConfig({
            mode: mode || "gmail",
            email: email,
            appPassword: app_password
        });
        res.status(200).json({
            success: result.configured,
            status: result.status,
            message: result.message,
            hint: result.hint,
            config: emailService.getEmailConfig()
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to update email config", details: err.message });
    }
});

// GET /api/notifications/smtp-status - Check current email server connection status
router.get("/smtp-status", authMiddleware, async (req, res) => {
    try {
        const status = await emailService.verifySmtpConnection();
        res.status(200).json(status);
    } catch (err) {
        res.status(500).json({ error: "Failed to check SMTP status", details: err.message });
    }
});

// POST /api/notifications/test-email - Send a test email to the authenticated user
router.post("/test-email", authMiddleware, async (req, res) => {
    const userId = req.user.id;

    db.get("SELECT name, email FROM users WHERE id = ?", [userId], async (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!user.email) {
            return res.status(400).json({ error: "User has no registered email address" });
        }

        try {
            const result = await emailService.sendReminderEmail({
                toEmail: user.email,
                userName: user.name,
                title: "🐾 Petzi Email Notification Test",
                message: "Great news! Your Petzi email notifications and reminder system is active and delivering properly.",
                reminderType: "test",
                details: [
                    { label: "Recipient", value: `${user.name} (${user.email})` },
                    { label: "Delivery Status", value: "Verified & Active" },
                    { label: "Test Time", value: new Date().toLocaleString() }
                ],
                actionUrl: "/dashboard",
                actionText: "Go to Petzi Dashboard"
            });

            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: result.isTestMailbox 
                        ? `Test email generated via Ethereal Test Mailbox!` 
                        : `Test email sent successfully to ${user.email}!`,
                    previewUrl: result.previewUrl || null,
                    isTestMailbox: Boolean(result.isTestMailbox)
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error || "Failed to deliver test email",
                    hint: result.hint || "Please verify your email credentials in Notification Settings."
                });
            }
        } catch (sendErr) {
            res.status(500).json({ error: "Exception sending test email", details: sendErr.message });
        }
    });
});

// POST /api/notifications/:id/resend - Resend email for a specific notification
router.post("/:id/resend", authMiddleware, async (req, res) => {
    const notificationId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await resendNotificationEmail(notificationId, userId);
        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.isTestMailbox ? "Email sent to Test Mailbox!" : "Email resent successfully!",
                previewUrl: result.previewUrl || null,
                isTestMailbox: Boolean(result.isTestMailbox)
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || "Failed to resend email",
                hint: result.hint || "Please check your email credentials in Notification Settings."
            });
        }
    } catch (err) {
        res.status(500).json({ error: "Exception resending email", details: err.message });
    }
});

// POST /api/notifications/retry-failed - Retry all failed reminder emails for current user
router.post("/retry-failed", authMiddleware, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await retryFailedNotifications(userId);
        res.status(200).json({
            success: true,
            total: result.total,
            sent: result.sent,
            failed: result.failed,
            message: `Processed ${result.total} reminders: ${result.sent} sent, ${result.failed} failed.`
        });
    } catch (err) {
        res.status(500).json({ error: "Exception retrying failed emails", details: err.message });
    }
});

// GET /api/notifications - Retrieve notifications for current user
router.get("/", authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { unread_only, limit = 50, offset = 0 } = req.query;

    let sql = `
        SELECT 
            n.*,
            p.name AS pet_name,
            p.species AS pet_species
        FROM notifications n
        LEFT JOIN pets p ON n.pet_id = p.id
        WHERE n.user_id = ?
    `;
    const params = [userId];

    if (unread_only === "true" || unread_only === "1") {
        sql += " AND n.is_read = 0";
    }

    sql += " ORDER BY n.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("[Notifications API] Error fetching notifications:", err.message);
            return res.status(500).json({ error: "Failed to fetch notifications" });
        }

        const formattedRows = (rows || []).map(row => {
            let createdAt = row.created_at;
            if (createdAt && typeof createdAt === 'string' && !createdAt.includes('T') && !createdAt.endsWith('Z')) {
                createdAt = createdAt.replace(' ', 'T') + 'Z';
            }
            let emailSentAt = row.email_sent_at;
            if (emailSentAt && typeof emailSentAt === 'string' && !emailSentAt.includes('T') && !emailSentAt.endsWith('Z')) {
                emailSentAt = emailSentAt.replace(' ', 'T') + 'Z';
            }
            return {
                ...row,
                created_at: createdAt,
                email_sent_at: emailSentAt
            };
        });

        db.get("SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0", [userId], (countErr, countRow) => {
            const unreadCount = countRow ? countRow.unread_count : 0;
            res.status(200).json({
                notifications: formattedRows,
                unread_count: unreadCount
            });
        });
    });
});

// GET /api/notifications/unread-count - Lightweight endpoint for bell badge polling
router.get("/unread-count", authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.get("SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0", [userId], (err, row) => {
        if (err) {
            console.error("[Notifications API] Error fetching unread count:", err.message);
            return res.status(500).json({ error: "Failed to fetch count" });
        }
        res.status(200).json({ unread_count: row ? row.unread_count : 0 });
    });
});

// PATCH /api/notifications/:id/read - Mark a specific notification as read
router.patch("/:id/read", authMiddleware, (req, res) => {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const sql = "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?";
    db.run(sql, [notificationId, userId], function(err) {
        if (err) {
            console.error("[Notifications API] Error marking read:", err.message);
            return res.status(500).json({ error: "Failed to update notification" });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Notification not found or not authorized" });
        }
        res.status(200).json({ message: "Notification marked as read", id: notificationId });
    });
});

// PATCH /api/notifications/read-all - Mark all notifications as read for current user
router.patch("/read-all", authMiddleware, (req, res) => {
    const userId = req.user.id;

    const sql = "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0";
    db.run(sql, [userId], function(err) {
        if (err) {
            console.error("[Notifications API] Error marking all read:", err.message);
            return res.status(500).json({ error: "Failed to update notifications" });
        }
        res.status(200).json({ message: "All notifications marked as read", updated_count: this.changes });
    });
});

// DELETE /api/notifications/:id - Delete a notification
router.delete("/:id", authMiddleware, (req, res) => {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const sql = "DELETE FROM notifications WHERE id = ? AND user_id = ?";
    db.run(sql, [notificationId, userId], function(err) {
        if (err) {
            console.error("[Notifications API] Error deleting notification:", err.message);
            return res.status(500).json({ error: "Failed to delete notification" });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Notification not found or not authorized" });
        }
        res.status(200).json({ message: "Notification deleted successfully" });
    });
});

// GET /api/notifications/preferences - Get notification preferences
router.get("/preferences", authMiddleware, (req, res) => {
    const userId = req.user.id;

    db.get("SELECT * FROM notification_preferences WHERE user_id = ?", [userId], (err, row) => {
        if (err) {
            console.error("[Notifications API] Error fetching preferences:", err.message);
            return res.status(500).json({ error: "Failed to fetch preferences" });
        }

        if (!row) {
            return res.status(200).json({
                user_id: userId,
                email_enabled: 1,
                in_app_enabled: 1,
                appointment_reminders: 1,
                medication_reminders: 1,
                vaccine_reminders: 1,
                timing_preference: "24h,1h"
            });
        }

        res.status(200).json(row);
    });
});

// PUT /api/notifications/preferences - Save notification preferences
router.put("/preferences", authMiddleware, (req, res) => {
    const userId = req.user.id;
    const {
        email_enabled = 1,
        in_app_enabled = 1,
        appointment_reminders = 1,
        medication_reminders = 1,
        vaccine_reminders = 1,
        timing_preference = "24h,1h"
    } = req.body;

    const sql = `
        INSERT INTO notification_preferences (user_id, email_enabled, in_app_enabled, appointment_reminders, medication_reminders, vaccine_reminders, timing_preference, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            email_enabled = excluded.email_enabled,
            in_app_enabled = excluded.in_app_enabled,
            appointment_reminders = excluded.appointment_reminders,
            medication_reminders = excluded.medication_reminders,
            vaccine_reminders = excluded.vaccine_reminders,
            timing_preference = excluded.timing_preference,
            updated_at = CURRENT_TIMESTAMP
    `;

    db.run(sql, [
        userId,
        email_enabled ? 1 : 0,
        in_app_enabled ? 1 : 0,
        appointment_reminders ? 1 : 0,
        medication_reminders ? 1 : 0,
        vaccine_reminders ? 1 : 0,
        timing_preference
    ], function(err) {
        if (err) {
            console.error("[Notifications API] Error saving preferences:", err.message);
            return res.status(500).json({ error: "Failed to update preferences" });
        }
        res.status(200).json({ message: "Notification preferences saved successfully" });
    });
});

module.exports = router;
