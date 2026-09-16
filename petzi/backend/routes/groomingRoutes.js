const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/grooming?pet_id= - Fetch all grooming records for a pet
router.get("/", authMiddleware, (req, res) => {
    const { pet_id } = req.query;
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id query parameter is required" });
    }

    // Verify pet existence and ownership
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [pet_id], (err, pet) => {
        if (err) {
            console.error("Error verifying pet ownership:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!pet) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(pet.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        // Fetch grooming records sorted descending (latest first)
        db.all("SELECT * FROM grooming WHERE pet_id = ? ORDER BY date_recorded DESC, id DESC", [pet_id], (err, rows) => {
            if (err) {
                console.error("Error fetching grooming logs:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json(rows);
        });
    });
});

// POST /api/grooming - Log a new grooming session
router.post("/", authMiddleware, (req, res) => {
    const { pet_id, grooming_type, date_recorded, next_due_date, notes } = req.body;
    
    if (!pet_id || !grooming_type || !date_recorded) {
        return res.status(400).json({ error: "pet_id, grooming_type, and date_recorded are required" });
    }

    // Verify pet existence and ownership
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [pet_id], (err, pet) => {
        if (err) {
            console.error("Error verifying pet ownership:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!pet) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(pet.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const sql = `
            INSERT INTO grooming (pet_id, grooming_type, date_recorded, next_due_date, notes)
            VALUES (?, ?, ?, ?, ?)
        `;
        const params = [
            pet_id,
            grooming_type.trim(),
            date_recorded,
            next_due_date || null,
            notes ? notes.trim() : null
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error inserting grooming log:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            
            res.status(201).json({
                message: "Grooming record logged successfully",
                id: this.lastID
            });
        });
    });
});

// PUT /api/grooming/:id - Update an existing grooming record
router.put("/:id", authMiddleware, (req, res) => {
    const { id } = req.params;
    const { grooming_type, date_recorded, next_due_date, notes } = req.body;

    if (!grooming_type || !date_recorded) {
        return res.status(400).json({ error: "grooming_type and date_recorded are required" });
    }

    // Query record to verify ownership
    db.get("SELECT g.*, p.user_id FROM grooming g JOIN pets p ON g.pet_id = p.id WHERE g.id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error querying grooming record:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Grooming log not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const sql = `
            UPDATE grooming
            SET grooming_type = ?, date_recorded = ?, next_due_date = ?, notes = ?
            WHERE id = ?
        `;
        const params = [
            grooming_type.trim(),
            date_recorded,
            next_due_date || null,
            notes ? notes.trim() : null,
            id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error updating grooming record:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Grooming record updated successfully" });
        });
    });
});

// DELETE /api/grooming/:id - Delete a grooming record
router.delete("/:id", authMiddleware, (req, res) => {
    const { id } = req.params;

    // Verify ownership
    db.get("SELECT g.id, p.user_id FROM grooming g JOIN pets p ON g.pet_id = p.id WHERE g.id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error querying grooming record for delete:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Grooming log not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        db.run("DELETE FROM grooming WHERE id = ?", [id], function(err) {
            if (err) {
                console.error("Error deleting grooming record:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Grooming record deleted successfully" });
        });
    });
});

module.exports = router;
