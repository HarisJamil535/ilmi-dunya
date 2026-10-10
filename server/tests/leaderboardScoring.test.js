const test = require("node:test");
const assert = require("node:assert/strict");
const { pointsForAttempt, rankEligibility } = require("../src/services/leaderboardScoring");

test("points are normalized to 100 independently of test marks", () => {
    assert.equal(pointsForAttempt(9, 10), 90);
    assert.equal(pointsForAttempt(18, 20), 90);
    assert.equal(pointsForAttempt(1, 3), 33.33);
    assert.equal(pointsForAttempt(11, 10), 100);
    assert.equal(pointsForAttempt(-1, 10), 0);
    assert.equal(pointsForAttempt(1, 0), 0);
});

test("completed topic and chapter tests qualify even with a short question set", () => {
    const chapter = { type: "chapter_test", chapter: "chapter" };
    const attempt = { status: "submitted", totalMarks: 1, answers: [{}] };
    assert.equal(rankEligibility(chapter, attempt).eligible, true);
    assert.equal(rankEligibility(chapter, { ...attempt, status: "timed_out" }).eligible, true);
    assert.equal(rankEligibility(chapter, { ...attempt, answers: [] }).eligible, false);
    assert.equal(rankEligibility(chapter, { ...attempt, status: "in_progress" }).eligible, false);
    assert.equal(rankEligibility({ type: "topic_test", chapter: "chapter" }, attempt).eligible, true);
    assert.equal(rankEligibility({ type: "custom_practice" }, attempt).eligible, false);
});
