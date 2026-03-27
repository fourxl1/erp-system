const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "uploads", "items");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename(req, file, cb) {
    const safeExtension = path.extname(file.originalname || "").toLowerCase();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
    const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/bmp"]);
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (!allowed.includes(extension) || !allowedMimeTypes.has(String(file.mimetype || "").toLowerCase())) {
      return cb(new Error("Only image uploads are allowed"));
    }

    cb(null, true);
  }
});

module.exports = upload;
