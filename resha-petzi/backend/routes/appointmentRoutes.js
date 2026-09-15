const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/authMiddleware");

// POST /api/appointments - Book a new appointment
router.post("/", authMiddleware, (req, res) => {
    const { pet_id, vet_id, clinic_id, disease, appointment_date, appointment_time, notes } = req.body;

    // Validation
    if (!pet_id) return res.status(400).json({ error: "Pet is required" });
    if (!vet_id) return res.status(400).json({ error: "Veterinarian is required" });
    if (!clinic_id) return res.status(400).json({ error: "Clinic is required" });
    if (!disease) return res.status(400).json({ error: "Disease/health problem is required" });
    if (!appointment_date) return res.status(400).json({ error: "Appointment date is required" });
    if (!appointment_time) return res.status(400).json({ error: "Appointment time slot is required" });

    // 1. Verify pet exists AND belongs to the authenticated user
    db.get("SELECT id FROM pets WHERE id = ? AND user_id = ?", [pet_id, req.user.id], (err, pet) => {
        if (err) return res.status(500).json({ error: "Database error verifying pet" });
        if (!pet) return res.status(404).json({ error: "Pet profile not found or does not belong to you" });

        // 2. Verify vet exists
        db.get("SELECT id FROM vets WHERE id = ?", [vet_id], (err, vet) => {
            if (err) return res.status(500).json({ error: "Database error verifying veterinarian" });
            if (!vet) return res.status(404).json({ error: "Veterinarian not found" });

            // 3. Verify clinic exists
            db.get("SELECT id FROM clinics WHERE id = ?", [clinic_id], (err, clinic) => {
                if (err) return res.status(500).json({ error: "Database error verifying clinic" });
                if (!clinic) return res.status(404).json({ error: "Clinic not found" });

                // 4. Double check slot availability (not already booked)
                const checkSql = `
                    SELECT id FROM appointments 
                    WHERE vet_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'Cancelled'
                `;
                db.get(checkSql, [vet_id, appointment_date, appointment_time], (err, row) => {
                    if (err) return res.status(500).json({ error: "Database error checking slot availability" });
                    if (row) return res.status(400).json({ error: "This appointment slot has already been booked. Please choose another slot." });

                    // 5. Insert appointment
                    const insertSql = `
                        INSERT INTO appointments (pet_id, vet_id, clinic_id, disease, appointment_date, appointment_time, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    const params = [pet_id, vet_id, clinic_id, disease, appointment_date, appointment_time, notes || ""];

                    db.run(insertSql, params, function(err) {
                        if (err) {
                            console.error("Error booking appointment:", err.message);
                            return res.status(500).json({ error: "Failed to book appointment" });
                        }

                        res.status(201).json({
                            message: "Appointment booked successfully",
                            appointment_id: this.lastID
                        });
                    });
                });
            });
        });
    });
});

// GET /api/appointments - Retrieve appointments for the authenticated user
router.get("/", authMiddleware, (req, res) => {
    const { pet_id } = req.query;

    let sql = `
        SELECT a.*, p.name AS pet_name, v.name AS vet_name, v.qualification AS vet_qualification, v.specialization AS vet_specialization, v.profile_image AS vet_image, c.name AS clinic_name, c.address AS clinic_address, c.city AS clinic_city
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        JOIN vets v ON a.vet_id = v.id
        JOIN clinics c ON a.clinic_id = c.id
        WHERE p.user_id = ?
    `;
    let params = [req.user.id];

    if (pet_id) {
        sql += " AND a.pet_id = ?";
        params.push(pet_id);
    }

    sql += " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching appointments:", err.message);
            return res.status(500).json({ error: "Failed to fetch appointments" });
        }
        res.status(200).json(rows);
    });
});

// PUT /api/appointments/:id - Update or Reschedule appointment
router.put("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    const { status, appointment_date, appointment_time, notes } = req.body;

    // Check if appointment exists and belongs to the user
    const checkUserSql = `
        SELECT a.* FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        WHERE a.id = ? AND p.user_id = ?
    `;
    db.get(checkUserSql, [id, req.user.id], (err, appointment) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!appointment) return res.status(404).json({ error: "Appointment not found or not authorized" });

        // If date/time is changing, check if new slot is already booked
        if ((appointment_date && appointment_date !== appointment.appointment_date) || 
            (appointment_time && appointment_time !== appointment.appointment_time)) {
            
            const targetDate = appointment_date || appointment.appointment_date;
            const targetTime = appointment_time || appointment.appointment_time;

            const checkSql = `
                SELECT id FROM appointments 
                WHERE vet_id = ? AND appointment_date = ? AND appointment_time = ? AND id != ? AND status != 'Cancelled'
            `;
            db.get(checkSql, [appointment.vet_id, targetDate, targetTime, id], (err, row) => {
                if (err) return res.status(500).json({ error: "Database error verifying slot" });
                if (row) return res.status(400).json({ error: "This slot is already booked by another appointment" });

                updateAppointment();
            });
        } else {
            updateAppointment();
        }

        function updateAppointment() {
            const finalStatus = status || appointment.status;
            const finalDate = appointment_date || appointment.appointment_date;
            const finalTime = appointment_time || appointment.appointment_time;
            const finalNotes = notes !== undefined ? notes : appointment.notes;

            const updateSql = `
                UPDATE appointments
                SET status = ?, appointment_date = ?, appointment_time = ?, notes = ?
                WHERE id = ?
            `;
            db.run(updateSql, [finalStatus, finalDate, finalTime, finalNotes, id], (err) => {
                if (err) {
                    console.error("Error updating appointment:", err.message);
                    return res.status(500).json({ error: "Failed to update appointment" });
                }
                res.status(200).json({ message: "Appointment updated successfully" });
            });
        }
    });
});

// DELETE /api/appointments/:id - Delete appointment
router.delete("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;

    // Verify ownership before deleting
    const checkUserSql = `
        SELECT a.id FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        WHERE a.id = ? AND p.user_id = ?
    `;
    db.get(checkUserSql, [id, req.user.id], (err, appointment) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!appointment) return res.status(404).json({ error: "Appointment not found or not authorized" });

        db.run("DELETE FROM appointments WHERE id = ?", [id], function(err) {
            if (err) {
                console.error("Error deleting appointment:", err.message);
                return res.status(500).json({ error: "Failed to delete appointment" });
            }
            res.status(200).json({ message: "Appointment deleted successfully" });
        });
    });
});

module.exports = router;
