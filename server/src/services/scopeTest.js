const mongoose = require("mongoose");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Assessment = require("../models/Assessment");
const mcqFilter = { contentType: { $nin: ["long_question", "short_question"] }, type: { $in: ["standard_mcq", "scenario_mcq"] }, status: { $ne: "archived" } };

async function resolveScope(chapterId, topicId) {
    const id = topicId || chapterId;
    if (!mongoose.isObjectIdOrHexString(id)) throw Object.assign(new Error("Select a valid chapter or topic."), { status: 400 });
    const topic = topicId ? await Topic.findById(topicId).lean() : null;
    if (topicId && !topic) throw Object.assign(new Error("Topic not found."), { status: 404 });
    const chapter = await Chapter.findById(topic ? topic.chapterId : chapterId).lean();
    if (!chapter) throw Object.assign(new Error("Chapter not found."), { status: 404 });
    if (topic && chapterId && String(topic.chapterId) !== chapterId) throw Object.assign(new Error("Topic does not belong to this chapter."), { status: 400 });
    const filter = { chapter: chapter._id, board: chapter.board, class: chapter.class, group: chapter.group, subject: chapter.subject };
    if (topic) filter.topic = topic._id;
    return { chapter, topic, filter };
}

async function createScopeTest(chapterId, topicId) {
    const { chapter, topic, filter } = await resolveScope(chapterId, topicId);
    const assessment = await Assessment.findOne({
        ...filter,
        type: topic ? "topic_test" : "chapter_test",
        status: "published",
        createdBy: { $exists: true },
    }).sort({ createdAt: -1 }).lean();
    if (!assessment) throw Object.assign(new Error(`No ${topic ? "topic" : "chapter"} test has been published here yet.`), { status: 404 });
    return assessment;
}

module.exports = { resolveScope, createScopeTest, mcqFilter };
