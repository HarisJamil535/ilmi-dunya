const mongoose = require("mongoose");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const LeaderboardState = require("../models/LeaderboardState");
const Student = require("../models/Student");
const { buildRanking, RULES } = require("../services/ranking");
const leaderboardCache = new Map();

const cachedLeaders = async (key, load) => {
    const existing = leaderboardCache.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
    const value = Promise.resolve().then(load);
    if (leaderboardCache.size >= 64) leaderboardCache.delete(leaderboardCache.keys().next().value);
    leaderboardCache.set(key, { value, expires: Date.now() + 15000 });
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

const PERIODS = ["all", "month", "week"];
const PKT_OFFSET_MS = 5 * 3600 * 1000;

// Start of this Pakistan-time week (Monday) or month, as a UTC date.
const periodStart = (period, now = new Date()) => {
    if (period === "all") return null;
    const local = new Date(now.getTime() + PKT_OFFSET_MS);
    const start = period === "month"
        ? Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)
        : Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
    return new Date(start - PKT_OFFSET_MS);
};

// Finished, rankable attempts with only the fields the ranking needs (answers are counted, not loaded).
async function loadRankableAttempts({ assessmentMatch = {}, since = null, studentId = null }) {
    const match = { status: { $in: ["submitted", "timed_out"] }, isPartialPractice: { $ne: true }, totalMarks: { $gt: 0 }, submittedAt: { $ne: null }, "answers.0": { $exists: true } };
    if (since) match.submittedAt.$gte = since;
    if (studentId) match.student = studentId;
    const rows = await AssessmentAttempt.aggregate([
        { $match: match },
        { $project: { student: 1, assessment: 1, score: 1, totalMarks: 1, startedAt: 1, expiresAt: 1, submittedAt: 1, timeTakenSeconds: 1, questionCount: { $size: "$answers" } } },
        { $lookup: { from: "assessments", localField: "assessment", foreignField: "_id", as: "assessment" } },
        { $unwind: "$assessment" },
        // Withheld results stay off the leaderboard until an admin releases them.
        { $match: { "assessment.type": { $ne: "custom_practice" }, "assessment.showResultImmediately": { $ne: false }, ...assessmentMatch } },
        { $project: { student: 1, score: 1, totalMarks: 1, startedAt: 1, expiresAt: 1, submittedAt: 1, timeTakenSeconds: 1, questionCount: 1,
            type: "$assessment.type", board: "$assessment.board", class: "$assessment.class", group: "$assessment.group", subject: "$assessment.subject", chapter: "$assessment.chapter", topic: "$assessment.topic" } },
    ]).allowDiskUse(true);
    // Tests for the same syllabus scope count as one test, even when it was published again.
    for (const row of rows) row.scopeKey = [row.type, row.board, row.class, row.group, row.subject, row.chapter, row.topic].map(value => String(value || "")).join("|");
    return rows;
}

const cycleStart = async () => (await LeaderboardState.findOne({ key: "global" }).select("resetAt").lean())?.resetAt || null;
const laterOf = (a, b) => (a && b ? (a > b ? a : b) : a || b);

// The full ranking for a filter and period, shared by the board and "my position" for a few seconds.
const rankingFor = (query) => {
    const period = PERIODS.includes(query.period) ? query.period : "all";
    const assessmentMatch = buildAssessmentMatch(query);
    const key = JSON.stringify([period, ...["board", "class", "group", "subject"].map(name => query[name] || "")]);
    return cachedLeaders(key, async () => {
        const resetAt = await cycleStart();
        const attempts = await loadRankableAttempts({ assessmentMatch, since: laterOf(resetAt, periodStart(period)) });
        // Blocked and deleted students are left out before ranks are given.
        const active = new Set((await Student.find({ _id: { $in: [...new Set(attempts.map(row => String(row.student)))] }, status: "active" }).select("_id").lean()).map(row => String(row._id)));
        const { ranked } = buildRanking(attempts.filter(row => active.has(String(row.student))));
        return { period, ranked, resetAt, generatedAt: new Date() };
    });
};

const validFilters = (query) => !["board", "class", "group", "subject"].some((key) => query[key] && !toObjectId(query[key]));

const getLeaderboard = async (req, res) => {
    const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 15, 1), 50);
    if (!validFilters(req.query)) return res.status(400).json({ message: "Choose valid leaderboard filters." });
    const { period, ranked, resetAt, generatedAt } = await rankingFor(req.query);
    const top = ranked.slice(0, limit);
    const people = new Map((await Student.find({ _id: { $in: top.map(row => row.studentId) } }).select("name city school class").populate("class", "name").lean()).map(row => [String(row._id), row]));
    const leaders = top.map(row => {
        const person = people.get(row.studentId) || {};
        return {
            rank: row.rank, studentId: row.studentId, name: person.name, city: person.city, school: person.school, className: person.class?.name || "",
            points: row.points, skill: row.skill, accuracy: row.accuracy, averagePercentage: row.accuracy,
            testsTaken: row.testsTaken, secondsPerQuestion: row.secondsPerQuestion, totalTimeSeconds: row.totalTimeSeconds,
        };
    });
    res.set("Cache-Control", "no-store").json({
        success: true,
        period,
        leaders,
        rankedStudents: ranked.length,
        scoring: {
            formula: "IlmiDunya Score (out of 1000) = your skill across tests x your activity. Skill is mostly accuracy, with a small bonus for finishing early when most answers are right. Your first attempt at a test counts 60%, your best ranked retake 40%. Longer tests count more, and taking more tests helps with diminishing returns.",
            rules: { minTests: RULES.minTestsToRank, retakeGapHours: RULES.retakeGapHours, maxRankedAttempts: RULES.maxRankedAttempts, guessSecondsPerQuestion: RULES.guessSecondsPerQuestion },
            tieBreaker: "Equal scores are settled by accuracy, then speed per question, then who reached the score first.",
        },
        generatedAt,
        cycleStartedAt: resetAt,
    });
};

// The signed-in student's own position, including what is needed to get ranked.
const getMyRanking = async (req, res) => {
    if (!validFilters(req.query)) return res.status(400).json({ message: "Choose valid leaderboard filters." });
    const { period, ranked } = await rankingFor(req.query);
    const mine = ranked.find(row => row.studentId === String(req.student._id));
    if (mine) return res.set("Cache-Control", "no-store").json({ success: true, period, ranked: true, rank: mine.rank, of: ranked.length, points: mine.points, accuracy: mine.accuracy, testsTaken: mine.testsTaken, secondsPerQuestion: mine.secondsPerQuestion });
    const resetAt = await cycleStart();
    const own = await loadRankableAttempts({ assessmentMatch: buildAssessmentMatch(req.query), since: laterOf(resetAt, periodStart(PERIODS.includes(req.query.period) ? req.query.period : "all")), studentId: req.student._id });
    const row = buildRanking(own).all[0];
    const tests = row?.testsTaken || 0;
    res.set("Cache-Control", "no-store").json({ success: true, period, ranked: false, of: ranked.length, testsTaken: tests, testsNeeded: Math.max(0, RULES.minTestsToRank - tests), points: row?.points || 0, accuracy: row?.accuracy || 0 });
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
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    leaderboardCache.clear();
    res.json({
        success: true,
        message: "A new leaderboard cycle has started. Student test history was preserved.",
        resetAt,
    });
};

module.exports = { getLeaderboard, getMyRanking, getLeaderboardAdminSummary, resetLeaderboard, loadRankableAttempts, periodStart };
