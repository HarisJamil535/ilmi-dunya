const express = require("express");
const router = express.Router();
const {
    createChapter,
    getChapters,
    updateChapter,
    deleteChapter,
} = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const imports = require("../controllers/curriculumImportController");
const excel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => (/\.xlsx$/i.test(file.originalname) ? cb(null, true) : cb(Object.assign(new Error("Upload an Excel file (.xlsx). Older .xls and .csv files are not supported; save it as .xlsx first."), { status: 400 }))) });
const { protectDelete, validateWrite } = require('../middleware/academicIntegrity');

router.post("/", authMiddleware, validateWrite('Chapter'), createChapter);
router.get("/", getChapters);
router.get("/import/template", authMiddleware, imports.chapterTemplate);
router.post("/import", authMiddleware, excel.single("file"), imports.importChapters);
router.put("/:id", authMiddleware, validateWrite('Chapter'), updateChapter);
router.delete("/:id", authMiddleware, protectDelete('Chapter'), deleteChapter);

module.exports = router;
