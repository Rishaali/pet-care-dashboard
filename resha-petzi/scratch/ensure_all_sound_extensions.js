const fs = require('fs');
const path = require('path');

const soundsDir = path.join(__dirname, '..', 'frontend', 'assets', 'sounds');

const mappings = [
    { name: 'dog', src: 'dog.ogg' },
    { name: 'cat', src: 'cat.ogg' },
    { name: 'bird', src: 'bird.ogg' },
    { name: 'chicken', src: 'chicken.ogg' },
    { name: 'fish', src: 'fish.ogg' },
    { name: 'cow', src: 'cow.ogg' },
    { name: 'goat', src: 'goat.mp3' },
    { name: 'other', src: 'other.ogg' }
];

for (const m of mappings) {
    const oggPath = path.join(soundsDir, `${m.name}.ogg`);
    const mp3Path = path.join(soundsDir, `${m.name}.mp3`);
    const srcPath = path.join(soundsDir, m.src);

    if (fs.existsSync(srcPath)) {
        if (!fs.existsSync(oggPath)) {
            fs.copyFileSync(srcPath, oggPath);
            console.log(`Copied ${m.src} to ${m.name}.ogg`);
        }
        if (!fs.existsSync(mp3Path)) {
            fs.copyFileSync(srcPath, mp3Path);
            console.log(`Copied ${m.src} to ${m.name}.mp3`);
        }
    }
}

console.log("\nFinal list of sound files in frontend/assets/sounds:");
console.log(fs.readdirSync(soundsDir));
