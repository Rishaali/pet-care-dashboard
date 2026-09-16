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

        const insertActivity = (pId, actType, ts, nt, callback) => {
            const insertSql = `
                INSERT INTO activities (pet_id, activity_type, timestamp, notes)
                VALUES (?, ?, ?, ?)
            `;
            const insertParams = [pId, actType.trim(), ts, nt ? nt.trim() : null];
            db.run(insertSql, insertParams, function(insErr) {
                if (insErr) {
                    console.error("Error inserting activity:", insErr.message);
                    callback(insErr, null);
                } else {
                    callback(null, this.lastID);
                }
            });
        };

        const actType = activity_type.trim().toLowerCase();
        if (actType === "feeding" || actType === "medication") {
            const itemType = actType === "feeding" ? "Food" : "Medication";

            db.all("SELECT * FROM supplies WHERE pet_id = ?", [pet_id], (suppErr, rows) => {
                if (suppErr) {
                    console.error("Supplies fetch error:", suppErr.message);
                    return res.status(500).json({ error: "Database error during supply check" });
                }

                const notesParts = notes ? notes.split('•').map(p => p.trim()) : [];
                const inputName = notesParts.length > 0 ? notesParts[0].toLowerCase().trim() : "";
                const cleanInputName = inputName.split('(')[0].replace(/marked as (?:given|taken)\.?/i, '').trim();

                let matchedSupply = null;
                if (rows && rows.length > 0) {
                    if (inputName) {
                        // 1. Exact match with item_type (case-insensitive)
                        matchedSupply = rows.find(s => 
                            (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase() &&
                            (s.item_name || "").toLowerCase().trim() === inputName
                        );

                        // 2. Exact match on item_name (case-insensitive)
                        if (!matchedSupply) {
                            matchedSupply = rows.find(s => (s.item_name || "").toLowerCase().trim() === inputName);
                        }
                    }

                    // 3. Match without parenthesized details or extra text
                    if (!matchedSupply && cleanInputName) {
                        matchedSupply = rows.find(s => 
                            (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase() &&
                            (s.item_name || "").toLowerCase().trim() === cleanInputName
                        ) || rows.find(s => (s.item_name || "").toLowerCase().trim() === cleanInputName);
                    }

                    // 4. StartsWith / partial matching with same item_type
                    if (!matchedSupply && cleanInputName) {
                        matchedSupply = rows.find(s => 
                            (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase() &&
                            ((s.item_name || "").toLowerCase().trim().startsWith(cleanInputName) ||
                             cleanInputName.startsWith((s.item_name || "").toLowerCase().trim()))
                        );
                    }

                    // 5. Fallback if single supply of this type
                    if (!matchedSupply) {
                        const typeSupplies = rows.filter(s => (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase());
                        if (typeSupplies.length === 1) {
                            matchedSupply = typeSupplies[0];
                        }
                    }
                }

                if (!matchedSupply) {
                    if (actType === "feeding") {
                        // Feeding MUST have a matching supply — strict enforcement
                        return res.status(400).json({ error: "Food not found in Supplies Stock." });
                    }
                    // Medication with no matching supply: log the activity without stock deduction.
                    // This covers "Mark as Given / Taken" where the medication may not be
                    // tracked in the supplies table (medication_logs already records the event).
                    return insertActivity(pet_id, activity_type, activityTimestamp, notes, (err, activityId) => {
                        if (err) return res.status(500).json({ error: "Failed to log activity" });
                        return res.status(201).json({
                            message: "Activity logged successfully",
                            id: activityId,
                            pet_id: pet_id,
                            activity_type: activity_type.trim(),
                            timestamp: activityTimestamp,
                            notes: notes ? notes.trim() : null
                        });
                    });
                }

                // Determine requested quantity and unit from user input
                let usageAmount = 1;
                let userUnit = matchedSupply.unit || '';

                const parsed = parseQuantityAndUnit(notes);
                if (parsed && parsed.value > 0) {
                    usageAmount = parsed.value;
                    userUnit = parsed.unit;
                } else if (notesParts.length > 1) {
                    const cleanPart = notesParts[1].replace(/[()]/g, '').trim();
                    const qtyMatch = cleanPart.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
                    if (qtyMatch && parseFloat(qtyMatch[1]) > 0) {
                        usageAmount = parseFloat(qtyMatch[1]);
                        if (qtyMatch[2]) userUnit = qtyMatch[2];
                    }
                }

                if (usageAmount <= 0) {
                    return res.status(400).json({
                        error: "Please enter a valid quantity."
                    });
                }

                const convertedUsage = convertUnits(usageAmount, userUnit, matchedSupply.unit || '');
                const formattedUsage = Math.round(convertedUsage * 1000) / 1000;

                // Validate stock sufficiency for feeding
                if (actType === "feeding" && formattedUsage > matchedSupply.current_stock) {
                    return res.status(400).json({
                        error: "Insufficient stock. Please restock before logging."
                    });
                }

                // Log activity and decrement stock in DB (never allow negative stock)
                insertActivity(pet_id, activity_type, activityTimestamp, notes, (err, activityId) => {
                    if (err) {
                        return res.status(500).json({ error: "Failed to log activity" });
                    }

                    const newStock = Math.max(0, Math.round((matchedSupply.current_stock - formattedUsage) * 1000) / 1000);
                    db.run(
                        "UPDATE supplies SET current_stock = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
                        [newStock, matchedSupply.id],
                        (updateErr) => {
                            if (updateErr) {
                                console.error(`Failed to decrement supply stock for ID ${matchedSupply.id}:`, updateErr.message);
                            }
                            return res.status(201).json({
                                message: "Activity logged successfully",
                                id: activityId,
                                pet_id: pet_id,
                                activity_type: activity_type.trim(),
                                timestamp: activityTimestamp,
                                notes: notes ? notes.trim() : null,
                                updated_supply: {
                                    id: matchedSupply.id,
                                    item_name: matchedSupply.item_name,
                                    current_stock: newStock,
                                    unit: matchedSupply.unit
                                }
                            });
                        }
                    );
                });
            });
        } else {
            insertActivity(pet_id, activity_type, activityTimestamp, notes, (err, activityId) => {
                if (err) {
                    return res.status(500).json({ error: "Failed to log activity" });
                }
                return res.status(201).json({
                    message: "Activity logged successfully",
                    id: activityId,
                    pet_id: pet_id,
                    activity_type: activity_type.trim(),
                    timestamp: activityTimestamp,
                    notes: notes ? notes.trim() : null
                });
            });
        }
    });
});

