const express = require("express");
const router = express.Router();
const {
    createChapter,
    getChapters,
    updateChapter,
    deleteChapter,
} = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware");
const { protectDelete, validateWrite } = require('../middleware/academicIntegrity');

router.post("/", authMiddleware, validateWrite('Chapter'), createChapter);
router.get("/", getChapters);
router.put("/:id", authMiddleware, validateWrite('Chapter'), updateChapter);
router.delete("/:id", authMiddleware, protectDelete('Chapter'), deleteChapter);

module.exports = router;
