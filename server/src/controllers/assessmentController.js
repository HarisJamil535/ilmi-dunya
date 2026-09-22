const Assessment = require("../models/Assessment");
const Question = require("../models/Question");
const mongoose = require("mongoose");
const { assessmentPayload } = require('../services/assessmentPublishing');
const { fail } = require('../services/publishing');

const calculateTotals = async (questions = [], scope = {}) => {
    if (!questions.length) return { normalizedQuestions: [], totalMarks: 0, durationMinutes: 1 };

    const ids = questions.map((item) => item.question || item);
    if (ids.some(id => !mongoose.isValidObjectId(id)) || new Set(ids.map(String)).size !== ids.length) fail('Choose valid MCQs without duplicate questions.');
    const context = Object.fromEntries(['board', 'class', 'group', 'subject', 'chapter', 'topic'].filter(key => scope[key]).map(key => [key, scope[key]]));
    const questionDocs = await Question.find({ ...context, _id: { $in: ids }, ...(scope.status === 'published' ? { status: 'published' } : {}), contentType: { $nin: ["long_question", "short_question"] } }).select("marks estimatedTimeSeconds").lean();
    if (questionDocs.length !== ids.length) fail('Select existing MCQs matching this test scope. Published tests require published questions.');
    const lookup = new Map(questionDocs.map((question) => [String(question._id), question]));

    let totalMarks = 0;
    let totalSeconds = 0;
    const normalizedQuestions = questions.map((item, index) => {
        const questionId = String(item.question || item);
        const question = lookup.get(questionId);
        const marks = Number(item.marks ?? question?.marks ?? 1);
        if (!Number.isFinite(marks) || marks <= 0 || marks > 1000) fail('Each question must have positive marks, at most 1000.');
        totalMarks += marks;
        totalSeconds += Number(question?.estimatedTimeSeconds || 60);
        return {
            question: questionId,
            marks,
            order: Number(item.order ?? index + 1),
            required: item.required !== false,
        };
    });

    return {
        normalizedQuestions,
        totalMarks,
        durationMinutes: Math.max(Math.ceil(totalSeconds / 60), 1),
    };
};

const getAssessments = async (req, res) => {
    const scopeKeys = ["board", "class", "group", "subject", "chapter", "topic", "boardId", "classId", "groupId", "subjectId", "chapterId", "topicId"];
    const hasStudyContext = scopeKeys.some((key) => req.query[key]);
    if (!req.admin && !hasStudyContext) {
        return res.json({ success: true, assessments: [] });
    }
    const filter = {};
    ["type", "board", "class", "group", "subject", "chapter", "topic"].forEach((key) => {
        if (req.query[key]) filter[key] = req.query[key];
    });
    ["board", "class", "group", "subject", "chapter", "topic"].forEach((key) => {
        const idKey = `${key}Id`;
        if (!filter[key] && req.query[idKey]) filter[key] = req.query[idKey];
    });

    if (!req.admin) filter.status = "published";
    if (req.query.status && req.admin) filter.status = req.query.status;

    ["board", "class", "group", "subject", "chapter", "topic"].forEach((key) => {
        if (filter[key] && mongoose.Types.ObjectId.isValid(filter[key])) {
            filter[key] = new mongoose.Types.ObjectId(filter[key]);
        }
    });

    const assessments = await Assessment.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        {
            $project: {
                title: 1,
                description: 1,
                type: 1,
                status: 1,
                subject: 1,
                chapter: 1,
                topic: 1,
                durationMinutes: 1,
                totalMarks: 1,
                passingMarks: 1,
                createdAt: 1,
                questionCount: { $size: { $ifNull: ["$questions", []] } },
            },
        },
    ]);

    res.json({ success: true, assessments });
};

const getAssessment = async (req, res) => {
    const assessment = await Assessment.findById(req.params.id)
        .populate("subject chapter topic", "name")
        .populate({
            path: "questions.question",
            select: req.admin ? "" : "-correctOption -explanation",
            populate: { path: "scenario", select: "title scenarioText" },
        })
        .lean();

    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found." });
    if (!req.admin && assessment.status !== "published") {
        return res.status(404).json({ success: false, message: "Assessment not found." });
    }

    res.json({ success: true, assessment });
};

const createAssessment = async (req, res) => {
    const payload = assessmentPayload(req.body);
    const { normalizedQuestions, totalMarks, durationMinutes } = await calculateTotals(payload.questions || [], payload);
    if (Number(payload.passingMarks || 0) > totalMarks) fail('Passing marks cannot exceed total marks.');
    const assessment = await Assessment.create({
        ...payload,
        questions: normalizedQuestions,
        totalMarks,
        durationMinutes: payload.durationMinutes || durationMinutes,
        passingMarks: payload.passingMarks ?? Math.ceil(totalMarks * 0.4),
        createdBy: req.admin?._id,
    });

    await Question.updateMany(
        { _id: { $in: normalizedQuestions.map((item) => item.question) } },
        { $inc: { usageCount: 1 } }
    );

    res.status(201).json({ success: true, assessment });
};

const updateAssessment = async (req, res) => {
    const existing = await Assessment.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Assessment not found.' });
    const payload = assessmentPayload(req.body, existing);
    payload.questions = payload.questions || existing.questions;

    if (payload.questions) {
        const { normalizedQuestions, totalMarks, durationMinutes } = await calculateTotals(payload.questions, { ...existing, ...payload });
        payload.questions = normalizedQuestions;
        payload.totalMarks = totalMarks;
        if (!payload.durationMinutes) payload.durationMinutes = durationMinutes;
        if (payload.passingMarks === undefined) payload.passingMarks = Math.ceil(totalMarks * 0.4);
        if (Number(payload.passingMarks) > totalMarks) fail('Passing marks cannot exceed total marks.');
    }

    const assessment = await Assessment.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
    });

    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found." });
    res.json({ success: true, assessment });
};

const deleteAssessment = async (req, res) => {
    const assessment = await Assessment.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found." });
    res.json({ success: true, assessment });
};

const generateRandomAssessment = async (req, res) => {
    const { filters = {}, totalQuestions = 10, difficulty = {} } = req.body;
    const levels = ["easy", "medium", "hard"];
    let selected = [];

    for (const level of levels) {
        const count = Number(difficulty[level] || 0);
        if (!count) continue;
        const questions = await Question.aggregate([
            { $match: { ...filters, ...require("../services/scopeTest").mcqFilter, difficulty: level } },
            { $sample: { size: count } },
            { $project: { _id: 1, marks: 1 } },
        ]);
        selected = [...selected, ...questions.map((question) => ({ question: question._id, marks: question.marks }))];
    }

    if (selected.length < totalQuestions) {
        const remaining = await Question.aggregate([
            { $match: { ...filters, ...require("../services/scopeTest").mcqFilter, _id: { $nin: selected.map((item) => item.question) } } },
            { $sample: { size: totalQuestions - selected.length } },
            { $project: { _id: 1, marks: 1 } },
        ]);
        selected = [...selected, ...remaining.map((question) => ({ question: question._id, marks: question.marks }))];
    }

    res.json({ success: true, questions: selected.slice(0, totalQuestions) });
};

module.exports = {
    getAssessments,
    getAssessment,
    createAssessment,
    updateAssessment,
    deleteAssessment,
    generateRandomAssessment,
};
