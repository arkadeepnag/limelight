// middleware/upload.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload folder exists
const uploadPath = 'profile/';
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        cb(null, base + '-' + Date.now() + ext);
    }
});

const upload = multer({ storage });
export default upload;
