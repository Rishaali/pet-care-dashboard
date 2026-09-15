const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");

// Helper to estimate logs per day based on history or schedules
function getLogsPerDayEstimate(db, petId, itemType, itemName) {
    return new Promise((resolve) => {
        const activityType = itemType === 'Food' ? 'Feeding' : 'Medication';
        // Count logs of this type in the last 7 days
        const sql = `
            SELECT COUNT(*) as count FROM activities
            WHERE pet_id = ? 
              AND LOWER(activity_type) = LOWER(?) 
              AND timestamp >= datetime('now', '-7 days')
        `;
        db.get(sql, [petId, activityType], (err, row) => {
            let avg = 0;
            if (!err && row) {
                avg = row.count / 7.0;
            }
            // If we have a non-trivial average, use it
            if (avg >= 0.1) {
                return resolve(avg);
            }
            // Fallback default estimate if no recent logs
            if (itemType === 'Food') {
                resolve(2.0); // Default to 2 feedings/day
            } else {
                // For Medication, try to check active medication schedule frequency
                const medSql = `
                    SELECT frequency FROM medications 
                    WHERE pet_id = ? AND LOWER(medication_name) = LOWER(?)
                    LIMIT 1
                `;
                db.get(medSql, [petId, itemName], (err, medRow) => {
                    if (!err && medRow) {
                        const freq = medRow.frequency.toLowerCase();
                        if (freq.includes("three") || freq.includes("3 times") || freq.includes("tid")) {
                            return resolve(3.0);
                        } else if (freq.includes("twice") || freq.includes("2 times") || freq.includes("bid")) {
                            return resolve(2.0);
                        } else if (freq.includes("once") || freq.includes("1 time") || freq.includes("sid") || freq.includes("daily")) {
                            return resolve(1.0);
                        }
                    }
                    resolve(1.0); // Default fallback
                });
            }
        });
    });
}

// GET /api/supplies?pet_id= - Fetch all supplies for a pet with days_remaining calculation
router.get("/", authMiddleware, (req, res) => {
    const { pet_id } = req.query;
    if (!pet_id) {
        return res.status(400).json({ error: "pet_id query parameter is required" });
    }

    // Verify pet existence and ownership
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [pet_id], (err, pet) => {
        if (err) {
            console.error("Error verifying pet existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!pet) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(pet.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        // Fetch supplies
        db.all("SELECT * FROM supplies WHERE pet_id = ? ORDER BY last_updated DESC", [pet_id], async (err, rows) => {
            if (err) {
                console.error("Error fetching supplies:", err.message);
                return res.status(500).json({ error: "Database error" });
            }

            try {
                const enrichedSupplies = [];
                for (const supply of rows) {
                    const logsPerDay = await getLogsPerDayEstimate(db, pet_id, supply.item_type, supply.item_name);
                    const usage = (supply.usage_per_log || 0.1) * (logsPerDay || 1);
                    const daysRemaining = usage > 0 ? (supply.current_stock / usage) : 0;

                    enrichedSupplies.push({
                        ...supply,
                        logs_per_day_estimate: logsPerDay,
                        days_remaining: parseFloat(daysRemaining.toFixed(1))
                    });
                }
                res.status(200).json(enrichedSupplies);
            } catch (enrichErr) {
                console.error("Error calculating remaining supply days:", enrichErr);
                res.status(500).json({ error: "Failed to enrich supply stock calculation" });
            }
        });
    });
});

// POST /api/supplies - Add a new supply item tracker
router.post("/", authMiddleware, (req, res) => {
    const { pet_id, item_type, item_name, unit, current_stock, usage_per_log, low_stock_threshold_days } = req.body;

    if (!pet_id) {
        return res.status(400).json({ error: "pet_id is required" });
    }
    if (!item_type || !['Food', 'Medication'].includes(item_type)) {
        return res.status(400).json({ error: "item_type must be either 'Food' or 'Medication'" });
    }
    if (!item_name || item_name.trim() === "") {
        return res.status(400).json({ error: "item_name is required" });
    }
    if (current_stock === undefined || isNaN(parseFloat(current_stock)) || parseFloat(current_stock) < 0) {
        return res.status(400).json({ error: "current_stock must be a non-negative number" });
    }
    if (usage_per_log === undefined || isNaN(parseFloat(usage_per_log)) || parseFloat(usage_per_log) <= 0) {
        return res.status(400).json({ error: "usage_per_log must be a number greater than 0" });
    }

    // Verify pet existence and ownership
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [pet_id], (err, pet) => {
        if (err) {
            console.error("Error verifying pet existence:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!pet) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(pet.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const threshold = low_stock_threshold_days !== undefined ? parseInt(low_stock_threshold_days, 10) : 2;
        const sql = `
            INSERT INTO supplies (pet_id, item_type, item_name, unit, current_stock, usage_per_log, low_stock_threshold_days, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const params = [
            pet_id,
            item_type,
            item_name.trim(),
            unit ? unit.trim() : null,
            parseFloat(current_stock),
            parseFloat(usage_per_log),
            isNaN(threshold) ? 2 : threshold
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error inserting supply item:", err.message);
                return res.status(500).json({ error: "Failed to create supply item tracker" });
            }
            res.status(201).json({
                message: "Supply item added successfully",
                id: this.lastID,
                pet_id,
                item_type,
                item_name: item_name.trim(),
                unit: unit ? unit.trim() : null,
                current_stock: parseFloat(current_stock),
                usage_per_log: parseFloat(usage_per_log),
                low_stock_threshold_days: isNaN(threshold) ? 2 : threshold,
                last_updated: new Date().toISOString()
            });
        });
    });
});

// PUT /api/supplies/:id/restock - Add quantity to current_stock
router.put("/:id/restock", authMiddleware, (req, res) => {
    const id = req.params.id;
    const { quantity } = req.body;

    if (quantity === undefined || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
        return res.status(400).json({ error: "quantity must be a number greater than 0" });
    }

    // Verify supply ownership via pet
    const verifySql = `
        SELECT supplies.id, pets.user_id, supplies.current_stock 
        FROM supplies 
        JOIN pets ON supplies.pet_id = pets.id 
        WHERE supplies.id = ?
    `;
    db.get(verifySql, [id], (err, row) => {
        if (err) {
            console.error("Error verifying supply ownership:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Supply item not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const newStock = row.current_stock + parseFloat(quantity);
        const updateSql = `
            UPDATE supplies 
            SET current_stock = ?, last_updated = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        db.run(updateSql, [newStock, id], function(err) {
            if (err) {
                console.error("Error restocking supply item:", err.message);
                return res.status(500).json({ error: "Failed to restock supply item" });
            }
            res.status(200).json({
                message: "Supply item restocked successfully",
                id: parseInt(id, 10),
                current_stock: newStock,
                last_updated: new Date().toISOString()
            });
        });
    });
});

// DELETE /api/supplies/:id - Remove supply tracker
router.delete("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;

    // Verify ownership
    const verifySql = `
        SELECT supplies.id, pets.user_id 
        FROM supplies 
        JOIN pets ON supplies.pet_id = pets.id 
        WHERE supplies.id = ?
    `;
    db.get(verifySql, [id], (err, row) => {
        if (err) {
            console.error("Error verifying supply ownership:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            return res.status(404).json({ error: "Supply item not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        db.run("DELETE FROM supplies WHERE id = ?", [id], function(err) {
            if (err) {
                console.error("Error deleting supply:", err.message);
                return res.status(500).json({ error: "Failed to delete supply item" });
            }
            res.status(200).json({ message: "Supply item deleted successfully" });
        });
    });
});

module.exports = router;
