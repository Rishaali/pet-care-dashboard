const express = require("express");
const router = express.Router();

const db = require("../database");


// =====================================================
// CREATE / SYNC MEDICATION NOTIFICATIONS
// =====================================================

router.post("/sync", (req, res) => {

    const { pet_id } = req.body;

    if (!pet_id) {
        return res.status(400).json({
            error: "pet_id is required"
        });
    }

    // Get all active medications for this authenticated user's pet
    const sql = `
        SELECT m.*
        FROM medications m
        JOIN pets p ON m.pet_id = p.id
        WHERE m.pet_id = ?
        AND p.user_id = ?
        AND (
            m.start_date IS NULL
            OR date(m.start_date) <= date('now', 'localtime')
        )
        AND (
            m.end_date IS NULL
            OR date(m.end_date) >= date('now', 'localtime')
        )
    `;

    db.all(sql, [pet_id, req.user.id], (err, medications) => {

        if (err) {
            console.error(
                "Error fetching medications:",
                err.message
            );

            return res.status(500).json({
                error: "Failed to check medications"
            });
        }


        const now = new Date();

        const currentDate =
            now.getFullYear() +
            "-" +
            String(now.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(now.getDate()).padStart(2, "0");


        const currentHours =
            String(now.getHours()).padStart(2, "0");

        const currentMinutes =
            String(now.getMinutes()).padStart(2, "0");

        const currentTime =
            `${currentHours}:${currentMinutes}`;


        let completed = 0;


        if (medications.length === 0) {
            return res.json({
                success: true,
                created: 0
            });
        }


        medications.forEach(med => {

            if (!med.reminder_time) {
                completed++;

                if (completed === medications.length) {
                    return res.json({
                        success: true,
                        created: 0
                    });
                }

                return;
            }


            // Convert reminder time to HH:MM
            const reminderTime =
                med.reminder_time.substring(0, 5);


            // Only create notification when
            // scheduled time has arrived.
            if (currentTime < reminderTime) {
                completed++;

                if (completed === medications.length) {
                    return res.json({
                        success: true,
                        created: 0
                    });
                }

                return;
            }


            // Unique key prevents duplicate notifications
            const referenceKey =
                `med_${med.id}_${currentDate}_${reminderTime}`;


            // Check whether notification already exists
            db.get(
                `
                SELECT id
                FROM notifications
                WHERE reference_key = ?
                `,
                [referenceKey],
                (checkErr, existing) => {

                    if (checkErr) {

                        console.error(
                            "Error checking notification:",
                            checkErr.message
                        );

                        completed++;

                        if (completed === medications.length) {
                            return res.json({
                                success: true,
                                created: 0
                            });
                        }

                        return;
                    }


                    // Already created
                    if (existing) {

                        completed++;

                        if (completed === medications.length) {
                            return res.json({
                                success: true,
                                created: 0
                            });
                        }

                        return;
                    }


                    // Create new notification
                    const title =
                        "Medication Reminder";


                    const message =
                        `Your pet needs ${med.medication_name} — ${med.dosage}`;


                    const createdAt =
                        new Date().toISOString();


                    db.run(
                        `
                        INSERT INTO notifications
                        (
                            pet_id,
                            title,
                            message,
                            type,
                            reference_key,
                            created_at,
                            is_read
                        )
                        VALUES (?, ?, ?, ?, ?, ?, 0)
                        `,
                        [
                            pet_id,
                            title,
                            message,
                            "medication",
                            referenceKey,
                            createdAt
                        ],
                        function(insertErr) {

                            if (insertErr) {

                                console.error(
                                    "Error creating notification:",
                                    insertErr.message
                                );

                            } else {

                                console.log(
                                    `Notification created: ${med.medication_name}`
                                );
                            }


                            completed++;


                            if (completed === medications.length) {

                                return res.json({
                                    success: true,
                                    created: 1
                                });
                            }
                        }
                    );
                }
            );
        });
    });
});


// =====================================================
// GET UNREAD NOTIFICATIONS
// =====================================================

router.get("/unread/:petId", (req, res) => {

    const petId = req.params.petId;


    const sql = `
        SELECT n.*
        FROM notifications n
        JOIN pets p ON n.pet_id = p.id
        WHERE n.pet_id = ?
        AND p.user_id = ?
        AND n.is_read = 0
        ORDER BY created_at DESC
    `;


    db.all(sql, [petId, req.user.id], (err, rows) => {

        if (err) {

            console.error(
                "Error fetching unread notifications:",
                err.message
            );

            return res.status(500).json({
                error: "Failed to fetch notifications"
            });
        }


        res.json(rows);
    });
});


// =====================================================
// MARK ALL NOTIFICATIONS AS READ
// =====================================================

router.put("/read/:petId", (req, res) => {

    const petId = req.params.petId;


    const sql = `
        UPDATE notifications
        SET is_read = 1
        WHERE pet_id = ?
        AND pet_id IN (SELECT id FROM pets WHERE user_id = ?)
        AND is_read = 0
    `;


    db.run(sql, [petId, req.user.id], function(err) {

        if (err) {

            console.error(
                "Error marking notifications as read:",
                err.message
            );

            return res.status(500).json({
                error: "Failed to mark notifications as read"
            });
        }


        res.json({
            success: true,
            message: "Notifications marked as read",
            updated: this.changes
        });
    });
});


// =====================================================
// MARK ONE NOTIFICATION AS READ BY REFERENCE KEY
// =====================================================

router.put("/read-reference", (req, res) => {

    const { pet_id, reference_key } = req.body;

    if (!pet_id || !reference_key) {
        return res.status(400).json({
            error: "pet_id and reference_key are required"
        });
    }

    const sql = `
        UPDATE notifications
        SET is_read = 1
        WHERE pet_id = ?
        AND pet_id IN (SELECT id FROM pets WHERE user_id = ?)
        AND reference_key = ?
        AND is_read = 0
    `;

    db.run(sql, [pet_id, req.user.id, reference_key], function(err) {

        if (err) {

            console.error(
                "Error marking notification as read:",
                err.message
            );

            return res.status(500).json({
                error: "Failed to mark notification as read"
            });
        }

        res.json({
            success: true,
            message: "Notification marked as read",
            updated: this.changes
        });
    });
});


module.exports = router;