// Helper functions for parsing and conversions
function parseQuantityAndUnit(notesStr) {
    if (!notesStr) return null;
    const parts = notesStr.split('•').map(p => p.trim());
    for (const part of parts) {
        const cleanPart = part.replace(/[()]/g, ' ').trim();
        const match = cleanPart.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2].toLowerCase();
            if (['g', 'kg', 'mg', 'ml', 'l', 'tablet', 'tablets', 'pill', 'pills', 'capsule', 'capsules', 'can', 'cans', 'pcs', 'pc', 'tab', 'tabs', 'dose', 'doses'].includes(unit)) {
                return { value, unit };
            }
        }
        const numMatch = cleanPart.match(/^(\d+(?:\.\d+)?)$/);
        if (numMatch) {
            const value = parseFloat(numMatch[1]);
            if (value > 0) return { value, unit: '' };
        }
    }
    return null;
}

function convertUnits(value, fromUnit, toUnit) {
    const f = (fromUnit || '').toLowerCase().trim();
    const t = (toUnit || '').toLowerCase().trim();
    if (!f || !t || f === t) return value;
    if (f === 'g' && t === 'kg') return value / 1000;
    if (f === 'kg' && t === 'g') return value * 1000;
    if (f === 'mg' && t === 'g') return value / 1000;
    if (f === 'g' && t === 'mg') return value * 1000;
    if (f === 'ml' && t === 'l') return value / 1000;
    if (f === 'l' && t === 'ml') return value * 1000;

    const countUnits = ['tablet', 'tablets', 'pill', 'pills', 'capsule', 'capsules', 'pc', 'pcs', 'tab', 'tabs', 'dose', 'doses', ''];
    if (countUnits.includes(f) && countUnits.includes(t)) return value;

    return value;
}

