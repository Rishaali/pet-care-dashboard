const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "..", "backend", "petcare.db");
console.log("Connecting to database at:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log("\n1. Checking Table Structure:");
    db.all("PRAGMA table_info(supplies)", [], (err, rows) => {
        if (err) {
            console.error("Failed to query table info:", err.message);
            db.close();
            process.exit(1);
        }
        if (rows.length === 0) {
            console.error("Supplies table does not exist!");
            db.close();
            process.exit(1);
        }
        console.log("Table 'supplies' columns found:");
        rows.forEach(col => {
            console.log(` - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'NULL'} (Default: ${col.dflt_value || 'None'})`);
        });

        testCrudOperations();
    });
});

function testCrudOperations() {
    console.log("\n2. Testing Insert (POST simulation):");
    
    // Find first pet
    db.get("SELECT id, name FROM pets LIMIT 1", [], (err, pet) => {
        if (err || !pet) {
            console.error("No pets found to link supply tracker to:", err ? err.message : "Empty pets table");
            db.close();
            return;
        }
        
        console.log(`Linking test supply item to pet: ${pet.name} (ID: ${pet.id})`);
        
        const insertSql = `
            INSERT INTO supplies (pet_id, item_type, item_name, unit, current_stock, usage_per_log, low_stock_threshold_days)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const insertParams = [pet.id, "Food", "Kibble Delights", "kg", 8.5, 0.25, 3];
        
        db.run(insertSql, insertParams, function(err) {
            if (err) {
                console.error("Failed to insert supply item:", err.message);
                db.close();
                return;
            }
            
            const supplyId = this.lastID;
            console.log(`Successfully created supply tracker! ID: ${supplyId}`);
            
            // Verify
            db.get("SELECT * FROM supplies WHERE id = ?", [supplyId], (err, row) => {
                if (err || !row) {
                    console.error("Failed to retrieve created supply:", err ? err.message : "Not found");
                    db.close();
                    return;
                }
                console.log("\n3. Retrieved Supply Item Details:");
                console.log(JSON.stringify(row, null, 2));
                
                // Test Restock
                console.log("\n4. Testing Restock (PUT simulation):");
                const addQty = 5.0;
                db.run("UPDATE supplies SET current_stock = current_stock + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", [addQty, supplyId], function(err) {
                    if (err) {
                        console.error("Restock failed:", err.message);
                        db.close();
                        return;
                    }
                    
                    db.get("SELECT * FROM supplies WHERE id = ?", [supplyId], (err, updatedRow) => {
                        console.log("Restocked stock levels:");
                        console.log(` - Old stock: ${row.current_stock}`);
                        console.log(` - Restocked quantity: +${addQty}`);
                        console.log(` - New stock level: ${updatedRow.current_stock} ${updatedRow.unit}`);
                        console.log(` - Last updated time: ${updatedRow.last_updated}`);
                        
                        // Clean up
                        console.log("\n5. Testing Cleanup (DELETE simulation):");
                        db.run("DELETE FROM supplies WHERE id = ?", [supplyId], function(err) {
                            if (err) {
                                console.error("Deletion failed:", err.message);
                            } else {
                                console.log(`Deleted test supply tracker with ID ${supplyId} successfully.`);
                            }
                            db.close();
                        });
                    });
                });
            });
        });
    });
}
