const express = require("express");
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");
const audioUpload = require("../middleware/audioUploadMiddleware");

const medicationRouter = express.Router();
const logRouter = express.Router();

// ==========================================
// MEDICATIONS ROUTER (mounted at /api/medications)
// ==========================================

// GET /api/medications - Retrieve medication schedules (optionally filter by pet_id)
medicationRouter.get("/", authMiddleware, (req, res) => {
    const petId = req.query.pet_id;
    let sql = `
        SELECT medications.*, 
               pets.name AS pet_name, 
               pets.species AS pet_species, 
               pets.breed AS pet_breed,
               pets.owner_name AS pet_owner_name
        FROM medications 
        JOIN pets ON medications.pet_id = pets.id 
        WHERE pets.user_id = ?
    `;
    let params = [req.user.id];

    if (petId) {
        sql += " AND medications.pet_id = ?";
        params.push(petId);
    }
    sql += " ORDER BY medications.id DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching medications:", err.message);
            return res.status(500).json({ error: "Failed to fetch medications" });
        }
        res.status(200).json(rows);
    });
});

// POST /api/medications - Create a new medication schedule
medicationRouter.post("/", authMiddleware, audioUpload.single("audio_file"), (req, res) => {
    const { pet_id, medication_name, dosage, frequency, start_date, end_date, reminder_time, notes, sound_type } = req.body;

    // Validation
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id is required" });
    }
    if (!medication_name || medication_name.trim() === "") {
        return res.status(400).json({ error: "Medication name is required" });
    }
    if (!dosage || dosage.trim() === "") {
        return res.status(400).json({ error: "Dosage is required" });
    }
    if (!reminder_time || reminder_time.trim() === "") {
        return res.status(400).json({ error: "Reminder time is required" });
    }

    const soundType = (sound_type || "DEFAULT").toUpperCase();
    let customSound = null;

    if (soundType === "CUSTOM") {
        if (req.file) {
            customSound = `/uploads/sounds/${req.file.filename}`;
        } else if (req.body.custom_sound) {
            customSound = req.body.custom_sound;
        } else {
            return res.status(400).json({ error: "Please select an audio file for the custom reminder sound." });
        }
    }

    // Check dates
    if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (end < start) {
            return res.status(400).json({ error: "End date cannot be before start date" });
        }
    }

    // Verify pet exists
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [pet_id], (err, row) => {
        if (err) {
            console.error("Error verifying pet existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const sql = `
            INSERT INTO medications (pet_id, medication_name, dosage, frequency, start_date, end_date, reminder_time, notes, sound_type, custom_sound)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            pet_id,
            medication_name.trim(),
            dosage.trim(),
            frequency ? frequency.trim() : null,
            start_date || null,
            end_date || null,
            reminder_time.trim(),
            notes ? notes.trim() : null,
            soundType,
            customSound
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error creating medication:", err.message);
                return res.status(500).json({ error: "Failed to create medication schedule" });
            }
            res.status(201).json({
                message: "Medication schedule created successfully",
                id: this.lastID,
                pet_id: pet_id,
                medication_name: medication_name.trim(),
                sound_type: soundType,
                custom_sound: customSound
            });
        });
    });
});

// PUT /api/medications/:id - Update an existing medication schedule
medicationRouter.put("/:id", authMiddleware, audioUpload.single("audio_file"), (req, res) => {
    const id = req.params.id;
    const { pet_id, medication_name, dosage, frequency, start_date, end_date, reminder_time, notes, sound_type } = req.body;

    if (!pet_id) {
        return res.status(400).json({ error: "pet_id is required" });
    }
    if (!medication_name || medication_name.trim() === "") {
        return res.status(400).json({ error: "Medication name is required" });
    }
    if (!dosage || dosage.trim() === "") {
        return res.status(400).json({ error: "Dosage is required" });
    }
    if (!reminder_time || reminder_time.trim() === "") {
        return res.status(400).json({ error: "Reminder time is required" });
    }

    const soundType = (sound_type || "DEFAULT").toUpperCase();

    if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (end < start) {
            return res.status(400).json({ error: "End date cannot be before start date" });
        }
    }

    // Verify new pet belongs to user
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [pet_id], (err, petRow) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!petRow || String(petRow.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied to pet" });

        // Verify medication belongs to user and retrieve existing record
        const checkSql = `
            SELECT medications.* 
            FROM medications 
            JOIN pets ON medications.pet_id = pets.id 
            WHERE medications.id = ? AND pets.user_id = ?
        `;
        db.get(checkSql, [id, req.user.id], (err, existingMed) => {
            if (err) {
                console.error("Error checking medication existence:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            if (!existingMed) {
                return res.status(404).json({ error: "Medication schedule not found or access denied" });
            }

            let customSound = null;
            if (soundType === "CUSTOM") {
                if (req.file) {
                    customSound = `/uploads/sounds/${req.file.filename}`;
                } else if (req.body.custom_sound) {
                    customSound = req.body.custom_sound;
                } else if (existingMed.custom_sound) {
                    customSound = existingMed.custom_sound;
                } else {
                    return res.status(400).json({ error: "Please select an audio file for the custom reminder sound." });
                }
            }

            const sql = `
                UPDATE medications
                SET pet_id = ?, medication_name = ?, dosage = ?, frequency = ?, start_date = ?, end_date = ?, reminder_time = ?, notes = ?, sound_type = ?, custom_sound = ?
                WHERE id = ?
            `;
            const params = [
                pet_id,
                medication_name.trim(),
                dosage.trim(),
                frequency ? frequency.trim() : null,
                start_date || null,
                end_date || null,
                reminder_time.trim(),
                notes ? notes.trim() : null,
                soundType,
                customSound,
                id
            ];

            db.run(sql, params, function(err) {
                if (err) {
                    console.error("Error updating medication:", err.message);
                    return res.status(500).json({ error: "Failed to update medication schedule" });
                }
                res.status(200).json({
                    message: "Medication schedule updated successfully",
                    sound_type: soundType,
                    custom_sound: customSound
                });
            });
        });
    });
});

