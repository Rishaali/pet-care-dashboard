const express = require("express");
const router = express.Router();
const db = require("../database");

// GET /api/pets - Get all pets (optionally filter by user_id)
router.get("/", (req, res) => {
    const userId = req.query.user_id;
    let sql = "SELECT * FROM pets";
    let params = [];
    if (userId) {
        sql += " WHERE user_id = ?";
        params = [userId];
    }
    sql += " ORDER BY id DESC";
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching pets:", err.message);
            return res.status(500).json({ error: "Failed to fetch pets" });
        }
        res.status(200).json(rows);
    });
});

// GET /api/pets/:id - Get a specific pet by ID
router.get("/:id", (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM pets WHERE id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error fetching pet:", err.message);
            return res.status(500).json({ error: "Failed to fetch pet details" });
        }
        if (!row) {
            return res.status(404).json({ error: "Pet not found" });
        }
        res.status(200).json(row);
    });
});

// GET /api/pets/:id/logs - Fetch all combined and isolated logs for this specific pet
router.get("/:id/logs", (req, res) => {
    const petId = req.params.id;
    const type = req.query.type; // Optional filter: Feeding, Walking, Medication

    // Check pet exists
    db.get("SELECT id, name FROM pets WHERE id = ?", [petId], (err, pet) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!pet) return res.status(404).json({ error: "Pet not found" });

        let sql = "SELECT * FROM activities WHERE pet_id = ?";
        let params = [petId];

        if (type) {
            sql += " AND LOWER(activity_type) = LOWER(?)";
            params.push(type);
        }

        sql += " ORDER BY timestamp DESC";

        db.all(sql, params, (err, activities) => {
            if (err) {
                console.error("Error fetching pet logs:", err.message);
                return res.status(500).json({ error: "Failed to fetch pet logs" });
            }
            res.status(200).json(activities);
        });
    });
});

// GET /api/pets/:id/summary - Compute pet-specific metrics (today's counts, last feeding/walking, next med)
router.get("/:id/summary", (req, res) => {
    const petId = req.params.id;
    const localDate = new Date();
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    const dateStr = req.query.date || `${yyyy}-${mm}-${dd}`;

    // Verify pet exists
    db.get("SELECT id, name FROM pets WHERE id = ?", [petId], (err, pet) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!pet) return res.status(404).json({ error: "Pet not found" });

        // Query 1: Today's activities for this pet
        const todaySql = `
            SELECT activity_type, COUNT(*) as count 
            FROM activities 
            WHERE pet_id = ? 
              AND (date(timestamp) = date(?) OR date(timestamp, 'localtime') = date(?) OR timestamp LIKE ?)
            GROUP BY activity_type
        `;
        const todayParams = [petId, dateStr, dateStr, `${dateStr}%`];

        db.all(todaySql, todayParams, (err, todayCounts) => {
            if (err) {
                console.error("Error fetching today counts:", err.message);
                return res.status(500).json({ error: "Database error" });
            }

            const counts = {
                feeding: 0,
                walking: 0,
                medication: 0
            };
            todayCounts.forEach(c => {
                const t = c.activity_type.toLowerCase();
                if (t === "feeding") counts.feeding = c.count;
                else if (t === "walking") counts.walking = c.count;
                else if (t === "medication") counts.medication = c.count;
            });

            // Query 2: Last feeding for this pet
            db.get("SELECT timestamp, notes FROM activities WHERE pet_id = ? AND LOWER(activity_type) = 'feeding' ORDER BY timestamp DESC LIMIT 1", [petId], (err, lastFeed) => {
                // Query 3: Last walk for this pet
                db.get("SELECT timestamp, notes FROM activities WHERE pet_id = ? AND LOWER(activity_type) = 'walking' ORDER BY timestamp DESC LIMIT 1", [petId], (err, lastWalk) => {
                    // Query 4: Next medication for this pet
                    db.all("SELECT id, medication_name, dosage, reminder_time, start_date, end_date FROM medications WHERE pet_id = ?", [petId], (err, meds) => {
                        res.status(200).json({
                            pet_id: petId,
                            pet_name: pet.name,
                            date: dateStr,
                            counts: counts,
                            last_feeding: lastFeed || null,
                            last_walking: lastWalk || null,
                            medications: meds || []
                        });
                    });
                });
            });
        });
    });
});

// GET /api/pets/:id/activities - Get activities for a specific pet
router.get("/:id/activities", (req, res) => {
    const petId = req.params.id;
    const type = req.query.type;
    let sql = "SELECT * FROM activities WHERE pet_id = ?";
    let params = [petId];

    if (type) {
        sql += " AND LOWER(activity_type) = LOWER(?)";
        params.push(type);
    }
    sql += " ORDER BY timestamp DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch activities" });
        res.status(200).json(rows);
    });
});

// GET /api/pets/:id/medications - Get medication schedules for a specific pet
router.get("/:id/medications", (req, res) => {
    const petId = req.params.id;
    db.all("SELECT * FROM medications WHERE pet_id = ? ORDER BY id DESC", [petId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Failed to fetch medications" });
        res.status(200).json(rows);
    });
});

