const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");

// Disease to Specialization mapping
const specializationMapping = {
    "Skin Allergy": "Veterinary Dermatology",
    "Skin Infection": "Veterinary Dermatology",
    "Fever": "General Veterinary Medicine",
    "Ear Infection": "General Veterinary Medicine",
    "Eye Infection": "Veterinary Ophthalmology",
    "Dental Problem": "Veterinary Dentistry",
    "Digestive Problem": "Veterinary Internal Medicine",
    "Bone/Joint Problem": "Veterinary Orthopedics",
    "Respiratory Problem": "General Veterinary Medicine",
    "Parasites": "General Veterinary Medicine",
    "Vaccination": "General Veterinary Medicine",
    "General Checkup": "General Veterinary Medicine",
    "Surgery": "Veterinary Surgery",
    "Emergency": "Emergency Veterinary Care",
    "Other": "General Veterinary Medicine"
};

// GET /api/vets/recommendations
// Query: disease (optional), city (optional)
router.get("/recommendations", authMiddleware, (req, res) => {
    const { disease, city } = req.query;

    if (!disease) {
        return res.status(400).json({ error: "Disease/health problem is required" });
    }
    if (!city) {
        return res.status(400).json({ error: "City/location is required" });
    }

    // Map disease to specialization
    const requiredSpecialization = specializationMapping[disease] || "General Veterinary Medicine";

    // Query vets strictly matching the selected city
    const sql = `
        SELECT v.*, c.name AS clinic_name, c.address, c.city, c.opening_time, c.closing_time,
               (SELECT COUNT(*) FROM availability a WHERE a.vet_id = v.id) AS availability_count
        FROM vets v
        JOIN clinics c ON v.clinic_id = c.id
        WHERE LOWER(c.city) = LOWER(?)
    `;

    db.all(sql, [city], (err, rows) => {
        if (err) {
            console.error("Error fetching recommendations:", err.message);
            return res.status(500).json({ error: "Failed to fetch veterinarian recommendations" });
        }

        // Score and rank vets
        const scoredVets = rows.map(vet => {
            let score = 0;
            const reasons = [];

            // 1. Specialization Match = 40 points
            if (vet.specialization === requiredSpecialization) {
                score += 40;
                reasons.push(`✓ Specializes in ${disease} (${vet.specialization})`);
            } else if (requiredSpecialization === "General Veterinary Medicine" && vet.specialization === "General Veterinary Medicine") {
                score += 40;
                reasons.push(`✓ General Veterinary practitioner`);
            } else {
                reasons.push(`✗ Different specialization (${vet.specialization})`);
            }

            // 2. Same City = 20 points
            if (vet.city && vet.city.toLowerCase() === city.toLowerCase()) {
                score += 20;
                reasons.push(`✓ Located in ${vet.city}`);
            } else if (vet.city) {
                reasons.push(`✗ Located in ${vet.city} (Not in ${city})`);
            } else {
                reasons.push(`✗ Location info unavailable`);
            }

            // 3. Rating = 15 points
            const ratingPoints = Math.round(vet.rating * 3 * 10) / 10;
            score += ratingPoints;
            reasons.push(`✓ ${vet.rating} rating (${ratingPoints}/15 points)`);

            // 4. Experience = 10 points
            const experiencePoints = Math.min(10, vet.experience);
            score += experiencePoints;
            reasons.push(`✓ ${vet.experience} years experience (${experiencePoints}/10 points)`);

            // 5. Availability = 10 points
            if (vet.availability_count > 0) {
                score += 10;
                reasons.push(`✓ Has available appointment slots`);
            } else {
                reasons.push(`✗ No availability scheduled`);
            }

            // 6. Emergency availability = 5 points
            if (vet.emergency_available === 1) {
                score += 5;
                reasons.push(`✓ Emergency care available`);
            } else {
                reasons.push(`✗ No emergency hours`);
            }

            return {
                ...vet,
                score,
                reasons,
                isBestMatch: false
            };
        });

        // Sort by score descending, then experience descending, then rating descending
        scoredVets.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.experience !== a.experience) return b.experience - a.experience;
            return b.rating - a.rating;
        });

        // Set isBestMatch for the highest scoring vet(s)
        if (scoredVets.length > 0) {
            const maxScore = scoredVets[0].score;
            if (maxScore > 40) {
                scoredVets[0].isBestMatch = true;
            }
        }

        res.status(200).json(scoredVets);
    });
});

// GET /api/vets/:id
router.get("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;

    const sql = `
        SELECT v.*, c.name AS clinic_name, c.address, c.city, c.phone AS clinic_phone, c.opening_time, c.closing_time
        FROM vets v
        LEFT JOIN clinics c ON v.clinic_id = c.id
        WHERE v.id = ?
    `;

    db.get(sql, [id], (err, vet) => {
        if (err) {
            console.error("Error fetching vet details:", err.message);
            return res.status(500).json({ error: "Failed to fetch veterinarian details" });
        }
        if (!vet) {
            return res.status(404).json({ error: "Veterinarian not found" });
        }

        // Fetch services
        db.all("SELECT service_name FROM vet_services WHERE vet_id = ?", [id], (err, services) => {
            if (err) {
                console.error("Error fetching vet services:", err.message);
                return res.status(500).json({ error: "Failed to fetch services" });
            }

            vet.services = services.map(s => s.service_name);
            res.status(200).json(vet);
        });
    });
});

// GET /api/vets/:id/availability
router.get("/:id/availability", authMiddleware, (req, res) => {
    const vetId = req.params.id;
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: "Date parameter (YYYY-MM-DD) is required" });
    }

    const availSql = `
        SELECT start_time, end_time 
        FROM availability 
        WHERE vet_id = ? AND available_date = ?
    `;

    db.all(availSql, [vetId, date], (err, shifts) => {
        if (err) {
            console.error("Error fetching availability shifts:", err.message);
            return res.status(500).json({ error: "Failed to fetch availability" });
        }

        if (shifts.length === 0) {
            return res.status(200).json([]); // No availability on this date
        }

        const bookedSql = `
            SELECT appointment_time 
            FROM appointments 
            WHERE vet_id = ? AND appointment_date = ? AND status != 'Cancelled'
        `;

        db.all(bookedSql, [vetId, date], (err, bookings) => {
            if (err) {
                console.error("Error fetching existing bookings:", err.message);
                return res.status(500).json({ error: "Failed to fetch bookings" });
            }

            const bookedTimes = bookings.map(b => b.appointment_time);

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;

            const slots = [];
            shifts.forEach(shift => {
                const [startHour, startMin] = shift.start_time.split(":").map(Number);
                const [endHour, endMin] = shift.end_time.split(":").map(Number);

                let current = new Date();
                current.setHours(startHour, startMin, 0, 0);

                const endLimit = new Date();
                endLimit.setHours(endHour, endMin, 0, 0);

                while (current < endLimit) {
                    const hh = String(current.getHours()).padStart(2, '0');
                    const mm = String(current.getMinutes()).padStart(2, '0');
                    const timeStr = `${hh}:${mm}`;

                    let isPast = false;
                    if (date === todayStr) {
                        const currentHour = now.getHours();
                        const currentMin = now.getMinutes();
                        if (current.getHours() < currentHour || (current.getHours() === currentHour && current.getMinutes() <= currentMin)) {
                            isPast = true;
                        }
                    }

                    if (!isPast && !bookedTimes.includes(timeStr)) {
                        slots.push(timeStr);
                    }

                    current.setMinutes(current.getMinutes() + 30);
                }
            });

            res.status(200).json(slots);
        });
    });
});

module.exports = router;
