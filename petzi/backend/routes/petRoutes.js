const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// GET /api/pets - Get all pets (optionally filter by user_id)
router.get("/", authMiddleware, (req, res) => {
    const userId = req.user.id;
    let sql = "SELECT * FROM pets WHERE user_id = ? ORDER BY id DESC";
    let params = [userId];
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching pets:", err.message);
            return res.status(500).json({ error: "Failed to fetch pets" });
        }
        res.status(200).json(rows);
    });
});

// GET /api/pets/:id - Get a specific pet by ID
router.get("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM pets WHERE id = ?", [id], (err, row) => {
        if (err) {
            console.error("Error fetching pet:", err.message);
            return res.status(500).json({ error: "Failed to fetch pet details" });
        }
        if (!row) {
            return res.status(404).json({ error: "Pet not found" });
        }
        if (String(row.user_id) !== String(req.user.id)) {
            return res.status(403).json({ error: "Access denied" });
        }
        res.status(200).json(row);
    });
});

// GET /api/pets/:id/logs - Fetch all combined and isolated logs for this specific pet (supports 24-hour day filter)
router.get("/:id/logs", authMiddleware, (req, res) => {
    const petId = req.params.id;
    const type = req.query.type; // Optional filter: Feeding, Walking, Medication
    const scope = req.query.scope; // Optional: 'today', 'all'
    let dateStr = req.query.date;  // Optional: 'YYYY-MM-DD' or 'today'

    if (dateStr === "today" || scope === "today") {
        const localDate = new Date();
        const yyyy = localDate.getFullYear();
        const mm = String(localDate.getMonth() + 1).padStart(2, '0');
        const dd = String(localDate.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
    }

    // Check pet exists and verify ownership
    db.get("SELECT id, name, user_id FROM pets WHERE id = ?", [petId], (err, pet) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!pet) return res.status(404).json({ error: "Pet not found" });
        if (String(pet.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

        let sql = "SELECT * FROM activities WHERE pet_id = ?";
        let params = [petId];

        if (type) {
            sql += " AND LOWER(activity_type) = LOWER(?)";
            params.push(type);
        }

        if (dateStr) {
            sql += " AND (date(timestamp) = date(?) OR date(timestamp, 'localtime') = date(?) OR timestamp LIKE ?)";
            params.push(dateStr, dateStr, `${dateStr}%`);
        }

        sql += " ORDER BY timestamp DESC";

        db.all(sql, params, (err, activities) => {
            if (err) {
                console.error("Error fetching pet logs:", err.message);
                return res.status(500).json({ error: "Failed to fetch pet logs" });
            }

            if (dateStr) {
                // Secondary timezone filter to guarantee clean 24-hour cycle boundary
                const filtered = activities.filter(row => {
                    if (!row.timestamp) return false;
                    const itemDate = new Date(row.timestamp);
                    const y = itemDate.getFullYear();
                    const m = String(itemDate.getMonth() + 1).padStart(2, '0');
                    const d = String(itemDate.getDate()).padStart(2, '0');
                    const itemDateStr = `${y}-${m}-${d}`;
                    return itemDateStr === dateStr || row.timestamp.startsWith(dateStr);
                });
                return res.status(200).json(filtered);
            }

            res.status(200).json(activities);
        });
    });
});

// GET /api/pets/:id/summary - Compute pet-specific metrics (today's counts, last feeding/walking, next med)
router.get("/:id/summary", authMiddleware, (req, res) => {
    const petId = req.params.id;
    const localDate = new Date();
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    const dateStr = req.query.date || `${yyyy}-${mm}-${dd}`;

    // Verify pet exists and check ownership
    db.get("SELECT id, name, user_id FROM pets WHERE id = ?", [petId], (err, pet) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!pet) return res.status(404).json({ error: "Pet not found" });
        if (String(pet.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

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
                medication: 0,
                grooming: 0,
                water: 0,
                exercise: 0,
                health: 0,
                other: 0
            };
            todayCounts.forEach(c => {
                const t = (c.activity_type || '').toLowerCase();
                if (t === "feeding" || t === "food" || t === "feed") counts.feeding += c.count;
                else if (t === "walking" || t === "walk") counts.walking += c.count;
                else if (t === "medication" || t === "medicine") counts.medication += c.count;
                else if (t === "grooming" || t === "bath" || t === "nail trim" || t === "brushing") counts.grooming += c.count;
                else if (t === "water" || t === "hydration") counts.water += c.count;
                else if (t === "exercise" || t === "play") counts.exercise += c.count;
                else if (t.includes("health") || t.includes("vet")) counts.health += c.count;
                else counts.other += c.count;
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
router.get("/:id/activities", authMiddleware, (req, res) => {
    const petId = req.params.id;
    
    db.get("SELECT user_id FROM pets WHERE id = ?", [petId], (err, pet) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!pet) return res.status(404).json({ error: "Pet not found" });
        if (String(pet.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

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
});

// GET /api/pets/:id/medications - Get medication schedules for a specific pet
router.get("/:id/medications", authMiddleware, (req, res) => {
    const petId = req.params.id;
    db.get("SELECT user_id FROM pets WHERE id = ?", [petId], (err, pet) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!pet) return res.status(404).json({ error: "Pet not found" });
        if (String(pet.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

        db.all("SELECT * FROM medications WHERE pet_id = ? ORDER BY id DESC", [petId], (err, rows) => {
            if (err) return res.status(500).json({ error: "Failed to fetch medications" });
            res.status(200).json(rows);
        });
    });
});

// POST /api/pets - Add a new pet
router.post("/", authMiddleware, upload.single("image"), (req, res) => {
    const {
        name, age, age_unit, ageUnit, breed, gender, weight, owner_name, special_instructions,
        species, color, date_of_birth, vaccination_status,
        last_vaccination_date, next_vaccination_date, health_condition,
        emergency_contact, diet, activity_level, behavior, species_image, photos,
        allergies, medical_history, current_medications, microchip_number
    } = req.body;

    const user_id = req.user.id;

    const validSpecies = ["Dog", "Cat", "Bird", "Hen", "Fish", "Cow", "Goat", "Other"];
    if (!species || species.trim() === "" || !validSpecies.includes(species.trim())) {
        return res.status(400).json({ error: "Pet type is required and must be one of: Dog, Cat, Bird, Hen, Fish, Cow, Goat, Other" });
    }

    if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Pet name is required" });
    }

    if (!breed || breed.trim() === "") {
        return res.status(400).json({ error: "Breed is required" });
    }

    const parsedAge = age ? parseFloat(age) : null;
    if (age === undefined || age === null || age === "" || isNaN(parsedAge) || parsedAge <= 0) {
        return res.status(400).json({ error: "Age is required and must be a valid positive number" });
    }

    const rawAgeUnit = age_unit || ageUnit || 'years';
    const finalAgeUnit = ['months', 'years'].includes(String(rawAgeUnit).toLowerCase().trim()) ? String(rawAgeUnit).toLowerCase().trim() : 'years';

    if (!gender || gender.trim() === "") {
        return res.status(400).json({ error: "Gender is required" });
    }

    const parsedWeight = weight ? parseFloat(weight) : null;
    if (weight === undefined || weight === null || weight === "" || isNaN(parsedWeight) || parsedWeight <= 0) {
        return res.status(400).json({ error: "Weight is required and must be a valid positive number" });
    }

    if (!color || color.trim() === "") {
        return res.status(400).json({ error: "Color / Markings is required" });
    }

    if (!date_of_birth || date_of_birth.trim() === "" || isNaN(Date.parse(date_of_birth))) {
        return res.status(400).json({ error: "Date of birth is required and must be a valid date" });
    }

    const sql = `
        INSERT INTO pets (
            name, age, age_unit, breed, gender, weight, owner_name, special_instructions,
            user_id, species, color, date_of_birth, vaccination_status,
            last_vaccination_date, next_vaccination_date, health_condition,
            allergies, medical_history, current_medications, microchip_number,
            emergency_contact, diet, activity_level, behavior, species_image, photos
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        name.trim(),
        parsedAge,
        finalAgeUnit,
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
        req.file ? `/uploads/photos/${req.file.filename}` : (species_image ? species_image.trim() : null),
        photos ? photos : null
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

// PUT /api/pets/:id - Update an existing pet profile cleanly without data loss
router.put("/:id", authMiddleware, upload.single("image"), (req, res) => {
    const id = req.params.id;
    const {
        name, age, age_unit, ageUnit, breed, gender, weight, owner_name, special_instructions,
        species, color, date_of_birth, vaccination_status,
        last_vaccination_date, next_vaccination_date, health_condition,
        emergency_contact, diet, activity_level, behavior, species_image, photos,
        allergies, medical_history, current_medications, microchip_number
    } = req.body;
    
    const user_id = req.user ? req.user.id : null;

    db.get("SELECT * FROM pets WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Pet not found" });
        if (user_id && String(row.user_id) !== String(user_id)) {
            return res.status(403).json({ error: "Access denied" });
        }

        const parsedAge = (age !== undefined && age !== null && age !== "") ? parseFloat(age) : row.age;
        const finalAge = (!isNaN(parsedAge) && parsedAge >= 0) ? parsedAge : row.age;

        const rawAgeUnit = age_unit || ageUnit;
        const finalAgeUnit = (rawAgeUnit !== undefined && rawAgeUnit !== null) ? (['months', 'years'].includes(String(rawAgeUnit).toLowerCase().trim()) ? String(rawAgeUnit).toLowerCase().trim() : 'years') : (row.age_unit || row.ageUnit || 'years');

        const parsedWeight = (weight !== undefined && weight !== null && weight !== "") ? parseFloat(weight) : row.weight;
        const finalWeight = (!isNaN(parsedWeight) && parsedWeight >= 0) ? parsedWeight : row.weight;

        const finalName = (name !== undefined && name !== null && name.trim() !== "") ? name.trim() : row.name;
        const finalBreed = breed !== undefined ? (breed !== null ? breed.trim() : null) : row.breed;
        const finalGender = gender !== undefined ? (gender !== null ? gender.trim() : null) : row.gender;
        const finalOwner = owner_name !== undefined ? (owner_name !== null ? owner_name.trim() : null) : row.owner_name;
        const finalInstructions = special_instructions !== undefined ? (special_instructions !== null ? special_instructions.trim() : null) : row.special_instructions;
        const finalUserId = row.user_id || user_id;
        const finalSpecies = species !== undefined ? (species !== null ? species.trim() : null) : row.species;
        const finalColor = color !== undefined ? (color !== null ? color.trim() : null) : row.color;
        const finalDOB = date_of_birth !== undefined ? (date_of_birth !== null ? date_of_birth.trim() : null) : row.date_of_birth;
        const finalVacStatus = vaccination_status !== undefined ? (vaccination_status !== null ? vaccination_status.trim() : null) : row.vaccination_status;
        const finalLastVac = last_vaccination_date !== undefined ? (last_vaccination_date !== null ? last_vaccination_date.trim() : null) : row.last_vaccination_date;
        const finalNextVac = next_vaccination_date !== undefined ? (next_vaccination_date !== null ? next_vaccination_date.trim() : null) : row.next_vaccination_date;
        const finalHealth = health_condition !== undefined ? (health_condition !== null ? health_condition.trim() : null) : row.health_condition;
        const finalAllergies = allergies !== undefined ? (allergies !== null ? allergies.trim() : null) : row.allergies;
        const finalHistory = medical_history !== undefined ? (medical_history !== null ? medical_history.trim() : null) : row.medical_history;
        const finalMeds = current_medications !== undefined ? (current_medications !== null ? current_medications.trim() : null) : row.current_medications;
        const finalMicrochip = microchip_number !== undefined ? (microchip_number !== null ? microchip_number.trim() : null) : row.microchip_number;
        const finalEmergency = emergency_contact !== undefined ? (emergency_contact !== null ? emergency_contact.trim() : null) : row.emergency_contact;
        const finalDiet = diet !== undefined ? (diet !== null ? diet.trim() : null) : row.diet;
        const finalActivity = activity_level !== undefined ? (activity_level !== null ? activity_level.trim() : null) : row.activity_level;
        const finalBehavior = behavior !== undefined ? (behavior !== null ? behavior.trim() : null) : row.behavior;
        
        let finalSpeciesImg = row.species_image;
        if (req.file) {
            finalSpeciesImg = `/uploads/photos/${req.file.filename}`;
        } else if (species_image !== undefined && species_image !== null && species_image.trim() !== "") {
            finalSpeciesImg = species_image.trim();
        }

        let finalPhotos = row.photos;
        if (photos !== undefined && photos !== null) {
            finalPhotos = typeof photos === 'string' ? photos : JSON.stringify(photos);
        }

        const sql = `
            UPDATE pets
            SET name = ?, age = ?, age_unit = ?, breed = ?, gender = ?, weight = ?, owner_name = ?, special_instructions = ?,
                user_id = ?, species = ?, color = ?, date_of_birth = ?, vaccination_status = ?,
                last_vaccination_date = ?, next_vaccination_date = ?, health_condition = ?,
                allergies = ?, medical_history = ?, current_medications = ?, microchip_number = ?,
                emergency_contact = ?, diet = ?, activity_level = ?, behavior = ?, species_image = ?, photos = ?
            WHERE id = ?
        `;
        const params = [
            finalName,
            finalAge,
            finalAgeUnit,
            finalBreed,
            finalGender,
            finalWeight,
            finalOwner,
            finalInstructions,
            finalUserId,
            finalSpecies,
            finalColor,
            finalDOB,
            finalVacStatus,
            finalLastVac,
            finalNextVac,
            finalHealth,
            finalAllergies,
            finalHistory,
            finalMeds,
            finalMicrochip,
            finalEmergency,
            finalDiet,
            finalActivity,
            finalBehavior,
            finalSpeciesImg,
            finalPhotos,
            id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error updating pet:", err.message);
                return res.status(500).json({ error: "Failed to update pet information" });
            }
            db.get("SELECT * FROM pets WHERE id = ?", [id], (err, updatedPet) => {
                res.status(200).json({
                    message: "Pet profile updated successfully",
                    pet: updatedPet || { id, name: finalName }
                });
            });
        });
    });
});

// DELETE /api/pets/:id - Delete a pet
router.delete("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    db.get("SELECT id, user_id FROM pets WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Pet not found" });
        if (String(row.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

        db.run("DELETE FROM pets WHERE id = ?", [id], (err) => {
            if (err) {
                console.error("Error deleting pet:", err.message);
                return res.status(500).json({ error: "Failed to delete pet" });
            }
            res.status(200).json({ message: "Pet deleted successfully" });
        });
    });
});

// POST /api/pets/:id/photos - Upload a photo for a pet
router.post("/:id/photos", authMiddleware, upload.single("photo"), (req, res) => {
    const petId = req.params.id;
    const { date, month, year, dateLabel, ageLabel, caption } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: "Photo file is required" });
    }

    const photoUrl = `/uploads/photos/${req.file.filename}`;

    db.get("SELECT id, user_id, photos FROM pets WHERE id = ?", [petId], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Pet not found" });
        if (String(row.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

        let parsedPhotos = [];
        if (row.photos) {
            try {
                parsedPhotos = typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos;
                if (!Array.isArray(parsedPhotos)) parsedPhotos = [];
            } catch (e) {
                parsedPhotos = [];
            }
        }

        const newPhoto = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
            url: photoUrl,
            date: date || "",
            month: month || "",
            year: year || "",
            dateLabel: dateLabel || ageLabel || "Photo",
            ageLabel: ageLabel || dateLabel || "Photo",
            caption: caption || "",
            uploadedAt: new Date().toISOString()
        };

        parsedPhotos.push(newPhoto);

        const updatedPhotosStr = JSON.stringify(parsedPhotos);

        db.run("UPDATE pets SET photos = ? WHERE id = ?", [updatedPhotosStr, petId], function(err) {
            if (err) {
                console.error("Error saving photo metadata:", err.message);
                return res.status(500).json({ error: "Failed to save photo metadata" });
            }
            res.status(201).json({
                message: "Photo uploaded successfully",
                photo: newPhoto,
                photos: updatedPhotosStr
            });
        });
    });
});

// PUT /api/pets/:id/photos/:photoId - Edit a single photo timeline entry
router.put("/:id/photos/:photoId", authMiddleware, upload.single("photo"), (req, res) => {
    const { id: petId, photoId } = req.params;
    const { date, month, year, dateLabel, ageLabel, caption } = req.body;

    db.get("SELECT id, user_id, photos FROM pets WHERE id = ?", [petId], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Pet not found" });
        if (String(row.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

        let parsedPhotos = [];
        if (row.photos) {
            try {
                parsedPhotos = typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos;
                if (!Array.isArray(parsedPhotos)) parsedPhotos = [];
            } catch (e) {
                parsedPhotos = [];
            }
        }

        const itemIndex = parsedPhotos.findIndex(p => String(p.id) === String(photoId));
        if (itemIndex === -1) {
            return res.status(404).json({ error: "Photo timeline entry not found" });
        }

        const existingItem = parsedPhotos[itemIndex];
        const newPhotoUrl = req.file ? `/uploads/photos/${req.file.filename}` : existingItem.url;

        parsedPhotos[itemIndex] = {
            ...existingItem,
            url: newPhotoUrl,
            date: date !== undefined ? date : (existingItem.date || ""),
            month: month !== undefined ? month : (existingItem.month || ""),
            year: year !== undefined ? year : (existingItem.year || ""),
            dateLabel: dateLabel || ageLabel || existingItem.dateLabel || existingItem.ageLabel || "Photo",
            ageLabel: ageLabel || dateLabel || existingItem.ageLabel || existingItem.dateLabel || "Photo",
            caption: caption !== undefined ? caption : (existingItem.caption || ""),
            updatedAt: new Date().toISOString()
        };

        const updatedPhotosStr = JSON.stringify(parsedPhotos);

        db.run("UPDATE pets SET photos = ? WHERE id = ?", [updatedPhotosStr, petId], function(err) {
            if (err) {
                console.error("Error updating photo metadata:", err.message);
                return res.status(500).json({ error: "Failed to update photo metadata" });
            }
            res.status(200).json({
                message: "Photo entry updated successfully",
                photo: parsedPhotos[itemIndex],
                photos: updatedPhotosStr
            });
        });
    });
});

// DELETE /api/pets/:id/photos/:photoId - Delete a single photo timeline entry
router.delete("/:id/photos/:photoId", authMiddleware, (req, res) => {
    const { id: petId, photoId } = req.params;

    db.get("SELECT id, user_id, photos FROM pets WHERE id = ?", [petId], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Pet not found" });
        if (String(row.user_id) !== String(req.user.id)) return res.status(403).json({ error: "Access denied" });

        let parsedPhotos = [];
        if (row.photos) {
            try {
                parsedPhotos = typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos;
                if (!Array.isArray(parsedPhotos)) parsedPhotos = [];
            } catch (e) {
                parsedPhotos = [];
            }
        }

        const initialLength = parsedPhotos.length;
        const updatedPhotos = parsedPhotos.filter(p => String(p.id) !== String(photoId));

        if (updatedPhotos.length === initialLength) {
            return res.status(404).json({ error: "Photo entry not found" });
        }

        const updatedPhotosStr = JSON.stringify(updatedPhotos);

        db.run("UPDATE pets SET photos = ? WHERE id = ?", [updatedPhotosStr, petId], function(err) {
            if (err) {
                console.error("Error deleting photo entry:", err.message);
                return res.status(500).json({ error: "Failed to delete photo entry" });
            }
            res.status(200).json({
                message: "Photo entry deleted successfully",
                photos: updatedPhotosStr
            });
        });
    });
});

// DELETE /api/pets/:id/logs/:logId - Alias route for activity log deletion
router.delete("/:id/logs/:logId", authMiddleware, (req, res) => {
    const { logId } = req.params;
    const checkSql = `
        SELECT activities.id 
        FROM activities 
        JOIN pets ON activities.pet_id = pets.id 
        WHERE activities.id = ? AND pets.user_id = ?
    `;
    db.get(checkSql, [logId, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(403).json({ error: "Access denied or activity not found" });

        db.run("DELETE FROM activities WHERE id = ?", [logId], function(err) {
            if (err) {
                console.error("Error deleting activity:", err.message);
                return res.status(500).json({ error: "Failed to delete activity" });
            }
            res.status(200).json({ message: "Activity deleted successfully" });
        });
    });
});

module.exports = router;