// POST /api/pets - Add a new pet
router.post("/", (req, res) => {
    const {
        name, age, breed, gender, weight, owner_name, special_instructions,
        user_id, species, color, date_of_birth, vaccination_status,
        last_vaccination_date, next_vaccination_date, health_condition,
        allergies, medical_history, current_medications, microchip_number,
        emergency_contact, diet, activity_level, behavior, species_image
    } = req.body;

    if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Pet name is required and cannot be empty" });
    }

    const parsedAge = age ? parseInt(age, 10) : null;
    if (age !== undefined && age !== null && age !== "" && (isNaN(parsedAge) || parsedAge < 0)) {
        return res.status(400).json({ error: "Age must be a positive integer" });
    }

    const parsedWeight = weight ? parseFloat(weight) : null;
    if (weight !== undefined && weight !== null && weight !== "" && (isNaN(parsedWeight) || parsedWeight < 0)) {
        return res.status(400).json({ error: "Weight must be a positive number" });
    }

    const sql = `
        INSERT INTO pets (
            name, age, breed, gender, weight, owner_name, special_instructions,
            user_id, species, color, date_of_birth, vaccination_status,
            last_vaccination_date, next_vaccination_date, health_condition,
            allergies, medical_history, current_medications, microchip_number,
            emergency_contact, diet, activity_level, behavior, species_image
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        name.trim(),
        parsedAge,
        breed ? breed.trim() : null,
        gender ? gender.trim() : null,
        parsedWeight,
        owner_name ? owner_name.trim() : null,
        special_instructions ? special_instructions.trim() : null,
        user_id || null,
        species ? species.trim() : null,
        color ? color.trim() : null,
        date_of_birth || null,
        vaccination_status ? vaccination_status.trim() : null,
        last_vaccination_date || null,
        next_vaccination_date || null,
        health_condition ? health_condition.trim() : null,
        allergies ? allergies.trim() : null,
        medical_history ? medical_history.trim() : null,
        current_medications ? current_medications.trim() : null,
        microchip_number ? microchip_number.trim() : null,
        emergency_contact ? emergency_contact.trim() : null,
        diet ? diet.trim() : null,
        activity_level ? activity_level.trim() : null,
        behavior ? behavior.trim() : null,
        species_image ? species_image.trim() : null
    ];

    db.run(sql, params, function(err) {
        if (err) {
            console.error("Error adding pet:", err.message);
            return res.status(500).json({ error: "Failed to add pet information" });
        }
        res.status(201).json({
            message: "Pet profile created successfully",
            id: this.lastID
        });
    });
});

// PUT /api/pets/:id - Update an existing pet profile
router.put("/:id", (req, res) => {
    const id = req.params.id;
    const {
        name, age, breed, gender, weight, owner_name, special_instructions,
        user_id, species, color, date_of_birth, vaccination_status,
        last_vaccination_date, next_vaccination_date, health_condition,
        allergies, medical_history, current_medications, microchip_number,
        emergency_contact, diet, activity_level, behavior, species_image
    } = req.body;

    if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Pet name is required and cannot be empty" });
    }

    const parsedAge = age ? parseInt(age, 10) : null;
    if (age !== undefined && age !== null && age !== "" && (isNaN(parsedAge) || parsedAge < 0)) {
        return res.status(400).json({ error: "Age must be a positive integer" });
    }

    const parsedWeight = weight ? parseFloat(weight) : null;
    if (weight !== undefined && weight !== null && weight !== "" && (isNaN(parsedWeight) || parsedWeight < 0)) {
        return res.status(400).json({ error: "Weight must be a positive number" });
    }

    db.get("SELECT id FROM pets WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Pet not found" });

        const sql = `
            UPDATE pets
            SET name = ?, age = ?, breed = ?, gender = ?, weight = ?, owner_name = ?, special_instructions = ?,
                user_id = ?, species = ?, color = ?, date_of_birth = ?, vaccination_status = ?,
                last_vaccination_date = ?, next_vaccination_date = ?, health_condition = ?,
                allergies = ?, medical_history = ?, current_medications = ?, microchip_number = ?,
                emergency_contact = ?, diet = ?, activity_level = ?, behavior = ?, species_image = ?
            WHERE id = ?
        `;
        const params = [
            name.trim(),
            parsedAge,
            breed ? breed.trim() : null,
            gender ? gender.trim() : null,
            parsedWeight,
            owner_name ? owner_name.trim() : null,
            special_instructions ? special_instructions.trim() : null,
            user_id || null,
            species ? species.trim() : null,
            color ? color.trim() : null,
            date_of_birth || null,
            vaccination_status ? vaccination_status.trim() : null,
            last_vaccination_date || null,
            next_vaccination_date || null,
            health_condition ? health_condition.trim() : null,
            allergies ? allergies.trim() : null,
            medical_history ? medical_history.trim() : null,
            current_medications ? current_medications.trim() : null,
            microchip_number ? microchip_number.trim() : null,
            emergency_contact ? emergency_contact.trim() : null,
            diet ? diet.trim() : null,
            activity_level ? activity_level.trim() : null,
            behavior ? behavior.trim() : null,
            species_image ? species_image.trim() : null,
            id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error updating pet:", err.message);
                return res.status(500).json({ error: "Failed to update pet information" });
            }
            res.status(200).json({ message: "Pet profile updated successfully" });
        });
    });
});

// DELETE /api/pets/:id - Delete a pet
router.delete("/:id", (req, res) => {
    const id = req.params.id;
    db.get("SELECT id FROM pets WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Pet not found" });

        db.run("DELETE FROM pets WHERE id = ?", [id], (err) => {
            if (err) {
                console.error("Error deleting pet:", err.message);
                return res.status(500).json({ error: "Failed to delete pet" });
            }
            res.status(200).json({ message: "Pet deleted successfully" });
        });
    });
});

module.exports = router;
