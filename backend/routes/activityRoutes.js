const express = require("express");
const router = express.Router();
const db = require("../database");

// GET /api/activities - Fetch activities (optionally filtered by pet_id and/or type)
router.get("/", (req, res) => {
    const { pet_id, type } = req.query;
    let sql = "SELECT * FROM activities";
    let conditions = [];
    let params = [];

    if (pet_id) {
        conditions.push("pet_id = ?");
        params.push(pet_id);
    }
    if (type) {
        conditions.push("LOWER(activity_type) = LOWER(?)");
        params.push(type);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY timestamp DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching activities:", err.message);
            return res.status(500).json({ error: "Failed to fetch activities" });
        }
        res.status(200).json(rows);
    });
});

// GET /api/activities/today - Fetch activities logged today (optionally filtered by pet_id)
router.get("/today", (req, res) => {
    const { pet_id, date } = req.query;
    
    let dateStr = date;
    if (!dateStr) {
        const localDate = new Date();
        const yyyy = localDate.getFullYear();
        const mm = String(localDate.getMonth() + 1).padStart(2, '0');
        const dd = String(localDate.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
    }

    let sql = `
        SELECT * FROM activities 
        WHERE (date(timestamp) = date(?) 
           OR date(timestamp, 'localtime') = date(?)
           OR timestamp LIKE ?)
    `;
    let params = [dateStr, dateStr, `${dateStr}%`];

    if (pet_id) {
        sql += " AND pet_id = ?";
        params.push(pet_id);
    }

    sql += " ORDER BY timestamp DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching today's activities:", err.message);
            return res.status(500).json({ error: "Failed to fetch today's activities" });
        }

        // Additional timezone safety check
        const filtered = rows.filter(row => {
            const itemDate = new Date(row.timestamp);
            const y = itemDate.getFullYear();
            const m = String(itemDate.getMonth() + 1).padStart(2, '0');
            const d = String(itemDate.getDate()).padStart(2, '0');
            const itemDateStr = `${y}-${m}-${d}`;
            return itemDateStr === dateStr || row.timestamp.startsWith(dateStr);
        });

        res.status(200).json(filtered);
    });
});

// GET /api/activities/latest/:type - Get latest activity of a specific type (optionally filtered by pet_id)
router.get("/latest/:type", (req, res) => {
    const type = req.params.type;
    const pet_id = req.query.pet_id;

    let sql = `
        SELECT * FROM activities 
        WHERE LOWER(activity_type) = LOWER(?)
    `;
    let params = [type];

    if (pet_id) {
        sql += " AND pet_id = ?";
        params.push(pet_id);
    }

    sql += " ORDER BY timestamp DESC LIMIT 1";

    db.get(sql, params, (err, row) => {
        if (err) {
            console.error(`Error fetching latest activity for type ${type}:`, err.message);
            return res.status(500).json({ error: "Failed to fetch latest activity" });
        }
        if (!row) {
            return res.status(404).json({ message: "No activity recorded for this type" });
        }
        res.status(200).json(row);
    });
});

// POST /api/activities - Log a care activity (Feeding, Walking, Medication, etc.)
router.post("/", (req, res) => {
    const { pet_id, activity_type, notes, timestamp } = req.body;

    // Validation
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id is required" });
    }
    if (!activity_type || activity_type.trim() === "") {
        return res.status(400).json({ error: "activity_type is required" });
    }

    // Check if pet exists
    db.get("SELECT id FROM pets WHERE id = ?", [pet_id], (err, row) => {
        if (err) {
            console.error("Error verifying pet existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Pet not found" });
        }

        const activityTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

        const sql = `
            INSERT INTO activities (pet_id, activity_type, timestamp, notes)
            VALUES (?, ?, ?, ?)
        `;
        const params = [
            pet_id,
            activity_type.trim(),
            activityTimestamp,
            notes ? notes.trim() : null
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error logging activity:", err.message);
                return res.status(500).json({ error: "Failed to log activity" });
            }
            res.status(201).json({
                message: "Activity logged successfully",
                id: this.lastID,
                pet_id: pet_id,
                activity_type: activity_type.trim(),
                timestamp: activityTimestamp,
                notes: notes ? notes.trim() : null
            });
        });
    });
});

// DELETE /api/activities/:id - Delete an activity log
router.delete("/:id", (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM activities WHERE id = ?", [id], function(err) {
        if (err) {
            console.error("Error deleting activity:", err.message);
            return res.status(500).json({ error: "Failed to delete activity" });
        }
        res.status(200).json({ message: "Activity deleted successfully" });
    });
});

module.exports = router;