// PUT /api/activities/:id - Edit an activity log and adjust supply stock difference
router.put("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    const { activity_type, notes, timestamp } = req.body;

    const checkSql = `
        SELECT activities.id, activities.pet_id, activities.activity_type, activities.notes, activities.timestamp, pets.user_id 
        FROM activities 
        JOIN pets ON activities.pet_id = pets.id 
        WHERE activities.id = ? AND pets.user_id = ?
    `;
    db.get(checkSql, [id, req.user.id], (err, oldActivity) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!oldActivity) return res.status(404).json({ error: "Activity not found or access denied" });

        const pet_id = oldActivity.pet_id;
        const newActType = (activity_type || oldActivity.activity_type || "").trim();
        const newNotes = notes !== undefined ? notes.trim() : oldActivity.notes;
        const newTimestamp = timestamp ? new Date(timestamp).toISOString() : oldActivity.timestamp;

        const oldTypeLower = (oldActivity.activity_type || "").trim().toLowerCase();
        const newTypeLower = newActType.toLowerCase();

        // Check if either old or new activity involves supplies
        if (oldTypeLower === "feeding" || oldTypeLower === "medication" || newTypeLower === "feeding" || newTypeLower === "medication") {
            db.all("SELECT * FROM supplies WHERE pet_id = ?", [pet_id], (suppErr, supplies) => {
                if (suppErr) return res.status(500).json({ error: "Database error during supply check" });

                // 1. Calculate old deducted amount to restore
                let oldSupply = null;
                let oldDeducted = 0;
                if (oldTypeLower === "feeding" || oldTypeLower === "medication") {
                    const oldItemType = oldTypeLower === "feeding" ? "Food" : "Medication";
                    const oldParts = oldActivity.notes ? oldActivity.notes.split('•').map(p => p.trim()) : [];
                    const oldName = oldParts.length > 0 ? oldParts[0].toLowerCase().trim() : "";
                    const cleanOldName = oldName.split('(')[0].replace(/marked as (?:given|taken)\.?/i, '').trim();

                    oldSupply = supplies.find(s => (s.item_type || "").toLowerCase().trim() === oldItemType.toLowerCase() && (s.item_name || "").toLowerCase().trim() === oldName)
                        || supplies.find(s => (s.item_name || "").toLowerCase().trim() === oldName)
                        || (cleanOldName ? supplies.find(s => (s.item_type || "").toLowerCase().trim() === oldItemType.toLowerCase() && (s.item_name || "").toLowerCase().trim() === cleanOldName) : null)
                        || (cleanOldName ? supplies.find(s => (s.item_name || "").toLowerCase().trim() === cleanOldName) : null);

                    if (oldSupply) {
                        let usageAmount = 1;
                        let userUnit = oldSupply.unit || '';
                        const parsed = parseQuantityAndUnit(oldActivity.notes);
                        if (parsed && parsed.value > 0) {
                            usageAmount = parsed.value;
                            userUnit = parsed.unit;
                        } else if (oldParts.length > 1) {
                            const cleanPart = oldParts[1].replace(/[()]/g, '').trim();
                            const qtyMatch = cleanPart.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
                            if (qtyMatch && parseFloat(qtyMatch[1]) > 0) {
                                usageAmount = parseFloat(qtyMatch[1]);
                                if (qtyMatch[2]) userUnit = qtyMatch[2];
                            }
                        }
                        oldDeducted = Math.round(convertUnits(usageAmount, userUnit, oldSupply.unit || '') * 1000) / 1000;
                    }
                }

                // 2. Calculate new amount to deduct
                let newSupply = null;
                let newToDeduct = 0;
                if (newTypeLower === "feeding" || newTypeLower === "medication") {
                    const newItemType = newTypeLower === "feeding" ? "Food" : "Medication";
                    const newParts = newNotes ? newNotes.split('•').map(p => p.trim()) : [];
                    const newName = newParts.length > 0 ? newParts[0].toLowerCase().trim() : "";
                    const cleanNewName = newName.split('(')[0].replace(/marked as (?:given|taken)\.?/i, '').trim();

                    newSupply = supplies.find(s => (s.item_type || "").toLowerCase().trim() === newItemType.toLowerCase() && (s.item_name || "").toLowerCase().trim() === newName)
                        || supplies.find(s => (s.item_name || "").toLowerCase().trim() === newName)
                        || (cleanNewName ? supplies.find(s => (s.item_type || "").toLowerCase().trim() === newItemType.toLowerCase() && (s.item_name || "").toLowerCase().trim() === cleanNewName) : null)
                        || (cleanNewName ? supplies.find(s => (s.item_name || "").toLowerCase().trim() === cleanNewName) : null);

                    if (!newSupply) {
                        return res.status(400).json({ error: `${newItemType} not found in Supplies Stock.` });
                    }

                    let usageAmount = 1;
                    let userUnit = newSupply.unit || '';
                    const parsed = parseQuantityAndUnit(newNotes);
                    if (parsed && parsed.value > 0) {
                        usageAmount = parsed.value;
                        userUnit = parsed.unit;
                    } else if (newParts.length > 1) {
                        const cleanPart = newParts[1].replace(/[()]/g, '').trim();
                        const qtyMatch = cleanPart.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
                        if (qtyMatch && parseFloat(qtyMatch[1]) > 0) {
                            usageAmount = parseFloat(qtyMatch[1]);
                            if (qtyMatch[2]) userUnit = qtyMatch[2];
                        }
                    }
                    newToDeduct = Math.round(convertUnits(usageAmount, userUnit, newSupply.unit || '') * 1000) / 1000;

                    // Check stock sufficiency
                    const availableStock = oldSupply && oldSupply.id === newSupply.id ? (newSupply.current_stock + oldDeducted) : newSupply.current_stock;
                    if (newToDeduct > availableStock) {
                        return res.status(400).json({ error: "Insufficient stock for updated quantity." });
                    }
                }

                // Apply changes
                const updateActivitySql = "UPDATE activities SET activity_type = ?, notes = ?, timestamp = ? WHERE id = ?";
                db.run(updateActivitySql, [newActType, newNotes, newTimestamp, id], (upActErr) => {
                    if (upActErr) return res.status(500).json({ error: "Failed to update activity" });

                    // Handle supply updates
                    if (oldSupply && newSupply && oldSupply.id === newSupply.id) {
                        const updatedStock = Math.max(0, Math.round((newSupply.current_stock + oldDeducted - newToDeduct) * 1000) / 1000);
                        db.run("UPDATE supplies SET current_stock = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", [updatedStock, newSupply.id], () => {
                            return res.status(200).json({
                                message: "Activity updated successfully",
                                id,
                                pet_id,
                                activity_type: newActType,
                                notes: newNotes,
                                timestamp: newTimestamp,
                                updated_supply: { id: newSupply.id, current_stock: updatedStock }
                            });
                        });
                    } else {
                        if (oldSupply && oldDeducted > 0) {
                            const restored = Math.round((oldSupply.current_stock + oldDeducted) * 1000) / 1000;
                            db.run("UPDATE supplies SET current_stock = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", [restored, oldSupply.id]);
                        }
                        if (newSupply && newToDeduct > 0) {
                            const deducted = Math.max(0, Math.round((newSupply.current_stock - newToDeduct) * 1000) / 1000);
                            db.run("UPDATE supplies SET current_stock = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", [deducted, newSupply.id], () => {
                                return res.status(200).json({
                                    message: "Activity updated successfully",
                                    id,
                                    pet_id,
                                    activity_type: newActType,
                                    notes: newNotes,
                                    timestamp: newTimestamp,
                                    updated_supply: { id: newSupply.id, current_stock: deducted }
                                });
                            });
                        } else {
                            return res.status(200).json({
                                message: "Activity updated successfully",
                                id,
                                pet_id,
                                activity_type: newActType,
                                notes: newNotes,
                                timestamp: newTimestamp
                            });
                        }
                    }
                });
            });
        } else {
            db.run("UPDATE activities SET activity_type = ?, notes = ?, timestamp = ? WHERE id = ?", [newActType, newNotes, newTimestamp, id], (err) => {
                if (err) return res.status(500).json({ error: "Failed to update activity" });
                return res.status(200).json({
                    message: "Activity updated successfully",
                    id,
                    pet_id,
                    activity_type: newActType,
                    notes: newNotes,
                    timestamp: newTimestamp
                });
            });
        }
    });
});

