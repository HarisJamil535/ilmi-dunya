const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Assessment = require("../src/models/Assessment");
const Chapter = require("../src/models/Chapter");
const Topic = require("../src/models/Topic");
const { timingOf, attemptSeconds, parseTiming, timingFields } = require("../src/services/testTiming");
const { scopeTiming } = require("../src/services/scopeTest");
const { changePublishing } = require("../src/services/testPublishing");

const id = () => new mongoose.Types.ObjectId();
const query = value => ({ select() { return this; }, sort() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const questions = n => Array.from({ length: n }, () => ({ question: id() }));
afterEach(() => mock.restoreAll());

test("tests saved before timing existed keep their old time", () => {
    assert.deepEqual(timingOf({ type: "topic_test", durationMinutes: 45 }), { mode: "per_question", secondsPerQuestion: 60 });
    assert.deepEqual(timingOf({ type: "mock_test", durationMinutes: 45 }), { mode: "total", minutes: 45 });
    assert.equal(attemptSeconds({ type: "chapter_test", questions: questions(20) }, 12), 12 * 60, "one minute per chosen MCQ, as before");
    assert.equal(attemptSeconds({ type: "mock_test", durationMinutes: 45, questions: questions(50) }, 50), 45 * 60);
});

test("per-question time counts each MCQ; a total time is shared out for a shorter set", () => {
    assert.equal(attemptSeconds({ type: "topic_test", timingMode: "per_question", secondsPerQuestion: 45, questions: questions(30) }, 10), 450);
    const total = { type: "topic_test", timingMode: "total", durationMinutes: 20, questions: questions(40) };
    assert.equal(attemptSeconds(total, 40), 1200, "the full set gets the full time");
    assert.equal(attemptSeconds(total, 10), 300, "a quarter of the MCQs gets a quarter of the time");
    assert.equal(attemptSeconds({ type: "topic_test", timingMode: "per_question", secondsPerQuestion: 10, questions: questions(2) }, 2), 30, "never under 30 seconds");
});

test("admin timing is validated and stored with a matching display duration", () => {
    assert.deepEqual(parseTiming({ mode: "per_question", secondsPerQuestion: "90" }), { mode: "per_question", secondsPerQuestion: 90 });
    assert.deepEqual(parseTiming({ mode: "total", minutes: 25 }), { mode: "total", minutes: 25 });
    for (const bad of [{}, { mode: "per_question", secondsPerQuestion: 5 }, { mode: "per_question", secondsPerQuestion: 601 }, { mode: "per_question", secondsPerQuestion: 7.5 }, { mode: "total", minutes: 0 }, { mode: "total", minutes: 1441 }, { mode: "both" }]) {
        assert.throws(() => parseTiming(bad), { status: 400 }, JSON.stringify(bad));
    }
    assert.deepEqual(timingFields({ mode: "per_question", secondsPerQuestion: 45 }, 30), { $set: { timingMode: "per_question", secondsPerQuestion: 45, durationMinutes: 23 } });
    assert.deepEqual(timingFields({ mode: "total", minutes: 25 }, 30), { $set: { timingMode: "total", durationMinutes: 25 }, $unset: { secondsPerQuestion: 1 } });
});

test("a complete chapter test uses the chapter's own time, else the topic tests' time", () => {
    const topicTests = [{ type: "topic_test", timingMode: "per_question", secondsPerQuestion: 45, questions: questions(10) }, { type: "topic_test", timingMode: "per_question", secondsPerQuestion: 45, questions: questions(6) }];
    assert.deepEqual(scopeTiming(null, topicTests), { timingMode: "per_question", secondsPerQuestion: 45, durationMinutes: 12 });
    assert.deepEqual(scopeTiming({ mode: "total", minutes: 40 }, topicTests), { timingMode: "total", secondsPerQuestion: null, durationMinutes: 40 });
    assert.deepEqual(scopeTiming({ mode: "per_question", secondsPerQuestion: 90 }, topicTests), { timingMode: "per_question", secondsPerQuestion: 90, durationMinutes: 24 });
    const mixed = [topicTests[0], { type: "topic_test", timingMode: "total", durationMinutes: 8, questions: questions(6) }];
    assert.deepEqual(scopeTiming(null, mixed), { timingMode: "total", secondsPerQuestion: null, durationMinutes: 16 }, "7.5 + 8 minutes, rounded up");
});

test("admins set a topic's time, or a chapter's with an option to pass it to every topic test", async () => {
    const chapter = { _id: id(), name: "Motion", board: id(), class: id(), group: id(), subject: id() };
    const topic = { _id: id(), name: "Speed", chapterId: chapter._id };
    const tests = [{ _id: id(), questions: questions(12) }];
    const writes = [];
    let chapterUpdate = null;
    mock.method(Topic, "findById", () => query(topic));
    mock.method(Topic, "find", () => query([topic]));
    mock.method(Chapter, "findById", () => query(chapter));
    mock.method(Chapter, "updateOne", async (filter, update) => { chapterUpdate = update; });
    mock.method(Assessment, "distinct", async () => [topic._id]);
    const finds = [];
    mock.method(Assessment, "find", filter => { finds.push(filter); return query(tests); });
    mock.method(Assessment, "bulkWrite", async ops => { writes.push(...ops); });

    const result = await changePublishing({ topic: String(topic._id), action: "timing", timing: { mode: "per_question", secondsPerQuestion: 45 } }, id());
    assert.equal(result.changed, 1);
    assert.equal(finds[0].type, "topic_test");
    assert.deepEqual(writes[0].updateOne.update, { $set: { timingMode: "per_question", secondsPerQuestion: 45, durationMinutes: 9 } });

    writes.length = 0; finds.length = 0;
    await changePublishing({ chapter: String(chapter._id), action: "timing", timing: { mode: "per_question", secondsPerQuestion: 30 }, applyToTopics: true }, id());
    assert.deepEqual(chapterUpdate, { $set: { testTiming: { mode: "per_question", secondsPerQuestion: 30 } } });
    assert.deepEqual(finds.map(filter => filter.type), ["chapter_test", "topic_test"], "chapter tests and, when asked, every topic test");

    finds.length = 0;
    await changePublishing({ chapter: String(chapter._id), action: "timing", timing: { mode: "total", minutes: 40 }, applyToTopics: true }, id());
    assert.deepEqual(finds.map(filter => filter.type), ["chapter_test"], "a total time belongs to the whole chapter test only");
    await assert.rejects(changePublishing({ topic: String(topic._id), action: "timing", timing: { mode: "total", minutes: 0 } }, id()), { status: 400 });
});
