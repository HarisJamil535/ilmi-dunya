const { RULES } = require("./ranking");

const pointsForAttempt = (score, totalMarks) => {
    if (!Number.isFinite(score) || !Number.isFinite(totalMarks) || totalMarks <= 0) return 0;
    return Number((Math.min(1, Math.max(0, score / totalMarks)) * 100).toFixed(2));
};

const rankEligibility = (assessment, attempt) => {
    if (attempt?.isPartialPractice && (attempt.answers?.length || 0) < RULES.minSetQuestions) return { eligible: false, reason: `Sets of fewer than ${RULES.minSetQuestions} questions are practice. Choose ${RULES.minSetQuestions} or more questions to count for ranking.` };
    if (!assessment || assessment.type === "custom_practice") return { eligible: false, reason: "Custom practice tests do not award leaderboard points." };
    if (!attempt?.answers?.length) return { eligible: false, reason: "This test has no questions to score." };
    if (!attempt || !["submitted", "timed_out"].includes(attempt.status)) return { eligible: false, reason: "Finish the test to earn leaderboard points." };
    if (!(attempt.totalMarks > 0)) return { eligible: false, reason: "This test has no available marks." };
    return { eligible: true, reason: null };
};

module.exports = { pointsForAttempt, rankEligibility };
