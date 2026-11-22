const express = require("express");
const router = express.Router();
const {
    createTopic,
    getTopicsByChapter,
    updateTopic,
    deleteTopic,
} = require("../controllers/topicController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const imports = require("../controllers/curriculumImportController");
const excel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => (/\.xlsx$/i.test(file.originalname) ? cb(null, true) : cb(Object.assign(new Error("Upload an Excel file (.xlsx). Older .xls and .csv files are not supported; save it as .xlsx first."), { status: 400 }))) });
const { protectDelete } = require('../middleware/academicIntegrity');

router.post("/", authMiddleware, createTopic);
router.get("/import/template", authMiddleware, imports.topicTemplate);
router.post("/import", authMiddleware, excel.single("file"), imports.importTopics);
router.get("/chapter/:chapterId", getTopicsByChapter);
router.put("/:id", authMiddleware, updateTopic);
router.delete("/:id", authMiddleware, protectDelete('Topic'), deleteTopic);

module.exports = router;
