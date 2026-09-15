const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");

// Connect database relative to root
const db = require("./database");

// Import route modules from routes/ folder
const petRoutes = require("./routes/petRoutes");
const activityRoutes = require("./routes/activityRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const userRoutes = require("./routes/userRoutes");
const vetRoutes = require("./routes/vetRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const assistantRoutes = require("./routes/assistantRoutes");
const supplyRoutes = require("./routes/supplyRoutes");
const vaccineRoutes = require("./routes/vaccineRoutes");
const productRoutes = require("./routes/productRoutes");
const groomingRoutes = require("./routes/groomingRoutes");
const vetVisitRoutes = require("./routes/vetVisitRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reminderScheduler = require("./services/reminderScheduler");
const app = express();
const PORT = 5500;

// Enable CORS and JSON parser
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Register API routes
app.use("/api/users", userRoutes);
app.use("/api/pets", petRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/medications", medicationRoutes.medications);
app.use("/api/medication-logs", medicationRoutes.medicationLogs);
app.use("/api/vets", vetRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/supplies", supplyRoutes);
app.use("/api/vaccinations", vaccineRoutes);
app.use("/api/products", productRoutes);
app.use("/api/grooming", groomingRoutes);
app.use("/api/vet-visits", vetVisitRoutes);
app.use("/api/notifications", notificationRoutes);

// Root route serves landing/home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

// Serve static frontend files (without auto-serving index.html on root)
app.use(express.static(path.join(__dirname, "..", "frontend"), { index: false }));

// Serve uploaded photos statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
app.get("/vets", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "vets.html"));
});
app.get("/vets.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "vets.html"));
});
app.get("/vet-details", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "vet-details.html"));
});
app.get("/vet-details.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "vet-details.html"));
});
app.get("/appointments", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "appointments.html"));
});
app.get("/appointments.html", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "appointments.html"));
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
    // Start automatic background reminder scheduler
    reminderScheduler.startScheduler(30000);
});
