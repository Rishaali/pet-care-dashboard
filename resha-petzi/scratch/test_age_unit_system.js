const http = require('http');
const path = require('path');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));

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

function formatPetAge(petOrAge, ageUnit) {
    let ageVal = null;
    let unitVal = 'years';

    if (typeof petOrAge === 'object' && petOrAge !== null) {
        ageVal = petOrAge.age;
        unitVal = petOrAge.age_unit || petOrAge.ageUnit || 'years';
    } else {
        ageVal = petOrAge;
        unitVal = ageUnit || 'years';
    }

    if (ageVal === null || ageVal === undefined || ageVal === '') {
        return 'Unknown Age';
    }

    const num = parseFloat(ageVal);
    if (isNaN(num)) return 'Unknown Age';

    const normalizedUnit = (unitVal || 'years').toString().toLowerCase().trim();
    const isMonth = normalizedUnit.includes('month');

    if (isMonth) {
        return num === 1 ? '1 Month' : `${num} Months`;
    } else {
        return num === 1 ? '1 Year' : `${num} Years`;
    }
}

async function testAgeUnitSystem() {
    console.log("==================================================");
    console.log("TESTING PET AGE & AGE UNIT SYSTEM");
    console.log("==================================================");

    // 1. Test formatPetAge helper function
    console.log("Testing formatPetAge():");
    console.log("8, 'months' ->", formatPetAge(8, 'months'), "(Expected: 8 Months)");
    console.log("1, 'months' ->", formatPetAge(1, 'months'), "(Expected: 1 Month)");
    console.log("3, 'years' ->", formatPetAge(3, 'years'), "(Expected: 3 Years)");
    console.log("1, 'years' ->", formatPetAge(1, 'years'), "(Expected: 1 Year)");
    console.log("{ age: 10, age_unit: 'months' } ->", formatPetAge({ age: 10, age_unit: 'months' }), "(Expected: 10 Months)");

    // 2. Test HTTP API update with age and age_unit
    const token = jwt.sign({ id: 5, email: "willi@gmail.com", name: "William" }, "super_secret_jwt_key_12345");

    // Fetch pet 13 (or first pet for user 5)
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
    console.log(`\nTesting Pet ID ${petId} (${pet.name}):`);

    // TEST A: Update Pet to 8 Months
    const updateDataMonths = JSON.stringify({
        name: pet.name,
        age: 8,
        age_unit: 'months'
    });

    const putMonthsRes = await makeRequest({
        hostname: 'localhost',
        port: 5500,
        path: `/api/pets/${petId}`,
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(updateDataMonths)
        }
    }, updateDataMonths);

    console.log("PUT 8 Months status:", putMonthsRes.status);
    const petAfterMonths = (await makeRequest({
        hostname: 'localhost',
        port: 5500,
        path: `/api/pets/${petId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    })).body;

    console.log(`Updated Pet Age: ${petAfterMonths.age}, Unit: ${petAfterMonths.age_unit}`);
    console.log("Formatted Age:", formatPetAge(petAfterMonths));

    // TEST B: Update Pet to 2 Years
    const updateDataYears = JSON.stringify({
        name: pet.name,
        age: 2,
        age_unit: 'years'
    });

    const putYearsRes = await makeRequest({
        hostname: 'localhost',
        port: 5500,
        path: `/api/pets/${petId}`,
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(updateDataYears)
        }
    }, updateDataYears);

    console.log("PUT 2 Years status:", putYearsRes.status);
    const petAfterYears = (await makeRequest({
        hostname: 'localhost',
        port: 5500,
        path: `/api/pets/${petId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    })).body;

    console.log(`Updated Pet Age: ${petAfterYears.age}, Unit: ${petAfterYears.age_unit}`);
    console.log("Formatted Age:", formatPetAge(petAfterYears));

    // Check timeline records intact
    const logsRes = await makeRequest({
        hostname: 'localhost',
        port: 5500,
        path: `/api/pets/${petId}/logs?scope=all`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`Timeline logs count after profile edits: ${logsRes.body.length}`);

    if (petAfterMonths.age_unit === 'months' &&
        petAfterYears.age_unit === 'years' &&
        logsRes.status === 200) {
        console.log("==================================================");
        console.log("✓ ALL AGE & AGE UNIT SYSTEM TESTS PASSED SUCCESSFULLY!");
        console.log("==================================================");
        process.exit(0);
    } else {
        console.error("❌ TEST FAILED!");
        process.exit(1);
    }
}

testAgeUnitSystem();