// DELETE /api/activities/:id - Delete an activity log and restore supply stock if applicable
router.delete("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    console.log("\n========== UNDO FEEDING START ==========");
    console.log("Activity ID:", id, "| User ID:", req.user.id);
    
    // Verify activity ownership via pet
    const checkSql = `
        SELECT activities.id, activities.pet_id, activities.activity_type, activities.notes, activities.timestamp, pets.user_id 
        FROM activities 
        JOIN pets ON activities.pet_id = pets.id 
        WHERE activities.id = ? AND pets.user_id = ?
    `;
    db.get(checkSql, [id, req.user.id], (err, row) => {
        if (err) {
            console.log("DB ERROR during ownership check:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!row) {
            console.log("RESULT: Activity NOT FOUND or not owned by user (404)");
            return res.status(404).json({ error: "Access denied or activity not found" });
        }

        console.log("Activity found:", JSON.stringify({ id: row.id, pet_id: row.pet_id, activity_type: row.activity_type, notes: row.notes }));

        const actType = (row.activity_type || "").trim().toLowerCase();
        if (actType === "feeding" || actType === "medication") {
            const itemType = actType === "feeding" ? "Food" : "Medication";
            console.log("Activity type is:", actType, "-> looking for itemType:", itemType);

            db.all("SELECT * FROM supplies WHERE pet_id = ?", [row.pet_id], (suppErr, supplies) => {
                if (suppErr) {
                    console.error("Supplies fetch error during activity deletion:", suppErr.message);
                    return res.status(500).json({ error: "Database error during supply restoration" });
                }

                console.log("Supplies for pet", row.pet_id, ":", JSON.stringify(supplies.map(s => ({ id: s.id, item_type: s.item_type, item_name: s.item_name, current_stock: s.current_stock, unit: s.unit }))));

                const notes = row.notes || "";
                const notesParts = notes.split('•').map(p => p.trim());
                const inputName = notesParts.length > 0 ? notesParts[0].toLowerCase().trim() : "";
                const cleanInputName = inputName.split('(')[0].replace(/marked as (?:given|taken)\.?/i, '').trim();

                console.log("Notes string:", JSON.stringify(notes));
                console.log("Parsed notesParts:", JSON.stringify(notesParts));
                console.log("inputName (item name to match):", JSON.stringify(inputName));

                let matchedSupply = null;
                if (supplies && supplies.length > 0) {
                    if (inputName) {
                        matchedSupply = supplies.find(s => 
                            (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase() &&
                            (s.item_name || "").toLowerCase().trim() === inputName
                        );
                        if (matchedSupply) {
                            console.log("Matched by item_type+item_name:", matchedSupply.item_name);
                        } else {
                            matchedSupply = supplies.find(s => (s.item_name || "").toLowerCase().trim() === inputName);
                            if (matchedSupply) console.log("Matched by item_name only:", matchedSupply.item_name);
                        }
                    }
                    if (!matchedSupply && cleanInputName) {
                        matchedSupply = supplies.find(s => 
                            (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase() &&
                            (s.item_name || "").toLowerCase().trim() === cleanInputName
                        ) || supplies.find(s => (s.item_name || "").toLowerCase().trim() === cleanInputName);
                        if (matchedSupply) console.log("Matched by cleanInputName:", matchedSupply.item_name);
                    }
                    if (!matchedSupply && cleanInputName) {
                        matchedSupply = supplies.find(s => 
                            (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase() &&
                            ((s.item_name || "").toLowerCase().trim().startsWith(cleanInputName) ||
                             cleanInputName.startsWith((s.item_name || "").toLowerCase().trim()))
                        );
                        if (matchedSupply) console.log("Matched by startsWith:", matchedSupply.item_name);
                    }
                    if (!matchedSupply) {
                        const typeSupplies = supplies.filter(s => (s.item_type || "").toLowerCase().trim() === itemType.toLowerCase());
                        if (typeSupplies.length === 1) {
                            matchedSupply = typeSupplies[0];
                            console.log("Matched via single-supply fallback:", matchedSupply.item_name);
                        }
                    }
                }

                if (!matchedSupply) {
                    console.log("WARNING: No matching supply found. Will delete activity without restoring stock.");
                }

                // If a matching supply was found, calculate amount to restore
                let restoredStock = null;
                let formattedUsage = 0;
                if (matchedSupply) {
                    let usageAmount = 1;
                    let userUnit = matchedSupply.unit || '';

                    const parsed = parseQuantityAndUnit(notes);
                    console.log("parseQuantityAndUnit result:", JSON.stringify(parsed));

                    if (parsed && parsed.value > 0) {
                        usageAmount = parsed.value;
                        userUnit = parsed.unit;
                    } else if (notesParts.length > 1) {
                        const cleanPart = notesParts[1].replace(/[()]/g, '').trim();
                        const qtyMatch = cleanPart.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
                        if (qtyMatch && parseFloat(qtyMatch[1]) > 0) {
                            usageAmount = parseFloat(qtyMatch[1]);
                            if (qtyMatch[2]) userUnit = qtyMatch[2];
                        }
                    }

                    console.log("usageAmount:", usageAmount, "| userUnit:", userUnit, "| supply unit:", matchedSupply.unit);
                    const convertedUsage = convertUnits(usageAmount, userUnit, matchedSupply.unit || '');
                    formattedUsage = Math.round(convertedUsage * 1000) / 1000;
                    const currentStock = matchedSupply.current_stock;
                    restoredStock = Math.round((currentStock + formattedUsage) * 1000) / 1000;

                    console.log("Current stock BEFORE undo:", currentStock);
                    console.log("Feeding deducted quantity (formattedUsage):", formattedUsage);
                    console.log("Calculated stock AFTER undo:", restoredStock);
                }

                // Delete activity record FIRST, then restore stock
                db.run("DELETE FROM activities WHERE id = ?", [id], function(delErr) {
                    if (delErr) {
                        console.error("Error deleting activity:", delErr.message);
                        return res.status(500).json({ error: "Failed to delete activity" });
                    }
                    console.log("Activity", id, "deleted from DB.");

                    if (matchedSupply && formattedUsage > 0 && restoredStock !== null) {
                        console.log("Executing stock restoration: UPDATE supplies SET current_stock =", restoredStock, "WHERE id =", matchedSupply.id);
                        db.run(
                            "UPDATE supplies SET current_stock = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
                            [restoredStock, matchedSupply.id],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error("STOCK RESTORE FAILED for supply ID", matchedSupply.id, ":", updateErr.message);
                                } else {
                                    console.log("Stock successfully restored to", restoredStock, matchedSupply.unit, "for", matchedSupply.item_name);
                                }
                                console.log("========== UNDO FEEDING COMPLETE ==========\n");
                                return res.status(200).json({
                                    message: "Activity deleted and stock restored successfully",
                                    restored_supply: {
                                        id: matchedSupply.id,
                                        item_name: matchedSupply.item_name,
                                        current_stock: restoredStock,
                                        unit: matchedSupply.unit,
                                        restored_quantity: formattedUsage
                                    }
                                });
                            }
                        );
                    } else {
                        console.log("No stock restoration needed (no matched supply or zero quantity).");
                        console.log("========== UNDO FEEDING COMPLETE (no stock change) ==========\n");
                        return res.status(200).json({
                            message: "Activity deleted successfully"
                        });
                    }
                });
            });
        } else {
            console.log("Activity type", actType, "does not affect supplies. Deleting directly.");
            db.run("DELETE FROM activities WHERE id = ?", [id], function(err) {
                if (err) {
                    console.error("Error deleting activity:", err.message);
                    return res.status(500).json({ error: "Failed to delete activity" });
                }
                console.log("========== UNDO COMPLETE (non-supply activity) ==========\n");
                res.status(200).json({ message: "Activity deleted successfully" });
            });
        }
    });
});

module.exports = router;
