const mongoose = require("mongoose");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const LeaderboardState = require("../models/LeaderboardState");
const Student = require("../models/Student");

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
    const state = await LeaderboardState.findOne({ key: "global" }).lean();
    const attemptMatch = { status: { $in: ["submitted", "timed_out"] }, totalMarks: { $gt: 0 }, submittedAt: { $ne: null } };
    if (state?.resetAt) attemptMatch.submittedAt.$gte = state.resetAt;

    const leaders = await AssessmentAttempt.aggregate([
        { $match: attemptMatch },
        { $lookup: { from: "assessments", localField: "assessment", foreignField: "_id", as: "assessment" } },
        { $unwind: "$assessment" },
        ...(Object.keys(assessmentMatch).length ? [{ $match: assessmentMatch }] : []),
        { $set: {
            safeScore: { $min: ["$totalMarks", { $max: [0, "$score"] }] },
            safeTime: { $max: [0, { $divide: [{ $subtract: [
                { $min: ["$submittedAt", { $ifNull: ["$expiresAt", "$submittedAt"] }] }, "$startedAt",
            ] }, 1000] }] },
        } },
        // Count each test once, choosing highest marks and then fastest completion.
        { $sort: { safeScore: -1, safeTime: 1, submittedAt: 1, _id: 1 } },
        { $group: { _id: { student: "$student", assessment: "$assessment._id" }, best: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$best" } },
        { $group: {
            _id: "$student",
            totalScore: { $sum: "$safeScore" }, totalMarks: { $sum: "$totalMarks" },
            totalTimeSeconds: { $sum: "$safeTime" }, testsTaken: { $sum: 1 },
            bestPercentage: { $max: { $multiply: [{ $divide: ["$safeScore", "$totalMarks"] }, 100] } },
            lastSubmittedAt: { $max: "$submittedAt" },
        } },
        { $set: {
            points: { $round: [{ $multiply: ["$totalScore", 100] }, 2] },
            totalTimeSeconds: { $round: ["$totalTimeSeconds", 3] },
            averagePercentage: { $round: [{ $multiply: [{ $divide: ["$totalScore", "$totalMarks"] }, 100] }, 2] },
            averageTimeSeconds: { $divide: ["$totalTimeSeconds", "$testsTaken"] },
            bestPercentage: { $round: ["$bestPercentage", 2] },
        } },
        { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
        { $unwind: "$student" },
        { $match: { "student.status": "active" } },
        { $sort: { points: -1, totalTimeSeconds: 1, _id: 1 } },
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
        if (!previous || previous.points !== leader.points || previous.totalTimeSeconds !== leader.totalTimeSeconds) rank = index + 1;
        return { ...leader, rank };
    });

    res.set("Cache-Control", "no-store");
    res.json({
        success: true,
        leaders: ranked,
        scoring: {
            formula: "100 points per earned mark. Only your best attempt per test counts.",
            tieBreaker: "Equal points use total completion time across counted tests. Exact ties share a rank.",
        },
        generatedAt: new Date(),
        cycleStartedAt: state?.resetAt || null,
    });
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
    res.json({
        success: true,
        message: "A new leaderboard cycle has started. Student test history was preserved.",
        resetAt,
    });
};

module.exports = { getLeaderboard, getLeaderboardAdminSummary, resetLeaderboard };
