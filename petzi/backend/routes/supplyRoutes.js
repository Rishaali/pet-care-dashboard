const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");

// Helper to accurately calculate daily usage and days remaining based on schedules, logs, and units
async function calculateSupplyUsage(db, petId, supply) {
    const itemType = (supply.item_type || "").toLowerCase().trim();
    const itemName = (supply.item_name || "").toLowerCase().trim();
    const unit = (supply.unit || "").toLowerCase().trim();
    const currentStock = parseFloat(supply.current_stock) || 0;

    if (currentStock <= 0) {
        return { dailyUsage: 0, daysRemaining: 0, usagePerLog: supply.usage_per_log || 0, logsPerDay: 0 };
    }

    // A) If user explicitly provided usage_per_log > 0
    let usagePerLog = parseFloat(supply.usage_per_log) || 0;

    // B) For Medication: Check active medication schedule first
    if (itemType === 'medication') {
        const medSchedule = await new Promise(resolve => {
            const sql = `
                SELECT dosage, frequency FROM medications 
                WHERE pet_id = ? AND LOWER(medication_name) = ?
                ORDER BY id DESC LIMIT 1
            `;
            db.get(sql, [petId, itemName], (err, row) => resolve(row || null));
        });

        if (medSchedule) {
            // Parse dosage number: e.g., "2 tablets" -> 2, "1.5" -> 1.5
            let dose = 1;
            if (medSchedule.dosage) {
                const m = String(medSchedule.dosage).match(/(\d+(?:\.\d+)?)/);
                if (m) dose = parseFloat(m[1]);
            }

            // Parse frequency:
            let freqPerDay = 1.0;
            if (medSchedule.frequency) {
                const f = medSchedule.frequency.toLowerCase();
                if (f.includes("four") || f.includes("4 times") || f.includes("qid") || f === "4") freqPerDay = 4.0;
                else if (f.includes("three") || f.includes("3 times") || f.includes("tid") || f === "3") freqPerDay = 3.0;
                else if (f.includes("twice") || f.includes("2 times") || f.includes("bid") || f === "2") freqPerDay = 2.0;
                else if (f.includes("once") || f.includes("1 time") || f.includes("daily") || f.includes("sid") || f === "1") freqPerDay = 1.0;
                else if (f.includes("other day") || f.includes("qod")) freqPerDay = 0.5;
                else if (f.includes("week")) freqPerDay = 1 / 7;
            }

            const dailyUsage = dose * freqPerDay;
            const daysRemaining = dailyUsage > 0 ? (currentStock / dailyUsage) : 0;
            return {
                dailyUsage: parseFloat(dailyUsage.toFixed(2)),
                daysRemaining: parseFloat(daysRemaining.toFixed(1)),
                usagePerLog: dose,
                logsPerDay: freqPerDay
            };
        }
    }

    // C) Check recent activity logs (Feeding or Medication)
    const actType = itemType === 'food' ? 'feeding' : 'medication';
    const recentActivities = await new Promise(resolve => {
        const sql = `
            SELECT timestamp, notes FROM activities
            WHERE pet_id = ? 
              AND LOWER(activity_type) = ?
              AND timestamp >= datetime('now', '-14 days')
            ORDER BY timestamp DESC
        `;
        db.all(sql, [petId, actType], (err, rows) => resolve(rows || []));
    });

    // Filter to those activities matching this item name
    const matchingActivities = recentActivities.filter(a => {
        if (!a.notes) return false;
        return a.notes.toLowerCase().includes(itemName);
    });

    const activitiesToUse = matchingActivities.length > 0 ? matchingActivities : recentActivities;

    let parsedQuantities = [];
    for (const act of activitiesToUse) {
        if (!act.notes) continue;
        const parts = act.notes.split('•').map(p => p.trim());
        for (const p of parts) {
            const m = p.replace(/[()]/g, '').trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/);
            if (m && parseFloat(m[1]) > 0) {
                let val = parseFloat(m[1]);
                let u = (m[2] || "").toLowerCase().trim();
                if (u === 'g' && unit === 'kg') val /= 1000;
                else if (u === 'kg' && unit === 'g') val *= 1000;
                else if (u === 'mg' && unit === 'g') val /= 1000;
                else if (u === 'ml' && unit === 'l') val /= 1000;
                else if (u === 'l' && unit === 'ml') val *= 1000;
                parsedQuantities.push(val);
                break;
            }
        }
    }

    // If we have actual logged usages, calculate average daily usage
    if (parsedQuantities.length > 0) {
        const avgQtyPerLog = parsedQuantities.reduce((sum, q) => sum + q, 0) / parsedQuantities.length;
        let logsPerDay = itemType === 'food' ? 2.0 : 1.0;
        if (activitiesToUse.length >= 2) {
            const newestTime = new Date(activitiesToUse[0].timestamp).getTime();
            const oldestTime = new Date(activitiesToUse[activitiesToUse.length - 1].timestamp).getTime();
            const daysDiff = Math.max(1, (newestTime - oldestTime) / (1000 * 60 * 60 * 24));
            logsPerDay = Math.max(0.5, activitiesToUse.length / daysDiff);
        }
        const dailyUsage = avgQtyPerLog * logsPerDay;
        const daysRemaining = dailyUsage > 0 ? (currentStock / dailyUsage) : 0;
        return {
            dailyUsage: parseFloat(dailyUsage.toFixed(2)),
            daysRemaining: parseFloat(daysRemaining.toFixed(1)),
            usagePerLog: parseFloat(avgQtyPerLog.toFixed(2)),
            logsPerDay: parseFloat(logsPerDay.toFixed(1))
        };
    }

    // D) If user specified usage_per_log
    if (usagePerLog > 0) {
        const logsPerDay = itemType === 'food' ? 2.0 : 1.0;
        const dailyUsage = usagePerLog * logsPerDay;
        const daysRemaining = dailyUsage > 0 ? (currentStock / dailyUsage) : 0;
        return {
            dailyUsage: parseFloat(dailyUsage.toFixed(2)),
            daysRemaining: parseFloat(daysRemaining.toFixed(1)),
            usagePerLog: usagePerLog,
            logsPerDay: logsPerDay
        };
    }

    // E) Smart default fallbacks based on unit and itemType
    let defaultDailyUsage = 1.0;
    let defaultUsagePerLog = 1.0;
    let defaultLogsPerDay = 1.0;

    if (itemType === 'food') {
        defaultLogsPerDay = 2.0;
        if (unit === 'kg') {
            defaultDailyUsage = 0.4; // 400g / day
            defaultUsagePerLog = 0.2;
        } else if (unit === 'g') {
            defaultDailyUsage = 400; // 400g / day
            defaultUsagePerLog = 200;
        } else if (unit === 'tablets' || unit === 'capsules') {
            defaultDailyUsage = 2;
            defaultUsagePerLog = 1;
        } else if (unit === 'ml') {
            defaultDailyUsage = 200;
            defaultUsagePerLog = 100;
        } else {
            defaultDailyUsage = 2;
            defaultUsagePerLog = 1;
        }
    } else {
        // Medication
        defaultLogsPerDay = 1.0;
        if (unit === 'tablets' || unit === 'pills' || unit === 'capsules' || unit === 'doses') {
            defaultDailyUsage = 1.0;
            defaultUsagePerLog = 1.0;
        } else if (unit === 'ml') {
            defaultDailyUsage = 5.0;
            defaultUsagePerLog = 5.0;
        } else if (unit === 'g' || unit === 'mg') {
            defaultDailyUsage = 10.0;
            defaultUsagePerLog = 10.0;
        } else if (unit === 'kg') {
            defaultDailyUsage = 0.05;
            defaultUsagePerLog = 0.05;
        } else {
            defaultDailyUsage = 1.0;
            defaultUsagePerLog = 1.0;
        }
    }

    const daysRemaining = defaultDailyUsage > 0 ? (currentStock / defaultDailyUsage) : 0;
    return {
        dailyUsage: parseFloat(defaultDailyUsage.toFixed(2)),
        daysRemaining: parseFloat(daysRemaining.toFixed(1)),
        usagePerLog: parseFloat(defaultUsagePerLog.toFixed(2)),
        logsPerDay: defaultLogsPerDay
    };
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
                    const usageCalc = await calculateSupplyUsage(db, pet_id, supply);

                    enrichedSupplies.push({
                        ...supply,
                        logs_per_day_estimate: usageCalc.logsPerDay,
                        usage_per_log: usageCalc.usagePerLog,
                        daily_usage: usageCalc.dailyUsage,
                        days_remaining: usageCalc.daysRemaining
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
        const usageVal = usage_per_log !== undefined && !isNaN(parseFloat(usage_per_log)) ? parseFloat(usage_per_log) : 0;
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
            usageVal,
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
                usage_per_log: usageVal,
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