// PATCH /api/medications/:id/status - Update reminder status (PENDING, TRIGGERED, SNOOZED, COMPLETED) and timestamps
medicationRouter.patch("/:id/status", authMiddleware, (req, res) => {
    const id = req.params.id;
    const { status, snoozed_until, completed_at } = req.body;

    const checkSql = `
        SELECT medications.id 
        FROM medications 
        JOIN pets ON medications.pet_id = pets.id 
        WHERE medications.id = ? AND pets.user_id = ?
    `;
    db.get(checkSql, [id, req.user.id], (err, row) => {
        if (err) {
            console.error("Error checking medication existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Medication schedule not found or access denied" });
        }

        const sql = `
            UPDATE medications
            SET status = COALESCE(?, status),
                snoozed_until = ?,
                completed_at = ?
            WHERE id = ?
        `;
        db.run(sql, [status || null, snoozed_until || null, completed_at || null, id], function(err) {
            if (err) {
                console.error("Error updating medication status:", err.message);
                return res.status(500).json({ error: "Failed to update medication status" });
            }
            res.status(200).json({
                message: "Medication status updated successfully",
                id: id,
                status: status,
                snoozed_until: snoozed_until,
                completed_at: completed_at
            });
        });
    });
});

// DELETE /api/medications/:id - Delete a medication schedule
medicationRouter.delete("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;

    const checkSql = `
        SELECT medications.id 
        FROM medications 
        JOIN pets ON medications.pet_id = pets.id 
        WHERE medications.id = ? AND pets.user_id = ?
    `;
    db.get(checkSql, [id, req.user.id], (err, row) => {
        if (err) {
            console.error("Error checking medication existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Medication schedule not found or access denied" });
        }

        db.run("DELETE FROM medications WHERE id = ?", [id], (err) => {
            if (err) {
                console.error("Error deleting medication:", err.message);
                return res.status(500).json({ error: "Failed to delete medication schedule" });
            }
            res.status(200).json({
                message: "Medication schedule deleted successfully"
            });
        });
    });
});

// ==========================================
// MEDICATION LOGS ROUTER (mounted at /api/medication-logs)
// ==========================================

// GET /api/medication-logs - Retrieve medication logs (optionally filter by pet_id)
logRouter.get("/", authMiddleware, (req, res) => {
    const petId = req.query.pet_id;
    let sql = `
        SELECT ml.*, m.medication_name, m.dosage, p.name as pet_name 
        FROM medication_logs ml
        JOIN medications m ON ml.medication_id = m.id
        JOIN pets p ON ml.pet_id = p.id
        WHERE p.user_id = ?
    `;
    let params = [req.user.id];

    if (petId) {
        sql += " AND ml.pet_id = ?";
        params.push(petId);
    }
    sql += " ORDER BY ml.id DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching medication logs:", err.message);
            return res.status(500).json({ error: "Failed to fetch medication logs" });
        }
        res.status(200).json(rows);
    });
});

// POST /api/medication-logs - Log a medication occurrence/status
logRouter.post("/", authMiddleware, (req, res) => {
    const { medication_id, pet_id, scheduled_time, given_time, status } = req.body;

    // Validation
    if (!medication_id) {
        return res.status(400).json({ error: "medication_id is required" });
    }
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id is required" });
    }
    if (!status || status.trim() === "") {
        return res.status(400).json({ error: "status is required" });
    }

    // Verify pet and medication exist and ownership
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [pet_id], (err, petRow) => {
        if (err) {
            console.error("Error verifying pet existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!petRow) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(petRow.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        db.get("SELECT id FROM medications WHERE id = ?", [medication_id], (err, medRow) => {
            if (err) {
                console.error("Error verifying medication existence:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            if (!medRow) {
                return res.status(404).json({ error: "Medication schedule not found" });
            }

            const formattedScheduled = scheduled_time ? new Date(scheduled_time).toISOString() : new Date().toISOString();
            const formattedGiven = given_time ? new Date(given_time).toISOString() : (status === "given" ? new Date().toISOString() : null);

            const sql = `
                INSERT INTO medication_logs (medication_id, pet_id, scheduled_time, given_time, status)
                VALUES (?, ?, ?, ?, ?)
            `;
            const params = [
                medication_id,
                pet_id,
                formattedScheduled,
                formattedGiven,
                status.trim()
            ];

            db.run(sql, params, function(err) {
                if (err) {
                    console.error("Error logging medication occurrence:", err.message);
                    return res.status(500).json({ error: "Failed to log medication occurrence" });
                }
                res.status(201).json({
                    message: "Medication log recorded successfully",
                    id: this.lastID,
                    pet_id: pet_id,
                    medication_id: medication_id,
                    status: status.trim()
                });
            });
        });
    });
});

module.exports = {
    medications: medicationRouter,
    medicationLogs: logRouter
};
