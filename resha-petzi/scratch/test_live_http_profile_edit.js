const http = require('http');

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function testLiveHTTPProfileEdit() {
    console.log("==================================================");
    console.log("LIVE HTTP TEST: PUT /api/pets/:id PROFILE EDIT");
    console.log("==================================================");

    try {
        const path = require('path');
        const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));
        const token = jwt.sign({ id: 5, email: "willi@gmail.com", name: "William" }, "super_secret_jwt_key_12345");
        console.log("✓ Generated valid JWT token for pet owner ID 5 (Milo & Bruno).");

        // 2. Fetch pets list for this user
        const petsRes = await makeRequest({
            hostname: 'localhost',
            port: 5500,
            path: '/api/pets',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (petsRes.status !== 200 || !petsRes.body || petsRes.body.length === 0) {
            console.error("Fetch pets failed:", petsRes);
            process.exit(1);
        }

        const pet = petsRes.body[0];
        const petId = pet.id;
        console.log(`✓ Fetched pet ${petId} (${pet.name}, Species: ${pet.species}, Weight: ${pet.weight}kg)`);

        // 3. Fetch initial care logs / timeline entries for this pet
        const logsBeforeRes = await makeRequest({
            hostname: 'localhost',
            port: 5500,
            path: `/api/pets/${petId}/logs?scope=all`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const countBefore = Array.isArray(logsBeforeRes.body) ? logsBeforeRes.body.length : 0;
        console.log(`✓ Initial Timeline Log Count for Pet ${petId}: ${countBefore}`);

        // 4. Send PUT request to update ONLY weight (e.g. 5.5 kg)
        const updateData = JSON.stringify({
            name: pet.name,
            weight: "6.2"
        });

        const updateRes = await makeRequest({
            hostname: 'localhost',
            port: 5500,
            path: `/api/pets/${petId}`,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(updateData)
            }
        }, updateData);

        console.log(`✓ PUT /api/pets/${petId} status: ${updateRes.status}`);

        // 5. Fetch updated pet details
        const petAfterRes = await makeRequest({
            hostname: 'localhost',
            port: 5500,
            path: `/api/pets/${petId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const petAfter = petAfterRes.body;
        console.log(`✓ Updated Pet Weight: ${petAfter.weight}kg (Expected: 6.2kg)`);
        console.log(`✓ Preserved Pet Species: ${petAfter.species} (Original: ${pet.species})`);

        // 6. Fetch Timeline logs AFTER profile edit
        const logsAfterRes = await makeRequest({
            hostname: 'localhost',
            port: 5500,
            path: `/api/pets/${petId}/logs?scope=all`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const countAfter = Array.isArray(logsAfterRes.body) ? logsAfterRes.body.length : 0;
        console.log(`✓ Post-Edit Timeline Log Count for Pet ${petId}: ${countAfter} (Expected: ${countBefore})`);

        if (updateRes.status === 200 &&
            petAfter.weight == 6.2 &&
            logsAfterRes.status === 200 &&
            countAfter === countBefore) {
            console.log("==================================================");
            console.log("✓ LIVE HTTP TEST SUCCESSFUL: TIMELINE PRESERVED INTACT!");
            console.log("==================================================");
            process.exit(0);
        } else {
            console.error("❌ FAILED: Live HTTP test detected timeline disappearance!");
            process.exit(1);
        }

    } catch (err) {
        console.error("HTTP test error:", err);
        process.exit(1);
    }
}

testLiveHTTPProfileEdit();
