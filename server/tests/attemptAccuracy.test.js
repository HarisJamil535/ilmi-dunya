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

test("equal points, coverage, accuracy, and time share rank; subsequent ranks skip ties", async (t) => {
    t.mock.method(LeaderboardState, "findOne", () => ({ lean: async () => null }));
    let aggregations = 0;
    t.mock.method(AssessmentAttempt, "aggregate", async (pipeline) => {
        aggregations += 1;
        assert.equal(pipeline[0].$match["answers.0"].$exists, true);
        assert.deepEqual(pipeline[3].$match["assessment.type"], { $ne: "custom_practice" });
        assert.equal(pipeline.find((stage) => stage.$group?._id?.chapter)?.$group._id.chapter, "$assessment.chapter");
        assert.equal(pipeline.find((stage) => stage.$group?._id?.topic)?.$group._id.topic, "$assessment.topic");
        assert.deepEqual(pipeline.find((stage) => stage.$sort?.safeRatio)?.$sort, { safeRatio: -1, safeTime: 1, submittedAt: 1, _id: 1 });
        return [
        { studentId: "a", points: 100, testsTaken: 1, averagePercentage: 100, totalTimeSeconds: 20.001 },
        { studentId: "b", points: 100, testsTaken: 1, averagePercentage: 100, totalTimeSeconds: 20.001 },
        { studentId: "c", points: 100, testsTaken: 1, averagePercentage: 100, totalTimeSeconds: 20.002 },
        { studentId: "d", points: 90, testsTaken: 1, averagePercentage: 90, totalTimeSeconds: 1 },
        ];
    });
    let result;
    await getLeaderboard({ query: {} }, { set() {}, json(value) { result = value; } });
    assert.deepEqual(result.leaders.map((item) => item.rank), [1, 1, 3, 4]);
    await getLeaderboard({ query: {} }, { set() {}, json(value) { result = value; } });
    assert.equal(aggregations, 1);
});
