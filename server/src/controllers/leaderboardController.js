const mongoose = require("mongoose");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const LeaderboardState = require("../models/LeaderboardState");
const Student = require("../models/Student");
const leaderboardCache = new Map();

const cachedLeaders = async (key, load) => {
    const existing = leaderboardCache.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
    const value = Promise.resolve().then(load);
    if (leaderboardCache.size >= 64) leaderboardCache.delete(leaderboardCache.keys().next().value);
    leaderboardCache.set(key, { value, expires: Date.now() + 10000 });
    try { return await value; } catch (error) {
        if (leaderboardCache.get(key)?.value === value) leaderboardCache.delete(key);
        throw error;
    }
};

const toObjectId = (value) => {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
    return new mongoose.Types.ObjectId(value);
};

const buildAssessmentMatch = (query) => {
    const match = {};
    ["board", "class", "group", "subject"].forEach((key) => {
        const objectId = toObjectId(query[key]);
        if (objectId) match[`assessment.${key}`] = objectId;
    });
    return match;
};

const getLeaderboard = async (req, res) => {
    const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 15, 1), 50);
    if (["board", "class", "group", "subject"].some((key) => req.query[key] && !toObjectId(req.query[key]))) return res.status(400).json({ message: "Choose valid leaderboard filters." });
    const assessmentMatch = buildAssessmentMatch(req.query);
    const cacheKey = JSON.stringify([limit, ...["board", "class", "group", "subject"].map(key => req.query[key] || "")]);
    const result = await cachedLeaders(cacheKey, async () => {
    const state = await LeaderboardState.findOne({ key: "global" }).lean();
    const attemptMatch = { status: { $in: ["submitted", "timed_out"] }, totalMarks: { $gt: 0 }, submittedAt: { $ne: null }, "answers.0": { $exists: true } };
    if (state?.resetAt) attemptMatch.submittedAt.$gte = state.resetAt;

    const leaders = await AssessmentAttempt.aggregate([
        { $match: attemptMatch },
        { $lookup: { from: "assessments", localField: "assessment", foreignField: "_id", as: "assessment" } },
        { $unwind: "$assessment" },
        { $match: { "assessment.type": { $ne: "custom_practice" } } },
        ...(Object.keys(assessmentMatch).length ? [{ $match: assessmentMatch }] : []),
        { $set: {
            safeScore: { $min: ["$totalMarks", { $max: [0, "$score"] }] },
            safeRatio: { $divide: [{ $min: ["$totalMarks", { $max: [0, "$score"] }] }, "$totalMarks"] },
            safePoints: { $round: [{ $multiply: [100, { $divide: [{ $min: ["$totalMarks", { $max: [0, "$score"] }] }, "$totalMarks"] }] }, 2] },
            safeTime: { $max: [0, { $divide: [{ $subtract: [
                { $min: ["$submittedAt", { $ifNull: ["$expiresAt", "$submittedAt"] }] }, "$startedAt",
            ] }, 1000] }] },
        } },
        // A new publication for the same syllabus scope replaces, rather than duplicates, that test's points.
        { $sort: { safeRatio: -1, safeTime: 1, submittedAt: 1, _id: 1 } },
        { $group: { _id: { student: "$student", type: "$assessment.type", board: "$assessment.board", class: "$assessment.class", group: "$assessment.group", subject: "$assessment.subject", chapter: "$assessment.chapter", topic: "$assessment.topic" }, best: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$best" } },
        { $group: {
            _id: "$student",
            totalScore: { $sum: "$safeScore" }, totalMarks: { $sum: "$totalMarks" },
            points: { $sum: "$safePoints" }, percentageSum: { $sum: "$safePoints" },
            totalTimeSeconds: { $sum: "$safeTime" }, testsTaken: { $sum: 1 },
            bestPercentage: { $max: { $multiply: [{ $divide: ["$safeScore", "$totalMarks"] }, 100] } },
            lastSubmittedAt: { $max: "$submittedAt" },
        } },
        { $set: {
            points: { $round: ["$points", 2] },
            totalTimeSeconds: { $round: ["$totalTimeSeconds", 3] },
            averagePercentage: { $round: [{ $divide: ["$percentageSum", "$testsTaken"] }, 2] },
            averageTimeSeconds: { $divide: ["$totalTimeSeconds", "$testsTaken"] },
            bestPercentage: { $round: ["$bestPercentage", 2] },
        } },
        { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
        { $unwind: "$student" },
        { $match: { "student.status": "active" } },
        { $sort: { points: -1, testsTaken: -1, averagePercentage: -1, totalTimeSeconds: 1, lastSubmittedAt: 1, _id: 1 } },
        { $limit: limit },
        { $lookup: { from: "classes", localField: "student.class", foreignField: "_id", as: "classDoc" } },
        { $project: {
            _id: 0, studentId: "$_id", name: "$student.name", city: "$student.city", school: "$student.school",
            className: { $arrayElemAt: ["$classDoc.name", 0] },
            totalScore: 1, totalMarks: 1, points: 1, testsTaken: 1,
            averagePercentage: 1, averageTimeSeconds: 1, totalTimeSeconds: 1, bestPercentage: 1, lastSubmittedAt: 1,
        } },
    ]);
    let rank = 0;
    const ranked = leaders.map((leader, index) => {
        const previous = leaders[index - 1];
        if (!previous || previous.points !== leader.points || previous.testsTaken !== leader.testsTaken || previous.averagePercentage !== leader.averagePercentage || previous.totalTimeSeconds !== leader.totalTimeSeconds) rank = index + 1;
        return { ...leader, rank };
    });

    return {
        success: true,
        leaders: ranked,
        scoring: {
            formula: "Each published MCQ test can earn up to 100 points. Only your best completed attempt for that test's syllabus scope counts.",
            tieBreaker: "Ties use tests completed, average accuracy, then total completion time. Exact ties share a rank.",
        },
        generatedAt: new Date(),
        cycleStartedAt: state?.resetAt || null,
    };
    });
    res.set("Cache-Control", "no-store");
    res.json(result);
};

const getLeaderboardAdminSummary = async (req, res) => {
    const state = await LeaderboardState.findOne({ key: "global" }).populate("resetBy", "name email").lean();
    const attemptFilter = { status: { $in: ["submitted", "timed_out"] }, submittedAt: { $ne: null } };
    if (state?.resetAt) attemptFilter.submittedAt.$gte = state.resetAt;

    const [students, activeStudents, participants, attempts] = await Promise.all([
        Student.countDocuments(),
        Student.countDocuments({ status: "active" }),
        AssessmentAttempt.distinct("student", attemptFilter),
        AssessmentAttempt.countDocuments(attemptFilter),
    ]);

    res.set("Cache-Control", "no-store");
    res.json({
        success: true,
        summary: {
            students,
            activeStudents,
            participants: participants.length,
            attempts,
            resetAt: state?.resetAt || null,
            resetBy: state?.resetBy || null,
        },
    });
};

const resetLeaderboard = async (req, res) => {
    const resetAt = new Date();
    await LeaderboardState.findOneAndUpdate(
        { key: "global" },
        { $set: { resetAt, resetBy: req.admin._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    leaderboardCache.clear();
    res.json({
        success: true,
        message: "A new leaderboard cycle has started. Student test history was preserved.",
        resetAt,
    });
};

module.exports = { getLeaderboard, getLeaderboardAdminSummary, resetLeaderboard };
