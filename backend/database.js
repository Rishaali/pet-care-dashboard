const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Place the SQLite database in the root folder
const dbPath = path.join(__dirname, "petcare.db");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to SQLite database at:", dbPath);
    }
});

// Use serialize to ensure tables are created sequentially
db.serialize(() => {
    // 1. Users table (NEW)
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            gender TEXT NOT NULL,
            age INTEGER NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error("Error creating users table:", err.message);
        else console.log("Users table ready.");
    });

    // 2. Pets table (original columns preserved)
    db.run(`
        CREATE TABLE IF NOT EXISTS pets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            breed TEXT,
            gender TEXT,
            weight REAL,
            owner_name TEXT,
            special_instructions TEXT
        )
    `, (err) => {
        if (err) console.error("Error creating pets table:", err.message);
    });

    // 3. Activities table
    db.run(`
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pet_id INTEGER,
            activity_type TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error("Error creating activities table:", err.message);
    });

    // 4. Medications table
    db.run(`
        CREATE TABLE IF NOT EXISTS medications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pet_id INTEGER,
            medication_name TEXT NOT NULL,
            dosage TEXT,
            frequency TEXT,
            start_date DATE,
            end_date DATE,
            reminder_time TEXT,
            notes TEXT,
            FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error("Error creating medications table:", err.message);
    });

    // 5. Medication Logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS medication_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medication_id INTEGER,
            pet_id INTEGER,
            scheduled_time DATETIME,
            given_time DATETIME,
            status TEXT,
            FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
            FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error("Error creating medication_logs table:", err.message);
        else {
            // After core tables are ready, add extended columns then seed
            addExtendedColumns();
        }
    });
});

// Safely add new columns to pets table via ALTER TABLE
// SQLite will throw error if column already exists — we catch and ignore those
function addExtendedColumns() {
    const newColumns = [
        "user_id INTEGER",
        "species TEXT",
        "color TEXT",
        "date_of_birth TEXT",
        "vaccination_status TEXT",
        "last_vaccination_date TEXT",
        "next_vaccination_date TEXT",
        "health_condition TEXT",
        "allergies TEXT",
        "medical_history TEXT",
        "current_medications TEXT",
        "microchip_number TEXT",
        "emergency_contact TEXT",
        "diet TEXT",
        "activity_level TEXT",
        "behavior TEXT",
        "species_image TEXT"
    ];

    let pending = newColumns.length;
    newColumns.forEach(colDef => {
        const colName = colDef.split(" ")[0];
        db.run(`ALTER TABLE pets ADD COLUMN ${colDef}`, (err) => {
            // Ignore "duplicate column" errors — expected on subsequent startups
            if (err && !err.message.includes("duplicate column")) {
                console.error(`Error adding column ${colName}:`, err.message);
            }
            pending--;
            if (pending === 0) {
                seedDatabase();
            }
        });
    });
}

function seedDatabase() {
    db.get("SELECT COUNT(*) AS count FROM pets", (err, row) => {
        if (err) {
            console.error("Error checking pets count:", err.message);
            return;
        }

        if (row.count === 0) {
            console.log("Database is empty. Seeding initial pet data...");

            // Insert Bruno
            const insertPetSql = `
                INSERT INTO pets (name, age, breed, gender, weight, owner_name, special_instructions, species, vaccination_status, health_condition)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(insertPetSql, [
                "Bruno", 3, "Labrador", "Male", 24.0, "Pet Owner",
                "Allergic to chicken. Do not give chicken-based food.",
                "Dog", "Vaccinated", "Healthy"
            ], function (err) {
                if (err) {
                    console.error("Error seeding pet Bruno:", err.message);
                    return;
                }

                const petId = this.lastID;
                console.log(`Seeded Bruno with ID: ${petId}`);

                // Seed some medications
                const insertMedSql = `
                    INSERT INTO medications (pet_id, medication_name, dosage, frequency, start_date, end_date, reminder_time, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.run(insertMedSql, [petId, "Antibiotic", "5 ml", "Twice a day", "2026-08-25", "2026-08-30", "09:00 AM", "Give with food"], function(err) {
                    if (err) console.error("Error seeding Antibiotic medication:", err.message);
                    else console.log("Seeded Antibiotic medication");
                });

                db.run(insertMedSql, [petId, "Vitamin Syrup", "2.5 ml", "Once a day", "2026-08-20", "2026-09-20", "08:00 PM", "Mix with food"], function(err) {
                    if (err) console.error("Error seeding Vitamin Syrup medication:", err.message);
                    else console.log("Seeded Vitamin Syrup medication");
                });

                // Seed some sample activities relative to current local time
                const now = new Date();
                const feedTime = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
                const walkTime = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
                const medTime = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();

                const insertActivitySql = `
                    INSERT INTO activities (pet_id, activity_type, timestamp, notes)
                    VALUES (?, ?, ?, ?)
                `;

                db.run(insertActivitySql, [petId, "Feeding", feedTime, "Ate full bowl of beef kibble"], (err) => {
                    if (err) console.error("Error seeding Feeding activity:", err.message);
                });
                db.run(insertActivitySql, [petId, "Walking", walkTime, "Went around the block, did his business"], (err) => {
                    if (err) console.error("Error seeding Walking activity:", err.message);
                });
                db.run(insertActivitySql, [petId, "Medication", medTime, "Antibiotic given successfully"], (err) => {
                    if (err) console.error("Error seeding Medication activity:", err.message);
                });

                console.log("Seeded activities for pet Bruno");
            });
        } else {
            console.log("Database already contains data. Seeding skipped.");
        }
    });
}

module.exports = db;
