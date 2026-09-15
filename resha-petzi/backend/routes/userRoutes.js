const express = require("express");
const router = express.Router();
const db = require("../database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");

// POST /api/users/signup - Register a new user
router.post("/signup", (req, res) => {
    const { name, email, phone, gender, age, password, confirm_password } = req.body;

    // Validation
    if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Name is required" });
    }
    if (!email || email.trim() === "") {
        return res.status(400).json({ error: "Email is required" });
    }
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: "Invalid email address" });
    }
    if (!phone || phone.trim() === "") {
        return res.status(400).json({ error: "Phone number is required" });
    }
    if (!gender || gender.trim() === "") {
        return res.status(400).json({ error: "Gender is required" });
    }
    if (!age || isNaN(parseInt(age, 10)) || parseInt(age, 10) < 1) {
        return res.status(400).json({ error: "A valid age is required" });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (password !== confirm_password) {
        return res.status(400).json({ error: "Passwords do not match" });
    }

    // Check for existing email
    db.get("SELECT id FROM users WHERE email = ?", [email.trim().toLowerCase()], (err, existingEmail) => {
        if (err) {
            console.error("Error checking email:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (existingEmail) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }

        // Check for existing phone
        db.get("SELECT id FROM users WHERE phone = ?", [phone.trim()], async (err, existingPhone) => {
            if (err) {
                console.error("Error checking phone:", err.message);
                return res.status(500).json({ error: "Database error" });
            }
            if (existingPhone) {
                return res.status(409).json({ error: "An account with this phone number already exists" });
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);

                const sql = `
                    INSERT INTO users (name, email, phone, gender, age, password)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                const params = [
                    name.trim(),
                    email.trim().toLowerCase(),
                    phone.trim(),
                    gender.trim(),
                    parseInt(age, 10),
                    hashedPassword
                ];

                db.run(sql, params, function(err) {
                    if (err) {
                    console.error("Error creating user:", err.message);
                    if (err.message.includes("UNIQUE constraint")) {
                        return res.status(409).json({ error: "Email or phone already in use" });
                    }
                    return res.status(500).json({ error: "Failed to create account" });
                }
                res.status(201).json({
                    message: "Account created successfully",
                    token: jwt.sign(
                        { id: this.lastID, email: email.trim().toLowerCase() }, 
                        process.env.JWT_SECRET, 
                        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
                    ),
                    user: {
                        id: this.lastID,
                        name: name.trim(),
                        email: email.trim().toLowerCase()
                    }
                });
            });
            } catch (hashError) {
                console.error("Error hashing password:", hashError);
                return res.status(500).json({ error: "Error securing password" });
            }
        });
    });
});

// POST /api/users/login - Authenticate a user
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || email.trim() === "") {
        return res.status(400).json({ error: "Email is required" });
    }
    if (!password) {
        return res.status(400).json({ error: "Password is required" });
    }

    db.get("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()], async (err, user) => {
        if (err) {
            console.error("Error during login:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!user) {
            return res.status(401).json({ error: "No account found with this email address" });
        }
        
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
        } catch (e) {
            // Ignore error, might be plain text
        }
        
        if (!isMatch && user.password !== password) {
            return res.status(401).json({ error: "Incorrect password. Please try again." });
        }

        const payload = { id: user.id, email: user.email };
        const secretKey = process.env.JWT_SECRET || "petzi_secret_jwt_key_2026";
        const token = jwt.sign(payload, secretKey, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });

        res.status(200).json({
            message: "Login successful",
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                gender: user.gender,
                age: user.age
            }
        });
    });
});

// GET /api/users/:id - Get user profile
router.get("/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    
    // Enforce ownership
    if (String(req.user.id) !== String(id)) {
        return res.status(403).json({ error: "Access denied" });
    }
    
    db.get("SELECT id, name, email, phone, gender, age, created_at FROM users WHERE id = ?", [id], (err, user) => {
        if (err) {
            console.error("Error fetching user:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(user);
    });
});

module.exports = router;
