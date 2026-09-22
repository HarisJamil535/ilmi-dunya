const mongoose = require("mongoose");
const AssessmentAttempt = require("../models/AssessmentAttempt");

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

    const leaders = await AssessmentAttempt.aggregate([
        { $match: { status: { $in: ["submitted", "timed_out"] }, totalMarks: { $gt: 0 }, submittedAt: { $ne: null } } },
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
    });
};

module.exports = { getLeaderboard };
