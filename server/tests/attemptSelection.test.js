const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { resolveQuestionCount, selectQuestions } = require("../src/services/attemptSelection");
const { rankEligibility } = require("../src/services/leaderboardScoring");
const { startAttempt, previewAttempt } = require("../src/controllers/attemptController");
const Assessment = require("../src/models/Assessment");
const Attempt = require("../src/models/AssessmentAttempt");
const Question = require("../src/models/Question");
const Activity = require("../src/models/LearningActivity");
const id = n => String(n).padStart(24, "0");
const questions = Array.from({ length: 55 }, (_, index) => ({ question: id(index + 1), marks: 2, order: index + 1 }));
afterEach(() => mock.restoreAll());

test("counts default to all, allow small full tests and reject invalid custom counts", () => {
    assert.equal(resolveQuestionCount(undefined, 55), 55);
    assert.equal(resolveQuestionCount("all", 55), 55);
    assert.equal(resolveQuestionCount(25, 55), 25);
    assert.equal(resolveQuestionCount("all", 3), 3);
    for (const value of [0, 4, 56, 5.5, "25", null, NaN]) assert.throws(() => resolveQuestionCount(value, 55), { status: 400 });
});

test("random subsets have exact size, no duplicates, and differ from the previous set", () => {
    const first = selectQuestions(questions, 25, [], maximum => maximum - 1);
    const second = selectQuestions(questions, 25, first.map(item => item.question), maximum => maximum - 1);
    assert.equal(second.length, 25);
    assert.equal(new Set(second.map(item => item.question)).size, 25);
    assert.notDeepEqual(new Set(first.map(item => item.question)), new Set(second.map(item => item.question)));
    assert.ok(second.every(item => questions.some(source => source.question === item.question)));
    assert.deepEqual(selectQuestions(questions, 55), questions);
    assert.equal(questions[0].question, id(1));
});

const query = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value });
test("resumed preview keeps its original question count, timer and marks", async () => {
    mock.method(Assessment, "findById", () => query({ _id: id(90), type: "topic_test", status: "published", createdBy: id(91), questions, totalMarks: 110, allowResume: true }));
    mock.method(Attempt, "findOne", () => query({ _id: id(92), answers: questions.slice(0, 25), totalMarks: 50, startedAt: new Date(0), expiresAt: new Date(25 * 60000), isPartialPractice: true }));
    const res = { json(value) { this.body = value; } };
    await previewAttempt({ query: { assessmentId: id(90) }, student: { _id: id(93) } }, res);
    assert.equal(res.body.test.questionCount, 25);
    assert.equal(res.body.test.durationMinutes, 25);
    assert.equal(res.body.test.totalMarks, 50);
    assert.equal(res.body.test.resume, true);
    assert.equal(res.body.test.canChooseCount, false);
    assert.equal(res.body.test.ranked, false);
});
for (const type of ["topic_test", "chapter_test"]) {
    for (const count of [25, "all"]) {
        test(`${type}: ${count} questions use per-attempt marks and exactly one minute each`, async () => {
            const assessment = { _id: id(90), type, status: "published", createdBy: id(91), questions, totalMarks: 110, passingMarks: 44, durationMinutes: 900, allowResume: false };
            let saved;
            mock.method(Assessment, "findById", () => query(assessment));
            mock.method(Attempt, "findOne", filter => query(filter._id ? saved : null));
            mock.method(Attempt, "create", async payload => { saved = { ...payload, _id: id(92) }; return saved; });
            mock.method(Question, "find", filter => query(filter._id.$in.map(_id => ({ _id, type: "standard_mcq", correctOption: "A", marks: 2 }))));
            mock.method(Activity, "create", async () => ({}));
            const res = { json(value) { this.body = value; }, status(value) { this.code = value; return this; } };
            await startAttempt({ body: { assessmentId: id(90), questionCount: count }, student: { _id: id(93) } }, res);
            const expected = count === "all" ? 55 : count;
            assert.equal(saved.answers.length, expected);
            assert.equal(saved.totalMarks, expected * 2);
            assert.equal(saved.expiresAt - saved.startedAt, expected * 60000);
            assert.equal(saved.gradingSnapshot.length, expected);
            assert.equal(saved.isPartialPractice, expected < 55);
            assert.equal(saved.passingMarksSnapshot, Math.ceil(expected * 2 * .4));
            assert.equal(rankEligibility(assessment, { ...saved, status: "submitted" }).eligible, true, "a set of 10 or more questions counts");
            assert.equal(rankEligibility(assessment, { ...saved, answers: saved.answers.slice(0, 9), status: "submitted" }).eligible, expected === 55, "a short chosen set is practice; a full test always counts");
        });
    }
}
