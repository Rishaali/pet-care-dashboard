const multer = require("multer");
const path = require("path");
const fs = require("fs");

const soundsDir = path.join(__dirname, "..", "uploads", "sounds");
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, soundsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase() || ".mp3";
        cb(null, 'custom-sound-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith("audio/") || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Audio file must be a valid format (.mp3, .wav, .ogg, .m4a)"), false);
    }
};

const audioUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = audioUpload;
