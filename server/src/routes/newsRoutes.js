const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const multer = require("multer");
const crypto = require('node:crypto');
const { imageExtension } = require('../services/imageUpload');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const optionalAdminMiddleware = require("../middleware/optionalAdminMiddleware");
const { getNews, getFeaturedNews, getNewsArticle, createNews, updateNews, deleteNews } = require("../controllers/newsController");

const uploadDir = path.join(__dirname, "../../uploads/news");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(Object.assign(new Error("Upload a JPG, PNG or WebP image."), { status: 400 }));
        cb(null, true);
    },
});

router.post("/upload-image", authMiddleware, upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "Please select an image." });
    const filename = crypto.randomUUID() + imageExtension(req.file.buffer);
    await fs.promises.writeFile(path.join(uploadDir, filename), req.file.buffer, { flag: 'wx' });
    const imageUrl = `/uploads/news/${filename}`;
    res.status(201).json({ success: true, imageUrl });
});

router.get("/featured", getFeaturedNews);
router.get("/", optionalAdminMiddleware, getNews);
router.get("/:slug", optionalAdminMiddleware, getNewsArticle);
router.post("/", authMiddleware, createNews);
router.put("/:id", authMiddleware, updateNews);
router.delete("/:id", authMiddleware, deleteNews);

module.exports = router;
