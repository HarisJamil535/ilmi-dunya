const express = require("express");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { imageExtension } = require("../services/imageUpload");
const authMiddleware = require("../middleware/authMiddleware");
const {
    getQuestions,
    createQuestion,
    updateQuestion,
    updateQuestionStatus,
    deleteQuestion,
    bulkDeleteQuestions,
    getScenarios,
    createScenario,
    updateScenario,
    importPreview,
    importCommit,
    downloadImportTemplate,
    getPublicTopicQuestions,
} = require("../controllers/questionBankController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter(req, file, cb) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return cb(Object.assign(new Error("Upload a JPG, PNG or WebP image under 2 MB."), { status: 400 }));
    cb(null, true);
} });

router.get("/images/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "questionImages" });
        const file = await bucket.find({ _id: new mongoose.Types.ObjectId(req.params.id) }).next();
        if (!file) return res.sendStatus(404);
        res.type(file.metadata?.contentType || "application/octet-stream").set("Cache-Control", "public, max-age=31536000, immutable").set("Content-Length", String(file.length));
        bucket.openDownloadStream(file._id).on("error", next).pipe(res);
    } catch (error) { next(error); }
});
router.post("/images", authMiddleware, imageUpload.single("image"), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Choose a JPG, PNG or WebP image." });
        const extension = imageExtension(req.file.buffer);
        const contentType = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extension];
        if (req.file.mimetype !== contentType) return res.status(400).json({ success: false, message: "The image content does not match its file type." });
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "questionImages" });
        const stream = bucket.openUploadStream(`question-${new mongoose.Types.ObjectId()}${extension}`, { metadata: { contentType } });
        await pipeline(Readable.from([req.file.buffer]), stream);
        res.status(201).json({ success: true, imageUrl: `/api/questions/images/${stream.id}` });
    } catch (error) { next(error); }
});

router.get("/topic-questions", getPublicTopicQuestions);
router.get("/", authMiddleware, getQuestions);
router.post("/", authMiddleware, createQuestion);
router.get("/scenarios/list", authMiddleware, getScenarios);
router.post("/scenarios", authMiddleware, createScenario);
router.put("/scenarios/:id", authMiddleware, updateScenario);
router.post("/import/preview", authMiddleware, upload.single("file"), importPreview);
router.post("/import/commit", authMiddleware, importCommit);
router.get("/import/template", authMiddleware, downloadImportTemplate);
router.post("/bulk-delete", authMiddleware, bulkDeleteQuestions);
router.put("/:id", authMiddleware, updateQuestion);
router.patch("/:id/status", authMiddleware, updateQuestionStatus);
router.delete("/:id", authMiddleware, deleteQuestion);

module.exports = router;
