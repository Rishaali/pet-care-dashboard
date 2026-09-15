const http = require('http');
const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, '..', 'frontend', 'assets', 'sounds');

const expectedFiles = [
    'dog.ogg',
    'cat.ogg',
    'bird.ogg',
    'hen.mp3',
    'fish.ogg',
    'cow.ogg',
    'goat.mp3',
    'other.ogg'
];

function fetchFileOverHttp(filename) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:5500/assets/sounds/${filename}`, (res) => {
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => {
                const buf = Buffer.concat(data);
                resolve({
                    status: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: buf.length,
                    body: buf
                });
            });
        }).on('error', reject);
    });
}

function determinePetSoundCategory(petOrType) {
    if (!petOrType) return "other";
    let combined = "";
    if (typeof petOrType === "string") {
        combined = petOrType.toLowerCase().trim();
    } else if (typeof petOrType === "object") {
        const species = (petOrType.species || petOrType.pet_species || petOrType.type || petOrType.petType || "").toLowerCase().trim();
        const breed = (petOrType.breed || petOrType.pet_breed || "").toLowerCase().trim();
        const name = (petOrType.name || petOrType.pet_name || "").toLowerCase().trim();
        combined = `${species} ${breed} ${name}`;
    } else {
        combined = String(petOrType).toLowerCase().trim();
    }

    if (combined.includes("dog") || combined.includes("pup") || combined.includes("canine") || combined.includes("hound") ||
        combined.includes("labrador") || combined.includes("retriever") || combined.includes("terrier") || combined.includes("bulldog")) {
        return "dog";
    }

    if (combined.includes("cat") || combined.includes("kitten") || combined.includes("kitty") || combined.includes("feline") ||
        combined.includes("tabby") || combined.includes("persian") || combined.includes("siamese")) {
        return "cat";
    }

    if (combined.includes("bird") || combined.includes("parrot") || combined.includes("canary") || 
        combined.includes("cockatiel") || combined.includes("parakeet") || combined.includes("budgie") || combined.includes("finch")) {
        return "bird";
    }

    if (combined.includes("hen") || combined.includes("chicken") || combined.includes("rooster") || combined.includes("chick")) {
        return "hen";
    }

    if (combined.includes("fish") || combined.includes("goldfish") || combined.includes("betta") || combined.includes("tetra") || combined.includes("aqua")) {
        return "fish";
    }

    if (combined.includes("cow") || combined.includes("bovine") || combined.includes("cattle") || combined.includes("bull") || combined.includes("calf")) {
        return "cow";
    }

    if (combined.includes("goat") || combined.includes("caprine") || combined.includes("kid")) {
        return "goat";
    }

    return "other";
}

async function testAudioEndToEnd() {
    console.log("==================================================");
    console.log("TESTING AUDIO ASSETS & HTTP SERVER END-TO-END");
    console.log("==================================================");

    // 1. Verify Local Files
    let allValid = true;
    for (const file of expectedFiles) {
        const filePath = path.join(soundsDir, file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Missing local sound file: ${file}`);
            allValid = false;
            continue;
        }
        const buf = fs.readFileSync(filePath);
        const headerStr = buf.slice(0, 4).toString();
        const isOgg = headerStr === 'OggS';
        const isMp3 = headerStr.startsWith('ID3') || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0);
        const isHtml = buf.toString('utf-8', 0, 100).includes('<html');

        if (isHtml || (!isOgg && !isMp3)) {
            console.error(`❌ Invalid audio format for ${file} (${buf.length} bytes, Header: '${headerStr}')`);
            allValid = false;
        } else {
            console.log(`✓ Local asset ${file}: ${buf.length} bytes, Header: '${headerStr}' (Valid Audio)`);
        }
    }

    // 2. Test HTTP Server Delivery for all files
    console.log("\nTesting HTTP endpoints (http://localhost:5500/assets/sounds/...):");
    for (const file of expectedFiles) {
        try {
            const res = await fetchFileOverHttp(file);
            if (res.status === 200 && res.contentLength > 5000) {
                console.log(`✓ HTTP GET /assets/sounds/${file} -> Status 200, Content-Type: ${res.contentType}, Length: ${res.contentLength} bytes`);
            } else {
                console.error(`❌ HTTP GET /assets/sounds/${file} failed! Status: ${res.status}, Length: ${res.contentLength}`);
                allValid = false;
            }
        } catch (e) {
            console.error(`❌ HTTP GET /assets/sounds/${file} error:`, e.message);
            allValid = false;
        }
    }

    // 3. Test Species Sound Mapping Resolution
    console.log("\nTesting Species Sound Mapping Resolution:");
    const testCases = [
        { pet: { species: 'Dog', name: 'Bruno' }, expected: 'dog' },
        { pet: { species: 'Cat', name: 'Milo' }, expected: 'cat' },
        { pet: { species: 'Bird', name: 'Tweety' }, expected: 'bird' },
        { pet: { species: 'Hen', name: 'Cluck' }, expected: 'hen' },
        { pet: { species: 'Fish', name: 'Nemo' }, expected: 'fish' },
        { pet: { species: 'Cow', name: 'Bessie' }, expected: 'cow' },
        { pet: { species: 'Goat', name: 'Billy' }, expected: 'goat' },
        { pet: { species: 'Other', name: 'Unicorn' }, expected: 'other' }
    ];

    for (const tc of testCases) {
        const resolved = determinePetSoundCategory(tc.pet);
        if (resolved === tc.expected) {
            console.log(`✓ Species '${tc.pet.species}' mapped to category '${resolved}' -> assets/sounds/${resolved === 'goat' ? 'goat.mp3' : resolved + '.ogg'}`);
        } else {
            console.error(`❌ Species '${tc.pet.species}' mapped to '${resolved}', expected '${tc.expected}'`);
            allValid = false;
        }
    }

    console.log("\n==================================================");
    if (allValid) {
        console.log("✓ ALL END-TO-END AUDIO TESTS PASSED SUCCESSFULLY!");
        console.log("==================================================");
        process.exit(0);
    } else {
        console.error("❌ AUDIO TESTS FAILED!");
        process.exit(1);
    }
}

testAudioEndToEnd();
