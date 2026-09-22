const test = require("node:test");
const assert = require("node:assert/strict");
const { gradeAttempt } = require("../src/services/assessmentScoring");

const startedAt = new Date("2026-01-01T00:00:00Z");
const expiresAt = new Date("2026-01-01T00:01:00Z");
const attempt = (answers) => ({ startedAt, expiresAt, answers });

test("fractional marks, zero-mark questions, and percentage precision", () => {
    const result = gradeAttempt(attempt([
        { question: "a", selectedOption: "A" }, { question: "b", selectedOption: "B" }, { question: "c", selectedOption: "A" },
    ]), [
        { question: "a", correctOption: "A", marks: 0.1 }, { question: "b", correctOption: "A", marks: 0.2 }, { question: "c", correctOption: "A", marks: 0 },
    ], 0.1, new Date("2026-01-01T00:00:12.345Z"));
    assert.equal(result.score, 0.1);
    assert.equal(result.totalMarks, 0.3);
    assert.equal(result.percentage, 33.33);
    assert.equal(result.timeTakenSeconds, 12.345);
    assert.equal(result.passStatus, "pass");
    assert.equal(result.answers[2].marksAwarded, 0);
});

test("late submission caps time at deadline and marks timeout on the server", () => {
    const result = gradeAttempt(attempt([{ question: "a", selectedOption: "" }]), [{ question: "a", correctOption: "A", marks: 1 }], 1, new Date("2026-01-01T00:03:00Z"));
    assert.equal(result.timeTakenSeconds, 60);
    assert.equal(result.status, "timed_out");
    assert.equal(result.autoSubmitted, true);
    assert.equal(result.answers[0].skipped, true);
    assert.equal(result.score, 0);
});

test("pass threshold uses earned marks, not rounded display percentage", () => {
    const result = gradeAttempt(attempt([{ question: "a", selectedOption: "A" }, { question: "b", selectedOption: "" }]), [{ question: "a", correctOption: "A", marks: 0.39999 }, { question: "b", correctOption: "B", marks: 0.60001 }], 0.4, new Date("2026-01-01T00:00:30Z"));
    assert.equal(result.percentage, 40);
    assert.equal(result.passStatus, "fail");
});

test("missing grading keys fail explicitly instead of silently lowering a score", () => {
    assert.throws(() => gradeAttempt(attempt([{ question: "missing" }]), [], 1), /unavailable/);
});
