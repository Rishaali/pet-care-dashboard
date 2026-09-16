const https = require('https');
const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, '..', 'frontend', 'assets', 'sounds');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let loc = res.headers.location;
                if (loc.startsWith('//')) loc = 'https:' + loc;
                return resolve(fetchUrl(loc));
            }
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(data) }));
        }).on('error', reject);
    });
}

async function resolveAndDownload(filename, pageUrl) {
    console.log(`Resolving ${pageUrl}...`);
    const pageRes = await fetchUrl(pageUrl);
    const html = pageRes.body.toString('utf-8');
    
    // Match any upload.wikimedia.org link
    const matches = html.match(/(https?:)?\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^\s"'>]+\.(ogg|mp3|wav)/gi) || [];
    console.log(`  Found ${matches.length} matches:`, matches);

    for (let rawUrl of matches) {
        let directUrl = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
        if (!directUrl.includes('/thumb/') && !directUrl.includes('/transcoded/')) {
            console.log(`  Attempting download from ${directUrl}...`);
            const fileRes = await fetchUrl(directUrl);
            if (fileRes.status === 200 && fileRes.body.length > 5000) {
                const fp = path.join(soundsDir, filename);
                fs.writeFileSync(fp, fileRes.body);
                console.log(`  ✓ SUCCESS! Saved ${filename} (${fileRes.body.length} bytes)`);
                return true;
            }
        }
    }
    return false;
}

async function main() {
    await resolveAndDownload('cow.ogg', 'https://commons.wikimedia.org/wiki/File:Single_Cow_Moo.ogg');
    await resolveAndDownload('fish.ogg', 'https://commons.wikimedia.org/wiki/File:Cold_water_1.ogg');

    console.log("\n==================================================");
    console.log("ALL 8 SOUND FILES STATUS IN frontend/assets/sounds:");
    const files = fs.readdirSync(soundsDir);
    let allValid = true;
    for (const f of files) {
        const fp = path.join(soundsDir, f);
        const stat = fs.statSync(fp);
        const buf = fs.readFileSync(fp);
        const headerStr = buf.slice(0, 4).toString();
        const isAudio = buf.length > 5000 && !buf.toString('utf-8', 0, 100).includes('<html');
        if (!isAudio) allValid = false;
        console.log(`  ${f}: ${stat.size} bytes — Header: '${headerStr}' — Audio Valid: ${isAudio ? '✓ YES' : '❌ NO'}`);
    }
    console.log("==================================================");
}

main();
