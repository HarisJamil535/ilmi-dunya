const Assessment = require("../models/Assessment");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const LeaderboardState = require("../models/LeaderboardState");
const Question = require("../models/Question");
const { gradeAttempt } = require("./assessmentScoring");

// The browser submits itself when time runs out; this grace leaves room for that before the server steps in.
const GRACE_MS = 5 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;
const BATCH = 300;

// Answer keys for an attempt: the snapshot taken when it started, or the live questions for older attempts.
async function gradingFor(attempt, assessment) {
    if (attempt.gradingSnapshot?.length) return attempt.gradingSnapshot;
    const questions = await Question.find({ _id: { $in: attempt.answers.map((answer) => answer.question) } }).lean();
    const marks = new Map((assessment?.questions || []).map((item) => [String(item.question), item.marks]));
    return questions.map((question) => ({ question: question._id, correctOption: question.correctOption, marks: marks.get(String(question._id)) ?? question.marks ?? 1 }));
}

// The rule applies from the moment this code first ran, so tests abandoned before students were told stay untouched.
let startedAt = null;
async function ruleStart() {
    if (startedAt) return startedAt;
    const read = async () => (await LeaderboardState.findOne({ key: "global" }).select("expiredAttemptsFrom").lean())?.expiredAttemptsFrom;
    startedAt = await read();
    if (!startedAt) {
        try {
            await LeaderboardState.updateOne({ key: "global", expiredAttemptsFrom: null }, { $set: { expiredAttemptsFrom: new Date() } }, { upsert: true });
        } catch (error) {
            // Another server set it first; its date wins.
            if (error.code !== 11000) throw error;
        }
        startedAt = await read();
    }
    return startedAt;
}

// Marks tests whose time ran out without a submit, using the answers saved so far, exactly like a timed-out submit.
// Leaving a hard test unsubmitted therefore still counts, and the next attempt cannot pose as the first.
async function finishExpired(studentId) {
    const from = await ruleStart();
    const filter = { status: "in_progress", expiresAt: { $lt: new Date(Date.now() - GRACE_MS) }, startedAt: { $gte: from } };
    if (studentId) filter.student = studentId;
    const attempts = await AssessmentAttempt.find(filter).select("+gradingSnapshot").limit(BATCH);
    let finished = 0;
    for (const attempt of attempts) {
        try {
            const assessment = await Assessment.findById(attempt.assessment).select("questions passingMarks").lean();
            const result = gradeAttempt(attempt, await gradingFor(attempt, assessment), attempt.passingMarksSnapshot ?? assessment?.passingMarks ?? 0, new Date(attempt.expiresAt));
            const saved = await AssessmentAttempt.updateOne({ _id: attempt._id, status: "in_progress", updatedAt: attempt.updatedAt }, { $set: { ...result, status: "timed_out", autoSubmitted: true } });
            finished += saved.modifiedCount || 0;
        } catch (error) {
            // A question deleted since the test started cannot be graded; that attempt stays as it is.
            console.warn(`Could not finish expired attempt ${attempt._id}: ${error.message}`);
        }
    }
    return finished;
}

let lastSweep = 0;
let sweeping = null;
// One sweep at a time and at most once a minute for everyone; a single student's attempts are checked on demand.
function finishExpiredAttempts({ studentId } = {}) {
    if (studentId) return finishExpired(studentId).catch((error) => { console.warn(`Expired attempt check failed: ${error.message}`); return 0; });
    if (sweeping || Date.now() - lastSweep < SWEEP_EVERY_MS) return sweeping || Promise.resolve(0);
    lastSweep = Date.now();
    sweeping = finishExpired().catch((error) => { console.warn(`Expired attempt sweep failed: ${error.message}`); return 0; }).finally(() => { sweeping = null; });
    return sweeping;
}

module.exports = { finishExpiredAttempts, gradingFor, GRACE_MS };
