const express = require("express");
const router = express.Router();
const {
    createSubject,
    getSubjects,
    updateSubject,
    deleteSubject,
} = require("../controllers/subjectController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { imageExtension } = require("../services/imageUpload");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return cb(Object.assign(new Error("Use a JPG, PNG or WebP image under 1 MB."), { status: 400 }));
    cb(null, true);
} });

router.post("/upload-image", authMiddleware, upload.single("image"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Select an image to upload." });
        const filename = crypto.randomUUID() + imageExtension(req.file.buffer);
        const directory = path.join(__dirname, "../../uploads/subjects");
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, filename), req.file.buffer, { flag: "wx" });
        res.status(201).json({ success: true, imageUrl: `/uploads/subjects/${filename}` });
    } catch (error) { next(error); }
});

router.post("/", authMiddleware, createSubject);
router.get("/", getSubjects);
router.put("/:id", authMiddleware, updateSubject);
router.delete("/:id", authMiddleware, deleteSubject);

module.exports = router;
