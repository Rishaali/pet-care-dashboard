const express = require("express");
const db = require("../database");

const router = express.Router();

router.get("/", (req, res) => {
    const petId = req.query.pet_id;
    const type = req.query.type;
    let sql = "SELECT * FROM activities";
    const params = [];
    const filters = [];
    if (petId) { filters.push("pet_id = ?"); params.push(petId); }
    if (type) { filters.push("LOWER(activity_type) = LOWER(?)"); params.push(type); }
    if (filters.length) sql += ` WHERE ${filters.join(" AND ")}`;
    sql += " ORDER BY timestamp DESC";
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch activities" });
        res.status(200).json(rows);
    });
});

router.get("/today", (req, res) => {
    const petId = req.query.pet_id;
    const date = req.query.date;
    if (!petId || !date) return res.status(400).json({ error: "pet_id and date are required" });
    db.all("SELECT * FROM activities WHERE pet_id = ? AND (date(timestamp) = date(?) OR timestamp LIKE ?) ORDER BY timestamp DESC", [petId, date, `${date}%`], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch today's activities" });
        res.status(200).json(rows);
    });
});

router.get("/latest/:type", (req, res) => {
    const petId = req.query.pet_id;
    if (!petId) return res.status(400).json({ error: "pet_id is required" });
    db.get("SELECT * FROM activities WHERE pet_id = ? AND LOWER(activity_type) = LOWER(?) ORDER BY timestamp DESC LIMIT 1", [petId, req.params.type], (err, row) => {
        if (err) return res.status(500).json({ error: "Failed to fetch latest activity" });
        if (!row) return res.status(404).json({ error: "Activity not found" });
        res.status(200).json(row);
    });
});

router.post("/", (req, res) => {
    const { pet_id, activity_type, timestamp, notes } = req.body;
    if (!pet_id || !activity_type) return res.status(400).json({ error: "pet_id and activity_type are required" });
    db.run("INSERT INTO activities (pet_id, activity_type, timestamp, notes) VALUES (?, ?, ?, ?)", [pet_id, activity_type, timestamp || new Date().toISOString(), notes || null], function(err) {
        if (err) return res.status(500).json({ error: "Failed to create activity" });
        res.status(201).json({ id: this.lastID, message: "Activity logged successfully" });
    });
});

module.exports = router;
