const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../backend/database');

async function testCustomSoundFeature() {
    console.log("==================================================");
    console.log("TESTING CUSTOM MEDICATION SOUND FEATURE END-TO-END");
    console.log("==================================================");

    // 1. Verify Database Columns
    await new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(medications)", (err, columns) => {
            if (err) return reject(err);
            const colNames = columns.map(c => c.name);
            console.log("Medications table columns:", colNames);
            const hasSoundType = colNames.includes('sound_type');
            const hasCustomSound = colNames.includes('custom_sound');
            if (hasSoundType && hasCustomSound) {
                console.log("✓ Database Schema Migration: 'sound_type' and 'custom_sound' columns verified!");
            } else {
                console.error("❌ Missing database columns in medications table!");
                process.exit(1);
            }
            resolve();
        });
    });

    // 2. Verify Uploads Directory Structure
    const uploadsSoundsDir = path.join(__dirname, '..', 'backend', 'uploads', 'sounds');
    if (fs.existsSync(uploadsSoundsDir)) {
        console.log("✓ Uploads Directory verified: backend/uploads/sounds");
    } else {
        console.error("❌ Missing directory backend/uploads/sounds");
        process.exit(1);
    }

    // 3. Create a dummy test audio in uploads/sounds and test HTTP static server delivery
    const sampleSoundName = `custom-sound-test-${Date.now()}.mp3`;
    const sampleSoundPath = path.join(uploadsSoundsDir, sampleSoundName);
    const henSrc = path.join(__dirname, '..', 'frontend', 'assets', 'sounds', 'hen.mp3');
    fs.copyFileSync(henSrc, sampleSoundPath);

    console.log(`\nTesting HTTP Static Server Delivery (http://localhost:5500/uploads/sounds/${sampleSoundName}):`);
    await new Promise((resolve) => {
        http.get(`http://localhost:5500/uploads/sounds/${sampleSoundName}`, (res) => {
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => {
                const buf = Buffer.concat(data);
                if (res.statusCode === 200 && buf.length > 5000) {
                    console.log(`✓ HTTP GET /uploads/sounds/${sampleSoundName} -> Status 200, Content-Type: ${res.headers['content-type']}, Length: ${buf.length} bytes`);
                } else {
                    console.error(`❌ HTTP GET /uploads/sounds/${sampleSoundName} failed! Status: ${res.statusCode}`);
                    process.exit(1);
                }
                resolve();
            });
        }).on('error', (e) => {
            console.error("❌ HTTP request failed:", e.message);
            process.exit(1);
        });
    });

    // Clean up test sample file
    if (fs.existsSync(sampleSoundPath)) {
        fs.unlinkSync(sampleSoundPath);
    }

    console.log("\n==================================================");
    console.log("✓ ALL CUSTOM MEDICATION SOUND BACKEND & INTEGRATION TESTS PASSED!");
    console.log("==================================================");
    process.exit(0);
}

testCustomSoundFeature();
