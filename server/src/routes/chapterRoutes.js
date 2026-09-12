const express = require("express");
const router = express.Router();
const {
    createChapter,
    getChapters,
    updateChapter,
    deleteChapter,
} = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createChapter);
router.get("/", getChapters);
router.put("/:id", authMiddleware, updateChapter);
router.delete("/:id", authMiddleware, deleteChapter);

module.exports = router;
