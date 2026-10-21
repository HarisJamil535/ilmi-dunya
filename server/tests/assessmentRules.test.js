const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const Assessment = require("../src/models/Assessment");
const Attempt = require("../src/models/AssessmentAttempt");
const Question = require("../src/models/Question");
const Activity = require("../src/models/LearningActivity");
const LeaderboardState = require("../src/models/LeaderboardState");
const Student = require("../src/models/Student");
const SiteMetric = require("../src/models/SiteMetric");
const { startBlocker, attemptExpiry, orderOptions, withholdScores } = require("../src/services/attemptRules");
const { assessmentPayload } = require("../src/services/assessmentPublishing");
const { startAttempt, previewAttempt, getResult } = require("../src/controllers/attemptController");
const { learningStreak, areaPerformance } = require("../src/controllers/studentDashboardController");
const { updateQuestion } = require("../src/controllers/questionBankController");
const { recordVisit } = require("../src/controllers/homeContentController");
const { clearStudentReferences } = require("../src/middleware/academicIntegrity");
const id = n => String(n).padStart(24, "0");
const query = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value });
const response = () => ({ json(value) { this.body = value; return this; }, status(value) { this.code = value; return this; } });
const questions = Array.from({ length: 6 }, (_, index) => ({ question: id(index + 1), marks: 1, order: index + 1 }));
afterEach(() => mock.restoreAll());

test("tests cannot start before opening, after closing, or beyond the allowed attempts", async () => {
    const now = new Date("2026-05-01T10:00:00Z");
    assert.match(await startBlocker({ startsAt: new Date("2026-05-02T00:00:00Z") }, id(1), now), /opens on/);
    assert.match(await startBlocker({ endsAt: new Date("2026-05-01T09:00:00Z") }, id(1), now), /closed on/);
    assert.equal(await startBlocker({ startsAt: new Date("2026-04-01"), endsAt: new Date("2026-06-01") }, id(1), now), null);
    let filter;
    mock.method(Attempt, "countDocuments", async value => { filter = value; return 2; });
    assert.match(await startBlocker({ _id: id(9), maxAttempts: 2 }, id(1), now), /all 2 allowed attempts/);
    assert.deepEqual(filter.status, { $ne: "abandoned" });
    assert.equal(await startBlocker({ _id: id(9), maxAttempts: 3 }, id(1), now), null);
});

test("an attempt never runs past the test's closing time", () => {
    const now = new Date("2026-05-01T10:00:00Z");
    assert.equal(attemptExpiry({}, now, 30).toISOString(), "2026-05-01T10:30:00.000Z");
    assert.equal(attemptExpiry({ endsAt: "2026-05-01T10:10:00Z" }, now, 30).toISOString(), "2026-05-01T10:10:00.000Z");
});

test("test settings are validated before saving", () => {
    const base = { board: id(1), class: id(2), subject: id(3), type: "subject_test" };
    assert.equal(assessmentPayload({ ...base, maxAttempts: "3" }).maxAttempts, 3);
    assert.equal(assessmentPayload({ ...base, startsAt: "" }).startsAt, null);
    assert.ok(assessmentPayload({ ...base, startsAt: "2026-05-01T10:00:00.000Z" }).startsAt instanceof Date);
    for (const body of [{ maxAttempts: -1 }, { maxAttempts: 1.5 }, { maxAttempts: 101 }, { shuffleOptions: "yes" }, { startsAt: "not a date" }, { startsAt: "2026-05-02T00:00:00Z", endsAt: "2026-05-01T00:00:00Z" }]) {
        assert.throws(() => assessmentPayload({ ...base, ...body }), { status: 400 });
    }
});

test("blocked tests explain why in the preview", async () => {
    mock.method(Assessment, "findById", () => query({ _id: id(90), type: "subject_test", status: "published", createdBy: id(91), questions, startsAt: new Date(Date.now() + 86400000) }));
    mock.method(Attempt, "findOne", () => query(null));
    const res = response();
    await previewAttempt({ query: { assessmentId: id(90) }, student: { _id: id(93) } }, res);
    assert.equal(res.code, 403);
    assert.match(res.body.message, /opens on/);
});

test("shuffled tests store a per-attempt question and option order while grading keys stay unchanged", async () => {
    const assessment = { _id: id(90), type: "subject_test", status: "published", createdBy: id(91), questions, totalMarks: 6, passingMarks: 3, durationMinutes: 10, allowResume: false, shuffleQuestions: true, shuffleOptions: true };
    let saved;
    let selected;
    mock.method(Assessment, "findById", () => query(assessment));
    mock.method(Attempt, "findOne", filter => query(filter._id ? saved : null));
    mock.method(Attempt, "create", async payload => { saved = { ...payload, _id: id(92) }; return saved; });
    mock.method(Question, "find", filter => ({ ...query(filter._id.$in.map(_id => ({ _id, type: "standard_mcq", correctOption: "B", marks: 1, options: [{ key: "A" }, { key: "B" }, { key: "C" }, { key: "D" }] }))), select(value) { selected = value; return this; } }));
    mock.method(Activity, "create", async () => ({}));
    await startAttempt({ body: { assessmentId: id(90) }, student: { _id: id(93) } }, response());
    assert.match(selected, /options\.key/);
    assert.deepEqual(saved.answers.map(item => item.question).sort(), questions.map(item => item.question).sort());
    for (const answer of saved.answers) assert.deepEqual([...answer.optionOrder].sort(), ["A", "B", "C", "D"]);
    assert.ok(saved.gradingSnapshot.every(item => item.correctOption === "B"));
});

