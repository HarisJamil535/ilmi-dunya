const express = require("express");
const router = express.Router();
const {
    createSubject,
    getSubjects,
    updateSubject,
    deleteSubject,
} = require("../controllers/subjectController");
const authMiddleware = require("../middleware/authMiddleware");
const { protectDelete, validateWrite } = require('../middleware/academicIntegrity');
const multer = require("multer");
const mediaStore = require("../services/mediaStore");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return cb(Object.assign(new Error("Use a JPG, PNG or WebP image under 1 MB."), { status: 400 }));
    cb(null, true);
} });

router.post("/upload-image", authMiddleware, upload.single("image"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Select an image to upload." });
        res.status(201).json({ success: true, imageUrl: await mediaStore.storeImage(req.file.buffer, "subject") });
    } catch (error) { next(error); }
});

router.post("/", authMiddleware, validateWrite('Subject'), createSubject);
router.get("/", getSubjects);
router.put("/:id", authMiddleware, validateWrite('Subject'), updateSubject);
router.delete("/:id", authMiddleware, protectDelete('Subject'), deleteSubject);

module.exports = router;
