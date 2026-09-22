const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");
const mongoose = require("mongoose");
const Chapter = require("../src/models/Chapter");
const Topic = require("../src/models/Topic");
const Question = require("../src/models/Question");
const Assessment = require("../src/models/Assessment");
const { resolveScope, createScopeTest } = require("../src/services/scopeTest");
const { getPublicTopicQuestions } = require("../src/controllers/questionBankController");
const id = () => new mongoose.Types.ObjectId();
const chapter = { _id: id(), name: "Motion", board: id(), class: id(), group: id(), subject: id() };
const topic = { _id: id(), chapterId: chapter._id, name: "Periodic motion" };
const query = result => ({ sort() { return this; }, select() { return this; }, lean: async () => result });
function parents() {
    mock.method(Chapter, "findById", () => query(chapter));
    mock.method(Topic, "findById", () => query(topic));
}
afterEach(() => mock.restoreAll());

test("chapter test includes every matching MCQ without imposing a topic or limit", async () => {
    parents();
    let filter;
    const questions = Array.from({ length: 120 }, () => ({ _id: id(), marks: 1, estimatedTimeSeconds: 30 }));
    mock.method(Question, "find", value => { filter = value; return query(questions); });
    mock.method(Assessment, "findOneAndUpdate", (key, update) => query({ ...key, ...update.$setOnInsert }));
    const test = await createScopeTest(String(chapter._id));
    assert.equal(filter.topic, undefined);
    assert.equal(String(filter.board), String(chapter.board));
    assert.deepEqual(filter.contentType.$nin, ["long_question", "short_question"]);
    assert.equal(filter.status, "published");
    assert.equal(test.questions.length, 120);
    assert.equal(test.totalMarks, 120);
    assert.equal(test.durationMinutes, 60);
});

test("topic test inherits the parent context and restricts questions to that topic", async () => {
    parents();
    let filter;
    mock.method(Question, "find", value => { filter = value; return query([{ _id: id(), marks: 2, estimatedTimeSeconds: 60 }]); });
    mock.method(Assessment, "findOneAndUpdate", (key, update) => query({ ...key, ...update.$setOnInsert }));
    const test = await createScopeTest(undefined, String(topic._id));
    assert.equal(String(filter.topic), String(topic._id));
    for (const key of ["board", "class", "group", "subject"]) assert.equal(String(filter[key]), String(chapter[key]));
    assert.equal(test.type, "topic_test");
});

test("invalid or mismatched study context is rejected", async () => {
    await assert.rejects(resolveScope("bad-id"), { status: 400 });
    parents();
    await assert.rejects(resolveScope(String(id()), String(topic._id)), { status: 400 });
});

test("empty MCQ scope gives a useful error without creating a test", async () => {
    parents();
    mock.method(Question, "find", () => query([]));
    await assert.rejects(createScopeTest(String(chapter._id)), { status: 404 });
});

test("written questions require no options; MCQs still require options and an answer", () => {
    const base = { questionText: "Describe periodic motion.", ...chapter, chapter: chapter._id, topic: topic._id };
    delete base._id;
    for (const contentType of ["long_question", "short_question"]) {
        assert.equal(new Question({ ...base, contentType }).validateSync(), undefined);
    }
    const error = new Question({ ...base, contentType: "mcq" }).validateSync();
    assert.ok(error.errors.options);
    assert.ok(error.errors.correctOption);
});

test("public written questions use topic ancestry and cannot return MCQs", async () => {
    parents();
    let filter;
    mock.method(Question, "find", value => { filter = value; return query([]); });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await getPublicTopicQuestions({ query: { topic: String(topic._id), contentType: "short_question", board: String(id()) } }, res);
    assert.equal(filter.contentType, "short_question");
    assert.equal(String(filter.board), String(chapter.board));
    await getPublicTopicQuestions({ query: { topic: String(topic._id), contentType: "mcq" } }, res);
    assert.equal(res.code, 400);
});

test("hierarchical topic numbers retain all segments", () => {
    const doc = new Topic({ name: "Topic", topicNumber: "2.3.5", chapterId: chapter._id, subjectId: chapter.subject, boardId: chapter.board, classId: chapter.class, groupId: chapter.group });
    assert.equal(doc.validateSync(), undefined);
    assert.equal(doc.topicNumber, "2.3.5");
});