test("shuffled options are shown in attempt order with positional labels", () => {
    const answer = { optionOrder: ["C", "A", "B"], question: { options: [{ key: "A", text: "one" }, { key: "B", text: "two" }, { key: "C", text: "three" }] } };
    orderOptions(answer);
    assert.deepEqual(answer.question.options.map(option => [option.label, option.key]), [["A", "C"], ["B", "A"], ["C", "B"]]);
    const plain = { question: { options: [{ key: "A" }] } };
    orderOptions(plain);
    assert.equal(plain.question.options[0].label, undefined);
});

test("withheld results hide scores, correctness and answer keys until released", async () => {
    const attempt = {
        _id: id(1), status: "submitted", score: 4, totalMarks: 5, percentage: 80, passStatus: "pass", submittedAt: new Date(),
        assessment: { title: "Mock", type: "mock_test", showResultImmediately: false },
        gradingSnapshot: [{ question: id(2), correctOption: "A", marks: 5 }],
        answers: [{ question: { _id: id(2), options: [{ key: "A" }], explanation: "why" }, selectedOption: "A", isCorrect: true, marksAwarded: 5 }],
    };
    mock.method(Attempt, "findOne", () => query(attempt));
    mock.method(LeaderboardState, "findOne", () => { throw new Error("Withheld results must not compute ranking"); });
    const res = response();
    await getResult({ params: { id: id(1) }, student: { _id: id(3) } }, res);
    const body = res.body.attempt;
    assert.equal(body.resultsWithheld, true);
    for (const key of ["score", "percentage", "passStatus", "points", "gradingSnapshot"]) assert.equal(Object.hasOwn(body, key), false);
    assert.equal(Object.hasOwn(body.answers[0], "isCorrect"), false);
    assert.equal(Object.hasOwn(body.answers[0].question, "correctOption"), false);
    assert.equal(Object.hasOwn(body.answers[0].question, "explanation"), false);
    assert.equal(body.answers[0].selectedOption, "A");
    assert.equal(withholdScores({ answers: [] }).resultsWithheld, true);
});

test("learning streak counts consecutive Pakistan-time days ending today or yesterday", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const on = day => ({ startedAt: new Date(`2026-05-${day}T08:00:00Z`) });
    assert.equal(learningStreak([], now), 0);
    assert.equal(learningStreak([on("10"), on("09"), on("08"), on("06")], now), 3);
    assert.equal(learningStreak([on("09"), on("08")], now), 2);
    assert.equal(learningStreak([on("07")], now), 0);
    // 20:30 UTC on 9 May is 01:30 on 10 May in Pakistan.
    assert.equal(learningStreak([{ startedAt: new Date("2026-05-09T20:30:00Z") }], now), 1);
});

test("weak and strong areas use the most specific syllabus level of each test", () => {
    const subject = { _id: id(1), name: "Physics" };
    const chapter = { _id: id(2), name: "Motion" };
    const topic = { _id: id(3), name: "Speed" };
    const areas = areaPerformance([
        { percentage: 40, assessment: { subject, chapter, topic } },
        { percentage: 60, assessment: { subject, chapter, topic } },
        { percentage: 90, assessment: { subject, chapter } },
    ]);
    assert.deepEqual(areas.map(area => [area.name, area.level, area.average, area.attempts]), [["Speed", "topic", 50, 2], ["Motion", "chapter", 90, 1]]);
});

test("editing a written question without a topic returns a clear 400 message", async () => {
    const res = response();
    await updateQuestion({ params: { id: id(1) }, body: { contentType: "short_question", questionText: "Define speed." }, admin: { _id: id(2) } }, res);
    assert.equal(res.code, 400);
    assert.match(res.body.message, /chapter and topic/);
});

test("crawlers and rate-limited visits are acknowledged without increasing the count", async () => {
    mock.method(SiteMetric, "findOne", () => query({ total: 41 }));
    mock.method(SiteMetric, "findOneAndUpdate", () => { throw new Error("Must not count"); });
    for (const req of [{ get: () => "Googlebot/2.1" }, { get: () => "Mozilla/5.0", visitNotCounted: true }]) {
        const res = response();
        await recordVisit(req, res);
        assert.deepEqual(res.body, { success: true, counted: false, total: 41 });
    }
});

test("deleting academic records clears student profile references", async () => {
    const calls = [];
    mock.method(Student, "updateMany", async (filter, update) => { calls.push([filter, update]); });
    await clearStudentReferences("Class", id(1));
    await clearStudentReferences("Subject", id(2));
    await clearStudentReferences("Chapter", id(3));
    assert.deepEqual(calls, [[{ class: id(1) }, { $unset: { class: "" } }], [{ enrolledSubjects: id(2) }, { $pull: { enrolledSubjects: id(2) } }]]);
});

test("admin reset codes are keyed per admin and compared in constant time", async () => {
    const crypto = require("node:crypto");
    const Admin = require("../src/models/Admin");
    const { resetAdminPassword } = require("../src/controllers/adminController");
    const adminId = id(7);
    const keyed = crypto.createHmac("sha256", process.env.JWT_SECRET).update(`admin-reset:${adminId}:123456`).digest("hex");
    const plain = crypto.createHash("sha256").update("123456").digest("hex");
    const updates = [];
    mock.method(Admin, "updateOne", async (filter, update) => { updates.push(update); return { modifiedCount: 1 }; });
    for (const [stored, expected] of [[plain, 400], [keyed, undefined]]) {
        mock.method(Admin, "findOne", () => ({ select: async () => ({ _id: adminId, passwordResetOtpHash: stored, passwordResetExpiresAt: new Date(Date.now() + 60000), passwordResetAttempts: 0 }) }));
        const res = response();
        await resetAdminPassword({ body: { email: "a@example.com", otp: "123456", password: "new-password-1" } }, res);
        assert.equal(res.code, expected);
    }
    assert.ok(updates.at(-1).$set.password);
});
