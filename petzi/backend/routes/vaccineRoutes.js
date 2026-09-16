const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");
const { dispatchNotification } = require("../services/reminderScheduler");

// Helper function to calculate vaccine status based on next due date
function calculateStatus(nextDueDateStr) {
    if (!nextDueDateStr) return "Up-to-date";
    
    const dueDate = new Date(nextDueDateStr);
    if (isNaN(dueDate.getTime())) return "Up-to-date";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return "Overdue";
    } else if (diffDays <= 30) {
        return "Due Soon";
    } else {
        return "Up-to-date";
    }
}

// GET /api/vaccinations?pet_id= - Fetch all vaccine records for a pet
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

        // Fetch vaccine records
        db.all("SELECT * FROM vaccinations WHERE pet_id = ? ORDER BY next_due_date ASC", [pet_id], (err, rows) => {
            if (err) {
                console.error("Error fetching vaccinations:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            
            // Dynamically recalculate and update status in returned rows
            const updatedRows = rows.map(row => {
                const currentStatus = calculateStatus(row.next_due_date);
                return { ...row, status: currentStatus };
            });
            
            res.json(updatedRows);
        });
    });
});

// POST /api/vaccinations - Add a new vaccination record
router.post("/", authMiddleware, (req, res) => {
    const { pet_id, vaccine_name, date_administered, next_due_date, veterinarian, batch_number, notes } = req.body;
    
    if (!pet_id || !vaccine_name) {
        return res.status(400).json({ error: "pet_id and vaccine_name are required" });
    }

    // Verify ownership
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

        const calculatedStatus = calculateStatus(next_due_date);

        const sql = `
            INSERT INTO vaccinations (pet_id, vaccine_name, date_administered, next_due_date, veterinarian, batch_number, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            pet_id,
            vaccine_name.trim(),
            date_administered || null,
            next_due_date || null,
            veterinarian ? veterinarian.trim() : null,
            batch_number ? batch_number.trim() : null,
            notes ? notes.trim() : null,
            calculatedStatus
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error inserting vaccination:", err.message);
                return res.status(500).json({ error: "Database error" });
            }

            const vaxId = this.lastID;

            // Fetch user and pet details to dispatch confirmation notification + email
            db.get("SELECT u.name AS user_name, u.email AS user_email, p.name AS pet_name FROM users u JOIN pets p ON p.user_id = u.id WHERE u.id = ? AND p.id = ?", [req.user.id, pet_id], (uErr, row) => {
                if (!uErr && row) {
                    dispatchNotification({
                        userId: req.user.id,
                        petId: pet_id,
                        type: 'vaccination',
                        referenceId: vaxId,
                        reminderKey: `vax_recorded_${vaxId}`,
                        title: `Vaccination Recorded: ${vaccine_name.trim()} for ${row.pet_name}`,
                        message: `Vaccination record for ${row.pet_name} (${vaccine_name.trim()}) has been added.${next_due_date ? ' Next due date: ' + next_due_date : ''}`,
                        actionUrl: `/index.html#vaccines`,
                        userEmail: row.user_email,
                        userName: row.user_name,
                        details: [
                            { label: "Pet", value: row.pet_name },
                            { label: "Vaccine", value: vaccine_name.trim() },
                            { label: "Date Administered", value: date_administered || "Today" },
                            { label: "Next Due Date", value: next_due_date || "N/A" },
                            { label: "Veterinarian", value: veterinarian || "Not specified" }
                        ],
                        actionText: "View Vaccine Records"
                    }).catch(e => console.error("Error dispatching vaccine notification:", e));
                }
            });

            res.status(201).json({
                message: "Vaccine record added successfully",
                id: vaxId,
                status: calculatedStatus
            });
        });
    });
});

// PUT /api/vaccinations/:id - Update an existing vaccination record
router.put("/:id", authMiddleware, (req, res) => {
    const { id } = req.params;
    const { vaccine_name, date_administered, next_due_date, veterinarian, batch_number, notes } = req.body;

    if (!vaccine_name) {
        return res.status(400).json({ error: "vaccine_name is required" });
    }

    // Find the vaccine record first to check ownership via pet relation
    db.get("SELECT v.*, p.user_id FROM vaccinations v JOIN pets p ON v.pet_id = p.id WHERE v.id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error querying vaccine record:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Vaccination record not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const calculatedStatus = calculateStatus(next_due_date);

        const sql = `
            UPDATE vaccinations
            SET vaccine_name = ?, date_administered = ?, next_due_date = ?, veterinarian = ?, batch_number = ?, notes = ?, status = ?
            WHERE id = ?
        `;
        const params = [
            vaccine_name.trim(),
            date_administered || null,
            next_due_date || null,
            veterinarian ? veterinarian.trim() : null,
            batch_number ? batch_number.trim() : null,
            notes ? notes.trim() : null,
            calculatedStatus,
            id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error updating vaccination:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Vaccination record updated successfully", status: calculatedStatus });
        });
    });
});

// DELETE /api/vaccinations/:id - Delete a vaccination record
router.delete("/:id", authMiddleware, (req, res) => {
    const { id } = req.params;

    // Verify ownership via join
    db.get("SELECT v.id, p.user_id FROM vaccinations v JOIN pets p ON v.pet_id = p.id WHERE v.id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error querying vaccine record for delete:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Vaccination record not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        db.run("DELETE FROM vaccinations WHERE id = ?", [id], function(err) {
            if (err) {
                console.error("Error deleting vaccination:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Vaccination record deleted successfully" });
        });
    });
});

module.exports = router;
