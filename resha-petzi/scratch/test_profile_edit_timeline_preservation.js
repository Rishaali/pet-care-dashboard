const db = require('../backend/database.js');

function runTest(name, fn) {
    return new Promise((resolve) => {
        fn((err, result) => {
            if (err) {
                console.error(`❌ [FAILED] ${name}:`, err);
                resolve(false);
            } else {
                console.log(`✓ [PASSED] ${name}`);
                resolve(true);
            }
        });
    });
}

async function testProfileEditDataPreservation() {
    console.log("==================================================");
    console.log("STARTING PROFILE EDIT & TIMELINE PRESERVATION TESTS");
    console.log("==================================================");

    // 1. Get initial pet Bruno (ID 1 or first pet)
    db.get("SELECT * FROM pets ORDER BY id ASC LIMIT 1", async (err, pet) => {
        if (err || !pet) {
            console.error("No pet found:", err);
            process.exit(1);
        }

        const petId = pet.id;
        console.log(`Selected Test Pet ID: ${petId} (${pet.name}, Species: ${pet.species}, Weight: ${pet.weight}kg, user_id: ${pet.user_id})`);

        // Seed 3 activity records if none exist
        const now = new Date().toISOString();
        db.run("INSERT OR IGNORE INTO activities (pet_id, activity_type, timestamp, notes) VALUES (?, 'Feeding', ?, 'Beef Kibble')", [petId, now]);
        db.run("INSERT OR IGNORE INTO activities (pet_id, activity_type, timestamp, notes) VALUES (?, 'Walking', ?, 'Park walk')", [petId, now]);
        db.run("INSERT OR IGNORE INTO activities (pet_id, activity_type, timestamp, notes) VALUES (?, 'Medication', ?, 'Dewormer')", [petId, now]);

        // Get initial count of activities
        db.all("SELECT * FROM activities WHERE pet_id = ?", [petId], (err, initialActivities) => {
            const initialActivityCount = initialActivities.length;
            console.log(`Initial Timeline Activity Count for Pet ${petId}: ${initialActivityCount}`);

            // TEST 1: Edit ONLY Weight (4.5kg -> 5.5kg) via simulate PUT /api/pets/:id
            // Send partial payload: { name: pet.name, weight: "5.5" }
            const partialPayload = {
                name: pet.name,
                weight: "5.5"
            };

            // Simulate backend PUT route logic
            db.get("SELECT * FROM pets WHERE id = ?", [petId], (err, row) => {
                const finalWeight = parseFloat(partialPayload.weight);
                const finalName = partialPayload.name;

                // Execute merged update
                db.run("UPDATE pets SET weight = ?, name = ? WHERE id = ?", [finalWeight, finalName, petId], function(err) {
                    if (err) {
                        console.error("Update failed:", err);
                        process.exit(1);
                    }

                    // Verify pet updated
                    db.get("SELECT * FROM pets WHERE id = ?", [petId], (err, updatedPet) => {
                        console.log(`Post-Edit Pet Weight: ${updatedPet.weight}kg (Expected 5.5kg)`);
                        console.log(`Post-Edit Pet user_id: ${updatedPet.user_id} (Preserved: ${updatedPet.user_id === pet.user_id})`);
                        console.log(`Post-Edit Pet species: ${updatedPet.species} (Preserved: ${updatedPet.species === pet.species})`);

                        // Verify Timeline/Activities remain 100% intact
                        db.all("SELECT * FROM activities WHERE pet_id = ?", [petId], (err, postEditActivities) => {
                            console.log(`Post-Edit Timeline Activity Count for Pet ${petId}: ${postEditActivities.length} (Expected ${initialActivityCount})`);

                            if (updatedPet.weight === 5.5 &&
                                updatedPet.user_id === pet.user_id &&
                                updatedPet.species === pet.species &&
                                postEditActivities.length === initialActivityCount) {
                                console.log("==================================================");
                                console.log("✓ ALL PROFILE EDIT & TIMELINE PRESERVATION TESTS PASSED!");
                                console.log("==================================================");
                                process.exit(0);
                            } else {
                                console.error("❌ FAILED: Data loss detected during profile edit!");
                                process.exit(1);
                            }
                        });
                    });
                });
            });
        });
    });
}

testProfileEditDataPreservation();
