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
            createVetTables();
        }
    });
});

function createVetTables() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS clinics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                city TEXT NOT NULL,
                phone TEXT,
                latitude REAL,
                longitude REAL,
                opening_time TEXT,
                closing_time TEXT
            )
        `, (err) => {
            if (err) console.error("Error creating clinics table:", err.message);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS vets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                qualification TEXT,
                specialization TEXT,
                experience INTEGER,
                rating REAL,
                review_count INTEGER DEFAULT 0,
                consultation_fee REAL,
                phone TEXT,
                email TEXT,
                clinic_id INTEGER,
                emergency_available INTEGER DEFAULT 0,
                profile_image TEXT,
                FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL
            )
        `, (err) => {
            if (err) console.error("Error creating vets table:", err.message);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS vet_services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vet_id INTEGER,
                service_name TEXT,
                FOREIGN KEY (vet_id) REFERENCES vets(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) console.error("Error creating vet_services table:", err.message);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS availability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vet_id INTEGER,
                available_date TEXT,
                start_time TEXT,
                end_time TEXT,
                FOREIGN KEY (vet_id) REFERENCES vets(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) console.error("Error creating availability table:", err.message);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pet_id INTEGER,
                vet_id INTEGER,
                clinic_id INTEGER,
                disease TEXT,
                appointment_date TEXT,
                appointment_time TEXT,
                notes TEXT,
                status TEXT DEFAULT 'Booked',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
                FOREIGN KEY (vet_id) REFERENCES vets(id) ON DELETE CASCADE,
                FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) console.error("Error creating appointments table:", err.message);
            else {
                addExtendedColumns();
            }
        });
    });
}


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
                seedVetsData();
            });
        } else {
            console.log("Database already contains data. Seeding skipped.");
            seedVetsData();
        }
    });
}

function seedVetsData() {
    db.get("SELECT COUNT(*) AS count FROM vets", (err, row) => {
        if (err) {
            console.error("Error checking vets count:", err.message);
            return;
        }
        if (row.count > 0) {
            console.log("Veterinarian data already exists. Seeding skipped.");
            return;
        }

        console.log("Seeding veterinarian & clinic data...");
        const clinicsData = [
            ["Happy Paws Veterinary Hospital", "123 Avinashi Road", "Coimbatore", "+91 98765 43210", 11.0183, 76.9725, "09:00 AM", "08:00 PM"],
            ["PetCare Clinic", "45 DB Road, R.S. Puram", "Coimbatore", "+91 98765 43211", 11.0112, 76.9456, "08:00 AM", "10:00 PM"],
            ["Animal Care Hospital", "78 Trichy Road", "Coimbatore", "+91 98765 43212", 10.9985, 77.0123, "00:00 AM", "11:59 PM"],
            ["Metro Animal Clinic", "12 Indiranagar 100ft Rd", "Bangalore", "+91 98888 77777", 12.9716, 77.5946, "09:00 AM", "07:00 PM"],
            ["Chennai Veterinary Specialty Hospital", "56 Vepery High Rd", "Chennai", "+91 94444 33333", 13.0827, 80.2707, "09:00 AM", "09:00 PM"]
        ];

        db.serialize(() => {
            // Seed clinics
            const insertClinicSql = `
                INSERT INTO clinics (name, address, city, phone, latitude, longitude, opening_time, closing_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            clinicsData.forEach(c => {
                db.run(insertClinicSql, c);
            });

            // Retrieve clinic IDs to seed vets correctly
            db.all("SELECT id, name FROM clinics", (err, clinics) => {
                if (err) {
                    console.error("Error fetching clinics for seeding vets:", err.message);
                    return;
                }

                const clinicMap = {};
                clinics.forEach(c => {
                    clinicMap[c.name] = c.id;
                });

                // Vets Data
                const vetsData = [
                    ["Dr. Priya Kumar", "BVSc & AH, MVSc (Dermatology)", "Veterinary Dermatology", 8, 4.8, 245, 500, "+91 99999 11111", "priya.k@happypaws.com", "Happy Paws Veterinary Hospital", 0, "doctor_priya.jpg"],
                    ["Dr. Arun Kumar", "BVSc & AH", "General Veterinary Medicine", 6, 4.6, 180, 400, "+91 99999 22222", "arun.k@petcare.com", "PetCare Clinic", 1, "doctor_arun.jpg"],
                    ["Dr. Meena", "BVSc, MVSc (Surgery)", "Veterinary Surgery", 10, 4.9, 320, 700, "+91 99999 33333", "meena@animalcare.com", "Animal Care Hospital", 1, "doctor_meena.jpg"],
                    ["Dr. Rohan Shah", "BVSc, MVSc (Ophthalmology)", "Veterinary Ophthalmology", 9, 4.7, 142, 600, "+91 99999 44444", "rohan.s@metrovet.com", "Metro Animal Clinic", 0, "doctor_rohan.jpg"],
                    ["Dr. Shalini Prasad", "BVSc & AH", "General Veterinary Medicine", 5, 4.4, 98, 350, "+91 99999 55555", "shalini@chennaivet.com", "Chennai Veterinary Specialty Hospital", 0, "doctor_shalini.jpg"],
                    ["Dr. Karthik Raja", "BVSc, MVSc (Orthopedics)", "Veterinary Orthopedics", 12, 4.9, 195, 800, "+91 99999 66666", "karthik.r@chennaivet.com", "Chennai Veterinary Specialty Hospital", 1, "doctor_karthik.jpg"],
                    ["Dr. Rajesh Khanna", "BVSc, MVSc (Dentistry)", "Veterinary Dentistry", 11, 4.7, 110, 550, "+91 99999 77777", "rajesh@petcare.com", "PetCare Clinic", 0, "doctor_rajesh.jpg"],
                    ["Dr. Kavitha Iyer", "BVSc, MVSc (Medicine)", "Veterinary Internal Medicine", 7, 4.5, 85, 450, "+91 99999 88888", "kavitha.i@happypaws.com", "Happy Paws Veterinary Hospital", 0, "doctor_kavitha.jpg"]
                ];

                const insertVetSql = `
                    INSERT INTO vets (name, qualification, specialization, experience, rating, review_count, consultation_fee, phone, email, clinic_id, emergency_available, profile_image)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                vetsData.forEach(v => {
                    const clinicId = clinicMap[v[9]] || null;
                    db.run(insertVetSql, [v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], clinicId, v[10], v[11]], function(err) {
                        if (err) {
                            console.error(`Error seeding vet ${v[0]}:`, err.message);
                            return;
                        }
                        const vetId = this.lastID;
                        seedServicesAndAvailability(vetId, v[2]);
                    });
                });
            });
        });
    });
}

