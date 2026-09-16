const db = require('../backend/database.js');

async function testPhotoTimelineOperations() {
    console.log("Testing Photo Timeline backend data operations...");

    // 1. Get initial pet
    db.get("SELECT id, name, species, photos FROM pets LIMIT 1", (err, pet) => {
        if (err || !pet) {
            console.error("No pet found to test:", err);
            process.exit(1);
        }

        const petId = pet.id;
        console.log(`Found test pet ID: ${petId} (${pet.name})`);

        // 2. Prepare sample photos timeline entries
        const photo1 = {
            id: "test_photo_1",
            url: "/uploads/photos/sample1.jpg",
            date: "2024-03-15",
            month: "March",
            year: "2024",
            dateLabel: "March 15, 2024",
            ageLabel: "March 15, 2024",
            caption: "First day at home",
            uploadedAt: new Date().toISOString()
        };

        const photo2 = {
            id: "test_photo_2",
            url: "/uploads/photos/sample2.jpg",
            date: "2024-08-20",
            month: "August",
            year: "2024",
            dateLabel: "August 20, 2024",
            ageLabel: "August 20, 2024",
            caption: "Birthday celebration",
            uploadedAt: new Date().toISOString()
        };

        const initialArray = [photo1, photo2];
        const initialStr = JSON.stringify(initialArray);

        // 3. Save initial photos array
        db.run("UPDATE pets SET photos = ? WHERE id = ?", [initialStr, petId], function(err) {
            if (err) {
                console.error("Failed to seed initial photos:", err);
                process.exit(1);
            }
            console.log("✓ Seeded 2 photo entries to pet photos column");

            // 4. Test updating ONLY item 1 (Item-level edit)
            db.get("SELECT photos FROM pets WHERE id = ?", [petId], (err, row) => {
                let currentPhotos = JSON.parse(row.photos);
                console.log(`Current photo count before edit: ${currentPhotos.length}`);

                const idx = currentPhotos.findIndex(p => p.id === "test_photo_1");
                currentPhotos[idx].caption = "Good memory - updated!";
                currentPhotos[idx].dateLabel = "March 15, 2024";

                const updatedStr = JSON.stringify(currentPhotos);

                db.run("UPDATE pets SET photos = ? WHERE id = ?", [updatedStr, petId], function(err) {
                    if (err) {
                        console.error("Failed edit operation:", err);
                        process.exit(1);
                    }

                    // Verify item 2 was NOT touched or deleted
                    db.get("SELECT photos FROM pets WHERE id = ?", [petId], (err, checkRow) => {
                        const verifiedPhotos = JSON.parse(checkRow.photos);
                        console.log(`Photo count after edit: ${verifiedPhotos.length}`);
                        console.log(`Photo 1 updated caption: "${verifiedPhotos[0].caption}"`);
                        console.log(`Photo 2 caption preserved: "${verifiedPhotos[1].caption}"`);

                        if (verifiedPhotos.length === 2 && verifiedPhotos[1].id === "test_photo_2") {
                            console.log("✓ SUCCESS: Item-level EDIT preserved all other timeline entries!");
                        } else {
                            console.error("❌ FAILED: Edit operation corrupted other items!");
                            process.exit(1);
                        }

                        // 5. Test item-level DELETE (deleting only photo 1)
                        const filteredPhotos = verifiedPhotos.filter(p => p.id !== "test_photo_1");
                        const filteredStr = JSON.stringify(filteredPhotos);

                        db.run("UPDATE pets SET photos = ? WHERE id = ?", [filteredStr, petId], function(err) {
                            db.get("SELECT photos FROM pets WHERE id = ?", [petId], (err, finalRow) => {
                                const finalPhotos = JSON.parse(finalRow.photos);
                                console.log(`Photo count after deleting 1 item: ${finalPhotos.length}`);
                                console.log(`Remaining photo ID: ${finalPhotos[0].id} ("${finalPhotos[0].caption}")`);

                                if (finalPhotos.length === 1 && finalPhotos[0].id === "test_photo_2") {
                                    console.log("✓ SUCCESS: Item-level DELETE removed only the target entry!");
                                    process.exit(0);
                                } else {
                                    console.error("❌ FAILED: Delete operation removed wrong items!");
                                    process.exit(1);
                                }
                            });
                        });
                    });
                });
            });
        });
    });
}

testPhotoTimelineOperations();
