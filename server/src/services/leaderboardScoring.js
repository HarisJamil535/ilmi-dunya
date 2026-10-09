const MIN_RANKED_QUESTIONS = 5;

const pointsForAttempt = (score, totalMarks) => {
    if (!Number.isFinite(score) || !Number.isFinite(totalMarks) || totalMarks <= 0) return 0;
    return Number((Math.min(1, Math.max(0, score / totalMarks)) * 100).toFixed(2));
};

const rankEligibility = (assessment, attempt) => {
    if (assessment?.type !== "chapter_test" || !assessment.chapter) return { eligible: false, reason: "Topic and other tests are for practice; chapter tests count toward the leaderboard." };
    if ((attempt?.answers?.length || 0) < MIN_RANKED_QUESTIONS) return { eligible: false, reason: `A chapter test needs at least ${MIN_RANKED_QUESTIONS} questions to count toward rankings.` };
    if (!attempt || !["submitted", "timed_out"].includes(attempt.status)) return { eligible: false, reason: "Finish the test to earn leaderboard points." };
    if (!(attempt.totalMarks > 0)) return { eligible: false, reason: "This test has no available marks." };
    return { eligible: true, reason: null };
};

module.exports = { MIN_RANKED_QUESTIONS, pointsForAttempt, rankEligibility };
