const express = require("express");
const router = express.Router();
const {
    createChapter,
    getChapters,
    updateChapter,
    deleteChapter,
} = require("../controllers/chapterController");

router.post("/", createChapter);
router.get("/", getChapters);
router.put("/:id", updateChapter);
router.delete("/:id", deleteChapter);

module.exports = router;