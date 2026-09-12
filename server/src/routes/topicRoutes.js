const express = require("express");
const router = express.Router();
const {
    createTopic,
    getTopicsByChapter,
    updateTopic,
    deleteTopic,
} = require("../controllers/topicController");

router.post("/", createTopic);
router.get("/chapter/:chapterId", getTopicsByChapter);
router.put("/:id", updateTopic);
router.delete("/:id", deleteTopic);

module.exports = router;