function seedServicesAndAvailability(vetId, specialization) {
    let services = [];
    if (specialization === "Veterinary Dermatology") {
        services = ["Skin Allergy Treatment", "Infection Management", "Flea & Tick Dermatology", "Biopsy"];
    } else if (specialization === "General Veterinary Medicine") {
        services = ["Vaccinations", "General Checkups", "Fever Treatment", "Parasite Control", "Deworming"];
    } else if (specialization === "Veterinary Surgery") {
        services = ["Spay & Neuter", "Soft Tissue Surgery", "Orthopedic Surgery", "Emergency Surgery"];
    } else if (specialization === "Veterinary Ophthalmology") {
        services = ["Cataract Surgery", "Corneal Ulcer Treatment", "Eye Infection Management", "Glaucoma Screening"];
    } else if (specialization === "Veterinary Orthopedics") {
        services = ["Fracture Repair", "Joint Dislocation Treatment", "Arthritis Management", "Hip Dysplasia Surgery"];
    } else if (specialization === "Veterinary Dentistry") {
        services = ["Teeth Cleaning", "Tooth Extraction", "Gum Disease Treatment", "Oral Health Checkup"];
    } else if (specialization === "Veterinary Internal Medicine") {
        services = ["Digestive Care", "Renal Failure Management", "Endocrine Therapy", "Gastritis Treatment"];
    } else {
        services = ["General Checkup", "Pet Health Counselling"];
    }

    const insertServiceSql = "INSERT INTO vet_services (vet_id, service_name) VALUES (?, ?)";
    services.forEach(s => {
        db.run(insertServiceSql, [vetId, s]);
    });

    const insertAvailSql = "INSERT INTO availability (vet_id, available_date, start_time, end_time) VALUES (?, ?, ?, ?)";
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        db.run(insertAvailSql, [vetId, dateStr, "09:00", "12:00"]);
        db.run(insertAvailSql, [vetId, dateStr, "14:00", "17:00"]);
    }
}

module.exports = db;

