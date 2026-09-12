const express = require("express");
const router = express.Router();
const {
    createTopic,
    getTopicsByChapter,
    updateTopic,
    deleteTopic,
} = require("../controllers/topicController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createTopic);
router.get("/chapter/:chapterId", getTopicsByChapter);
router.put("/:id", authMiddleware, updateTopic);
router.delete("/:id", authMiddleware, deleteTopic);

module.exports = router;
