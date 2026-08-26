const express = require("express");
const db = require("../database");

const medicationRouter = express.Router();
const logRouter = express.Router();

// ==========================================
// MEDICATIONS ROUTER (mounted at /api/medications)
// ==========================================

// GET /api/medications - Retrieve medication schedules (optionally filter by pet_id)
medicationRouter.get("/", (req, res) => {
    const petId = req.query.pet_id;
    let sql = `
        SELECT m.*
        FROM medications m
        JOIN pets p ON m.pet_id = p.id
        WHERE p.user_id = ?
    `;
    let params = [req.user.id];

    if (petId) {
        sql += " AND m.pet_id = ?";
        params.push(petId);
    }
    sql += " ORDER BY m.id DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching medications:", err.message);
            return res.status(500).json({ error: "Failed to fetch medications" });
        }
        res.status(200).json(rows);
    });
});

// POST /api/medications - Create a new medication schedule
medicationRouter.post("/", (req, res) => {
    const { pet_id, medication_name, dosage, frequency, start_date, end_date, reminder_time, notes } = req.body;

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

    // Check dates
    if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (end < start) {
            return res.status(400).json({ error: "End date cannot be before start date" });
        }
    }

    // Verify pet exists
    db.get("SELECT id FROM pets WHERE id = ? AND user_id = ?", [pet_id, req.user.id], (err, row) => {
        if (err) {
            console.error("Error verifying pet existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Pet not found" });
        }

        const sql = `
            INSERT INTO medications (pet_id, medication_name, dosage, frequency, start_date, end_date, reminder_time, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            pet_id,
            medication_name.trim(),
            dosage.trim(),
            frequency ? frequency.trim() : null,
            start_date || null,
            end_date || null,
            reminder_time.trim(),
            notes ? notes.trim() : null
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
                medication_name: medication_name.trim()
            });
        });
    });
});

// PUT /api/medications/:id - Update an existing medication schedule
medicationRouter.put("/:id", (req, res) => {
    const id = req.params.id;
    const { pet_id, medication_name, dosage, frequency, start_date, end_date, reminder_time, notes } = req.body;

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

    if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (end < start) {
            return res.status(400).json({ error: "End date cannot be before start date" });
        }
    }

    const ownershipSql = `
        SELECT m.id
        FROM medications m
        JOIN pets p ON m.pet_id = p.id
        WHERE m.id = ? AND p.user_id = ?
    `;

    db.get(ownershipSql, [id, req.user.id], (err, row) => {
        if (err) {
            console.error("Error checking medication existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Medication schedule not found" });
        }

        const sql = `
            UPDATE medications
            SET pet_id = ?, medication_name = ?, dosage = ?, frequency = ?, start_date = ?, end_date = ?, reminder_time = ?, notes = ?
            WHERE id = ?
            AND pet_id IN (SELECT id FROM pets WHERE user_id = ?)
            AND ? IN (SELECT id FROM pets WHERE user_id = ?)
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
            id,
            req.user.id,
            pet_id,
            req.user.id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error updating medication:", err.message);
                return res.status(500).json({ error: "Failed to update medication schedule" });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "Medication schedule not found" });
            }
            res.status(200).json({
                message: "Medication schedule updated successfully"
            });
        });
    });
});

// DELETE /api/medications/:id - Delete a medication schedule
medicationRouter.delete("/:id", (req, res) => {
    const id = req.params.id;

    const ownershipSql = `
        SELECT m.id
        FROM medications m
        JOIN pets p ON m.pet_id = p.id
        WHERE m.id = ? AND p.user_id = ?
    `;

    db.get(ownershipSql, [id, req.user.id], (err, row) => {
        if (err) {
            console.error("Error checking medication existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Medication schedule not found" });
        }

        db.run("DELETE FROM medications WHERE id = ? AND pet_id IN (SELECT id FROM pets WHERE user_id = ?)", [id, req.user.id], (err) => {
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
logRouter.get("/", (req, res) => {
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
logRouter.post("/", (req, res) => {
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

    // Verify pet and medication exist
    db.get("SELECT id FROM pets WHERE id = ? AND user_id = ?", [pet_id, req.user.id], (err, petRow) => {
        if (err) {
            console.error("Error verifying pet existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!petRow) {
            return res.status(404).json({ error: "Pet not found" });
        }

        db.get("SELECT id FROM medications WHERE id = ? AND pet_id = ?", [medication_id, pet_id], (err, medRow) => {
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
