const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/activities - Fetch activities (optionally filtered by pet_id, type, and/or date)
router.get("/", authMiddleware, (req, res) => {
    const { pet_id, type, date } = req.query;
    let sql = "SELECT activities.* FROM activities JOIN pets ON activities.pet_id = pets.id WHERE pets.user_id = ?";
    let params = [req.user.id];

    if (pet_id) {
        sql += " AND activities.pet_id = ?";
        params.push(pet_id);
    }
    if (type) {
        sql += " AND LOWER(activities.activity_type) = LOWER(?)";
        params.push(type);
    }
    if (date) {
        sql += " AND (date(activities.timestamp) = date(?) OR date(activities.timestamp, 'localtime') = date(?) OR activities.timestamp LIKE ?)";
        params.push(date, date, `${date}%`);
    }

    sql += " ORDER BY activities.timestamp DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching activities:", err.message);
            return res.status(500).json({ error: "Failed to fetch activities" });
        }

        if (date) {
            const filtered = rows.filter(row => {
                if (!row.timestamp) return false;
                const itemDate = new Date(row.timestamp);
                const y = itemDate.getFullYear();
                const m = String(itemDate.getMonth() + 1).padStart(2, '0');
                const d = String(itemDate.getDate()).padStart(2, '0');
                const itemDateStr = `${y}-${m}-${d}`;
                return itemDateStr === date || row.timestamp.startsWith(date);
            });
            return res.status(200).json(filtered);
        }

        res.status(200).json(rows);
    });
});

// GET /api/activities/today - Fetch activities logged today (optionally filtered by pet_id)
router.get("/today", authMiddleware, (req, res) => {
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
        SELECT activities.* FROM activities 
        JOIN pets ON activities.pet_id = pets.id
        WHERE pets.user_id = ? 
        AND (date(activities.timestamp) = date(?) 
           OR date(activities.timestamp, 'localtime') = date(?)
           OR activities.timestamp LIKE ?)
    `;
    let params = [req.user.id, dateStr, dateStr, `${dateStr}%`];

    if (pet_id) {
        sql += " AND activities.pet_id = ?";
        params.push(pet_id);
    }

    sql += " ORDER BY activities.timestamp DESC";

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
router.get("/latest/:type", authMiddleware, (req, res) => {
    const type = req.params.type;
    const pet_id = req.query.pet_id;

    let sql = `
        SELECT activities.* FROM activities 
        JOIN pets ON activities.pet_id = pets.id
        WHERE pets.user_id = ? AND LOWER(activities.activity_type) = LOWER(?)
    `;
    let params = [req.user.id, type];

    if (pet_id) {
        sql += " AND activities.pet_id = ?";
        params.push(pet_id);
    }

    sql += " ORDER BY activities.timestamp DESC LIMIT 1";

    db.get(sql, params, (err, row) => {
        if (err) {
            console.error(`Error fetching latest activity for type ${type}:`, err.message);
            return res.status(500).json({ error: "Failed to fetch latest activity" });
        }
        if (!row) {
            return res.status(200).json({ message: "No activity recorded for this type", found: false });
        }
        res.status(200).json(row);
    });
});

// POST /api/activities - Log a care activity (Feeding, Walking, Medication, etc.)
router.post("/", authMiddleware, (req, res) => {
    const { pet_id, activity_type, notes, timestamp } = req.body;

    // Validation
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id is required" });
    }
    if (!activity_type || activity_type.trim() === "") {
        return res.status(400).json({ error: "activity_type is required" });
    }

    // Check if pet exists and check ownership
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

            // Auto-decrement supply stock dynamically (non-blocking)
            try {
                const actType = activity_type.trim().toLowerCase();
                if (actType === "feeding" || actType === "medication") {
                    const itemType = actType === "feeding" ? "Food" : "Medication";
                    db.all("SELECT * FROM supplies WHERE pet_id = ? AND item_type = ?", [pet_id, itemType], (suppErr, rows) => {
                        if (suppErr) {
                            console.error("Auto-decrement supplies fetch failed:", suppErr.message);
                            return;
                        }
                        if (!rows || rows.length === 0) return;

                        let targetSupplies = [];
                        if (itemType === "Food") {
                            // If there are multiple food items, try matching by item name in notes
                            const notesLower = notes ? notes.trim().toLowerCase() : "";
                            const matched = rows.filter(s => notesLower.includes(s.item_name.toLowerCase()));
                            if (matched.length > 0) {
                                targetSupplies = matched;
                            } else {
                                targetSupplies = [rows[0]]; // fallback to first food item
                            }
                        } else {
                            // Medication: must match medication name in notes
                            const notesLower = notes ? notes.trim().toLowerCase() : "";
                            targetSupplies = rows.filter(s => notesLower.includes(s.item_name.toLowerCase()));
                            // Fallback if there is only 1 medication tracker in the database
                            if (targetSupplies.length === 0 && rows.length === 1) {
                                targetSupplies = rows;
                            }
                        }

                        targetSupplies.forEach(supply => {
                            const newStock = Math.max(0, supply.current_stock - supply.usage_per_log);
                            db.run(
                                "UPDATE supplies SET current_stock = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
                                [newStock, supply.id],
                                (updateErr) => {
                                    if (updateErr) {
                                        console.error(`Failed to auto-decrement supply stock for ID ${supply.id}:`, updateErr.message);
                                    } else {
                                        console.log(`Auto-decremented supply ID ${supply.id} from ${supply.current_stock} to ${newStock}`);
                                    }
                                }
                            );
                        });
                    });
                }
            } catch (actSuppErr) {
                console.error("Error in auto-decrement supply block:", actSuppErr.message);
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
router.delete("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    
    // Verify activity ownership via pet
    const checkSql = `
        SELECT activities.id 
        FROM activities 
        JOIN pets ON activities.pet_id = pets.id 
        WHERE activities.id = ? AND pets.user_id = ?
    `;
    db.get(checkSql, [id, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(403).json({ error: "Access denied or activity not found" });

        db.run("DELETE FROM activities WHERE id = ?", [id], function(err) {
            if (err) {
                console.error("Error deleting activity:", err.message);
                return res.status(500).json({ error: "Failed to delete activity" });
            }
            res.status(200).json({ message: "Activity deleted successfully" });
        });
    });
});

module.exports = router;
