const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/vet-visits?pet_id= - Fetch all vet visits for a pet
router.get("/", authMiddleware, (req, res) => {
    const { pet_id } = req.query;
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id query parameter is required" });
    }

    // Verify pet ownership
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

        // Fetch vet visits sorted descending (latest visits first)
        db.all("SELECT * FROM vet_visits WHERE pet_id = ? ORDER BY visit_date DESC, id DESC", [pet_id], (err, rows) => {
            if (err) {
                console.error("Error fetching vet visits:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json(rows);
        });
    });
});

// POST /api/vet-visits - Log a new vet visit
router.post("/", authMiddleware, (req, res) => {
    const { pet_id, visit_date, veterinarian, clinic_name, diagnosis, treatment_plan, prescription_notes, attachment_url } = req.body;
    
    if (!pet_id || !visit_date || !veterinarian || !diagnosis) {
        return res.status(400).json({ error: "pet_id, visit_date, veterinarian, and diagnosis are required" });
    }

    // Verify pet ownership
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
            INSERT INTO vet_visits (pet_id, visit_date, veterinarian, clinic_name, diagnosis, treatment_plan, prescription_notes, attachment_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            pet_id,
            visit_date,
            veterinarian.trim(),
            clinic_name ? clinic_name.trim() : null,
            diagnosis.trim(),
            treatment_plan ? treatment_plan.trim() : null,
            prescription_notes ? prescription_notes.trim() : null,
            attachment_url || null
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error inserting vet visit log:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            
            res.status(201).json({
                message: "Vet visit logged successfully",
                id: this.lastID
            });
        });
    });
});

// PUT /api/vet-visits/:id - Update an existing vet visit log
router.put("/:id", authMiddleware, (req, res) => {
    const { id } = req.params;
    const { visit_date, veterinarian, clinic_name, diagnosis, treatment_plan, prescription_notes, attachment_url } = req.body;

    if (!visit_date || !veterinarian || !diagnosis) {
        return res.status(400).json({ error: "visit_date, veterinarian, and diagnosis are required" });
    }

    // Query record to verify ownership
    db.get("SELECT v.*, p.user_id FROM vet_visits v JOIN pets p ON v.pet_id = p.id WHERE v.id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error querying vet visit record:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Vet visit log not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const sql = `
            UPDATE vet_visits
            SET visit_date = ?, veterinarian = ?, clinic_name = ?, diagnosis = ?, treatment_plan = ?, prescription_notes = ?, attachment_url = ?
            WHERE id = ?
        `;
        const params = [
            visit_date,
            veterinarian.trim(),
            clinic_name ? clinic_name.trim() : null,
            diagnosis.trim(),
            treatment_plan ? treatment_plan.trim() : null,
            prescription_notes ? prescription_notes.trim() : null,
            attachment_url || null,
            id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error updating vet visit record:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Vet visit record updated successfully" });
        });
    });
});

// DELETE /api/vet-visits/:id - Delete a vet visit log
router.delete("/:id", authMiddleware, (req, res) => {
    const { id } = req.params;

    // Verify ownership
    db.get("SELECT v.id, p.user_id FROM vet_visits v JOIN pets p ON v.pet_id = p.id WHERE v.id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error querying vet visit record for delete:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Vet visit log not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        db.run("DELETE FROM vet_visits WHERE id = ?", [id], function(err) {
            if (err) {
                console.error("Error deleting vet visit record:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Vet visit record deleted successfully" });
        });
    });
});

module.exports = router;
