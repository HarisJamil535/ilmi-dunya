const AssessmentAttempt = require("../models/AssessmentAttempt");

const pakistanTime = value => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });

// Returns a student-facing reason when a new attempt cannot start, or null when it can.
async function startBlocker(assessment, studentId, now = new Date()) {
    if (assessment.startsAt && now < new Date(assessment.startsAt)) return `This test opens on ${pakistanTime(assessment.startsAt)} (Pakistan time).`;
    if (assessment.endsAt && now >= new Date(assessment.endsAt)) return `This test closed on ${pakistanTime(assessment.endsAt)} (Pakistan time).`;
    const allowed = Number(assessment.maxAttempts) || 0;
    if (allowed > 0) {
        const used = await AssessmentAttempt.countDocuments({ student: studentId, assessment: assessment._id, status: { $ne: "abandoned" } });
        if (used >= allowed) return `You have used all ${allowed} allowed ${allowed === 1 ? "attempt" : "attempts"} for this test.`;
    }
    return null;
}

// The attempt cannot run past the test's closing time.
const attemptExpiry = (assessment, now, durationMinutes) => {
    const expiresAt = now.getTime() + durationMinutes * 60 * 1000;
    const closesAt = assessment.endsAt ? new Date(assessment.endsAt).getTime() : Infinity;
    return new Date(Math.min(expiresAt, closesAt));
};

// Applies a per-attempt option order and positional labels (A, B, C...) for display.
function orderOptions(answer) {
    const options = answer.question?.options;
    if (!answer.optionOrder?.length || !Array.isArray(options)) return;
    const rank = new Map(answer.optionOrder.map((key, index) => [key, index]));
    answer.question.options = [...options]
        .sort((left, right) => (rank.get(left.key) ?? options.length) - (rank.get(right.key) ?? options.length))
        .map((option, index) => ({ ...option, label: String.fromCharCode(65 + index) }));
}

const resultsWithheld = assessment => assessment?.showResultImmediately === false;

// Removes every scoring detail until an admin releases the test's results.
function withholdScores(attempt) {
    for (const key of ["score", "percentage", "passStatus", "points", "ranking"]) delete attempt[key];
    for (const answer of attempt.answers || []) {
        delete answer.isCorrect;
        delete answer.marksAwarded;
        if (answer.question && typeof answer.question === "object") {
            delete answer.question.correctOption;
            delete answer.question.explanation;
        }
    }
    attempt.resultsWithheld = true;
    return attempt;
}

module.exports = { startBlocker, attemptExpiry, orderOptions, resultsWithheld, withholdScores };
