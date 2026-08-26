const express = require("express");
const cors = require("cors");
const path = require("path");

// Connect database relative to root
const db = require("./database");

// Import route modules from routes/ folder
const petRoutes = require("./routes/petRoutes");
const activityRoutes = require("./routes/activityRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();
const PORT = 5000;

// Enable CORS and JSON parser
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register API routes
app.use("/api/users", userRoutes);
app.use("/api/pets", petRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/medications", medicationRoutes.medications);
app.use("/api/medication-logs", medicationRoutes.medicationLogs);

// Root route serves landing/home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

// Serve static frontend files (without auto-serving index.html on root)
app.use(express.static(path.join(__dirname, "..", "frontend"), { index: false }));

// Explicit routes for all pages
app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});
app.get("/home.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});
app.get("/auth.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "auth.html"));
});
app.get("/pets.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "pets.html"));
});
app.get("/pet.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "pet.html"));
});
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});
app.get("/index.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Fallback: serve home page for any unmatched route
app.use((req, res, next) => {
    // If it's an API call that didn't match, pass to error handler
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found" });
    }
    // Otherwise serve home page
    res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.stack);
    res.status(500).json({ error: "Something went wrong on the server" });
});

// Start Express server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
