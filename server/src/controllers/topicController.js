const Topic = require("../models/Topic");
const Chapter = require("../models/Chapter");

// Create Topic
const createTopic = async (req, res) => {
    try {
        const { name, topicNumber, chapterId, description, videoUrl } = req.body;

        if (!name || !chapterId) {
            return res.status(400).json({
                success: false,
                message: "Topic name and Chapter ID are required.",
            });
        }

        const parentChapter = await Chapter.findById(chapterId);
        if (!parentChapter) {
            return res.status(404).json({
                success: false,
                message: "Selected Chapter does not exist.",
            });
        }

        const parsedTopicNum = Number(topicNumber) || 1;

        const existingTopic = await Topic.findOne({
            chapterId,
            topicNumber: parsedTopicNum,
        });

        if (existingTopic) {
            return res.status(400).json({
                success: false,
                message: `Topic #${parsedTopicNum} already exists in this chapter.`,
            });
        }

        const newTopic = new Topic({
            name: name.trim(),
            topicNumber: parsedTopicNum,
            description: description ? description.trim() : "",
            videoUrl: videoUrl ? videoUrl.trim() : "",
            chapterId: parentChapter._id,
            subjectId: parentChapter.subjectId,
            boardId: parentChapter.boardId,
            classId: parentChapter.classId,
            groupId: parentChapter.groupId,
        });

        await newTopic.save();

        res.status(201).json({
            success: true,
            message: "Topic created successfully",
            topic: newTopic,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// Get Topics by Chapter ID
const getTopicsByChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;

        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: "Chapter not found",
            });
        }

        const topics = await Topic.find({ chapterId }).sort({ topicNumber: 1, createdAt: 1 });

        res.status(200).json({
            success: true,
            chapter,
            topics,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// Update Topic
const updateTopic = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, topicNumber, description, videoUrl } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Topic name is required.",
            });
        }

        const topic = await Topic.findById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                message: "Topic not found",
            });
        }

        const parsedTopicNum = Number(topicNumber) || 1;

        const duplicateTopic = await Topic.findOne({
            _id: { $ne: id },
            chapterId: topic.chapterId,
            topicNumber: parsedTopicNum,
        });

        if (duplicateTopic) {
            return res.status(400).json({
                success: false,
                message: `Topic #${parsedTopicNum} is already assigned to another topic in this chapter.`,
            });
        }

        topic.name = name.trim();
        topic.topicNumber = parsedTopicNum;
        topic.description = description ? description.trim() : "";
        topic.videoUrl = videoUrl ? videoUrl.trim() : "";

        await topic.save();

        res.status(200).json({
            success: true,
            message: "Topic updated successfully",
            topic,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// Delete Topic
const deleteTopic = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedTopic = await Topic.findByIdAndDelete(id);

        if (!deletedTopic) {
            return res.status(404).json({
                success: false,
                message: "Topic not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Topic deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

module.exports = {
    createTopic,
    getTopicsByChapter,
    updateTopic,
    deleteTopic,
};