const { publication, safeUrl, fail } = require("../services/publishing");
const Topic = require("../models/Topic");
const Chapter = require("../models/Chapter");

// Create Topic
const createTopic = async (req, res, next) => {
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

        if (videoUrl && !safeUrl(videoUrl)) fail("Enter a valid HTTP or HTTPS video URL.");
        const parsedTopicNum = String(topicNumber || "1").trim();

        if (!/^\d+(\.\d+)*$/.test(parsedTopicNum)) {
            return res.status(400).json({
                success: false,
                message: "Use a topic number such as 2, 2.3 or 2.3.5.",
            });
        }

        const existingTopic = await Topic.findOne({
            chapterId,
             $expr: { $eq: [{ $toString: "$topicNumber" }, parsedTopicNum] },
        });

        if (existingTopic) {
            return res.status(400).json({
                success: false,
                message: `Topic #${parsedTopicNum} already exists in this chapter.`,
            });
        }

        const newTopic = new Topic({
            ...publication(req.body),
            name: name.trim(),
            topicNumber: parsedTopicNum,
            description: description ? description.trim() : "",
            videoUrl: videoUrl ? videoUrl.trim() : "",
            chapterId: parentChapter._id,
            subjectId: parentChapter.subject,
            boardId: parentChapter.board,
            classId: parentChapter.class,
            groupId: parentChapter.group,
        });

        await newTopic.save();

        res.status(201).json({
            success: true,
            message: "Topic created successfully",
            topic: newTopic,
        });
    } catch (error) {
        next(error);
    }
};

// Get Topics by Chapter ID
const getTopicsByChapter = async (req, res, next) => {
    try {
        const { chapterId } = req.params;

        const chapter = await Chapter.findById(chapterId).populate(["board", "class", "group", "subject"]);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: "Chapter not found",
            });
        }

        const topics = await Topic.find({ chapterId });
        topics.sort((a, b) => String(a.topicNumber).localeCompare(String(b.topicNumber), undefined, { numeric: true }));

        res.status(200).json({
            success: true,
            chapter,
            topics,
        });
    } catch (error) {
        next(error);
    }
};

// Update Topic
const updateTopic = async (req, res, next) => {
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

        if (videoUrl && !safeUrl(videoUrl)) fail("Enter a valid HTTP or HTTPS video URL.");
        const parsedTopicNum = String(topicNumber || "1").trim();

        if (!/^\d+(\.\d+)*$/.test(parsedTopicNum)) {
            return res.status(400).json({
                success: false,
                message: "Use a topic number such as 2, 2.3 or 2.3.5.",
            });
        }

        const duplicateTopic = await Topic.findOne({
            _id: { $ne: id },
            chapterId: topic.chapterId,
             $expr: { $eq: [{ $toString: "$topicNumber" }, parsedTopicNum] },
        });

        if (duplicateTopic) {
            return res.status(400).json({
                success: false,
                message: `Topic #${parsedTopicNum} is already assigned to another topic in this chapter.`,
            });
        }

        Object.assign(topic, publication(req.body));
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
        next(error);
    }
};

// Delete Topic
const deleteTopic = async (req, res, next) => {
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
        next(error);
    }
};

module.exports = {
    createTopic,
    getTopicsByChapter,
    updateTopic,
    deleteTopic,
};
