const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Question = require("../models/Question");
const Assessment = require("../models/Assessment");

const mcqFilter = { contentType: { $nin: ["long_question", "short_question"] }, type: { $in: ["standard_mcq", "scenario_mcq"] }, status: "published" };

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
    const questions = await Question.find({ ...filter, ...mcqFilter }).sort({ _id: 1 }).select("_id marks estimatedTimeSeconds updatedAt").lean();
    if (!questions.length) throw Object.assign(new Error("No published MCQs have been added here yet."), { status: 404 });
    // A changed question set gets a new test, preserving totals on earlier attempts.
    const digest = crypto.createHash("sha256").update(JSON.stringify([filter, questions])).digest("hex").slice(0, 24);
    const _id = new mongoose.Types.ObjectId(digest);
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const payload = {
        ...filter, title: `${topic?.name || chapter.name} MCQ test`,
        type: topic ? "topic_test" : "chapter_test", status: "published",
        questions: questions.map((q, index) => ({ question: q._id, marks: q.marks, order: index + 1 })),
        totalMarks, passingMarks: Math.ceil(totalMarks * 0.4),
        durationMinutes: Math.max(1, Math.ceil(questions.reduce((sum, q) => sum + q.estimatedTimeSeconds, 0) / 60)),
        allowResume: true,
    };
    try {
        return await Assessment.findOneAndUpdate({ _id }, { $setOnInsert: payload }, { upsert: true, new: true, runValidators: true }).lean();
    } catch (error) {
        if (error.code === 11000) return Assessment.findById(_id).lean();
        throw error;
    }
}

module.exports = { resolveScope, createScopeTest, mcqFilter };
