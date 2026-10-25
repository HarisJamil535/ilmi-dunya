const test = require("node:test");
const assert = require("node:assert/strict");
const AssessmentAttempt = require("../src/models/AssessmentAttempt");
const Assessment = require("../src/models/Assessment");
const Question = require("../src/models/Question");
const LeaderboardState = require("../src/models/LeaderboardState");
const { saveAnswer, previewAttempt } = require("../src/controllers/attemptController");
const { getLeaderboard } = require("../src/controllers/leaderboardController");

test("flagging a question preserves its selected answer and requires an unexpired attempt", async (t) => {
    let update;
    let filter;
    t.mock.method(AssessmentAttempt, "updateOne", async (where, changes) => { filter = where; update = changes.$set; return { matchedCount: 1 }; });
    t.mock.method(Question, "findById", () => { throw new Error("Flagging must not read or change the answer option"); });
    await saveAnswer({ body: { flaggedForReview: true }, params: { id: "attempt", questionId: "question" }, student: { _id: "student" } }, { json() {} });
    assert.equal(update["answers.$.flaggedForReview"], true);
    assert.equal(Object.hasOwn(update, "answers.$.selectedOption"), false);
    assert.equal(filter.status, "in_progress");
    assert.ok(filter.expiresAt.$gt instanceof Date);
});

test("preview explains a published test without creating an attempt", async (t) => {
    const id = "507f1f77bcf86cd799439011";
    t.mock.method(Assessment, "findById", () => ({ lean: async () => ({ _id: id, title: "Motion", type: "topic_test", status: "published", createdBy: id, questions: [{ question: id }], durationMinutes: 2, totalMarks: 1, instructions: [] }) }));
    t.mock.method(AssessmentAttempt, "create", () => { throw new Error("Preview must not start an attempt"); });
    const response = { json(body) { this.body = body; } };
    await previewAttempt({ query: { assessmentId: id }, student: { _id: id } }, response);
    assert.equal(response.body.test.questionCount, 1);
    assert.equal(response.body.test.ranked, true);
    assert.equal(response.body.test.resume, false);
});

test("leaderboard skips short practice sets, withheld results and blocked students; equal records share a rank", async (t) => {
    const Student = require("../src/models/Student");
    t.mock.method(LeaderboardState, "findOne", () => ({ select: () => ({ lean: async () => ({ expiredAttemptsFrom: new Date("2026-01-01") }) }) }));
    let sweeps = 0;
    t.mock.method(AssessmentAttempt, "find", (filter) => { sweeps += 1; assert.equal(filter.status, "in_progress"); return { select: () => ({ limit: async () => [] }) }; });
    const started = new Date("2026-05-01T08:00:00Z");
    // Three tests of 20 questions each per student, every attempt using the full time.
    const row = (student, i, pct) => ({ _id: `${student}${i}`, student, score: pct / 5, totalMarks: 20, questionCount: 20, startedAt: started, expiresAt: new Date(started.getTime() + 1200e3), submittedAt: new Date(started.getTime() + 1200e3), timeTakenSeconds: 1200, type: "topic_test", chapter: `${student}c${i}`, topic: `${student}t${i}` });
    let aggregations = 0;
    t.mock.method(AssessmentAttempt, "aggregate", (pipeline) => {
        aggregations += 1;
        assert.equal(pipeline[0].$match["answers.0"].$exists, true);
        assert.deepEqual(pipeline[2].$match.$or, [{ isPartialPractice: { $ne: true } }, { questionCount: { $gte: 10 } }]);
        const filter = pipeline.find((stage) => stage.$match?.["assessment.type"]).$match;
        assert.deepEqual(filter["assessment.type"], { $ne: "custom_practice" });
        assert.deepEqual(filter["assessment.showResultImmediately"], { $ne: false });
        const rows = ["a", "b", "c", "blocked"].flatMap((student) => [0, 1, 2].map((i) => row(student, i, student === "c" ? 70 : 90)));
        return { allowDiskUse: async () => rows };
    });
    t.mock.method(Student, "find", (query) => {
        if (query.status === "active") return { select: () => ({ lean: async () => query._id.$in.filter((id) => id !== "blocked").map((_id) => ({ _id })) }) };
        return { select: () => ({ populate: () => ({ lean: async () => query._id.$in.map((_id) => ({ _id, name: _id.toUpperCase() })) }) }) };
    });
    let result;
    await getLeaderboard({ query: {} }, { set() { return this; }, json(value) { result = value; } });
    assert.deepEqual(result.leaders.map((item) => [item.studentId, item.rank]), [["a", 1], ["b", 1], ["c", 3]]);
    assert.ok(result.leaders[0].points > result.leaders[2].points);
    await getLeaderboard({ query: {} }, { set() { return this; }, json(value) { result = value; } });
    assert.equal(aggregations, 1, "the ranking is cached for a few seconds");
    assert.equal(sweeps, 1, "expired tests are finished before ranking");
});
