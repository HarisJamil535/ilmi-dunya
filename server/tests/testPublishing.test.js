const { test } = require("node:test");
const assert = require("node:assert/strict");
const { testState, openNow } = require("../src/services/testPublishing");

test("a test's publishing state follows its status and opening and closing times", () => {
    const now = new Date("2026-05-01T10:00:00Z");
    assert.equal(testState({ status: "draft" }, now), "off");
    assert.equal(testState({ status: "published" }, now), "live");
    assert.equal(testState({ status: "published", startsAt: new Date("2026-05-01T09:00:00Z") }, now), "live");
    assert.equal(testState({ status: "published", startsAt: new Date("2026-05-02T09:00:00Z") }, now), "scheduled");
    assert.equal(testState({ status: "published", endsAt: new Date("2026-05-01T09:00:00Z") }, now), "closed");
});

test("students only get tests that are published and open right now", () => {
    const now = new Date("2026-05-01T10:00:00Z");
    const filter = openNow(now);
    assert.equal(filter.status, "published");
    assert.deepEqual(filter.$and[0].$or[2], { startsAt: { $lte: now } });
    assert.deepEqual(filter.$and[1].$or[2], { endsAt: { $gt: now } });
});

const { mock } = require("node:test");
const mongoose = require("mongoose");
const Question = require("../src/models/Question");
const { answersSentWithSubmit } = require("../src/controllers/attemptController");

test("answers sent with a submit are checked before they are graded", async () => {
    const [q1, q2] = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    mock.method(Question, "find", () => ({ select: () => ({ lean: async () => [{ _id: q1, options: [{ key: "A" }, { key: "B" }] }, { _id: q2, options: [{ key: "A" }, { key: "B" }] }] }) }));
    const now = new Date("2026-05-01T10:00:00Z");
    const attempt = () => ({ expiresAt: new Date("2026-05-01T10:30:00Z"), answers: [{ question: q1 }, { question: q2 }] });

    const ok = attempt();
    assert.deepEqual(await answersSentWithSubmit(ok, [{ question: String(q1), selectedOption: "B" }, { question: String(q2), flaggedForReview: true }], now), {});
    assert.equal(ok.answers[0].selectedOption, "B");
    assert.equal(ok.answers[0].skipped, false);
    assert.equal(ok.answers[1].flaggedForReview, true);

    assert.match((await answersSentWithSubmit(attempt(), [{ question: String(q1), selectedOption: "Z" }], now)).error, /valid answer/);
    assert.match((await answersSentWithSubmit(attempt(), [{ question: String(new mongoose.Types.ObjectId()), selectedOption: "A" }], now)).error, /does not belong/);
    assert.match((await answersSentWithSubmit(attempt(), "A", now)).error, /at most once/);
    assert.match((await answersSentWithSubmit(attempt(), [{}, {}, {}], now)).error, /at most once/);

    const late = attempt();
    assert.deepEqual(await answersSentWithSubmit(late, [{ question: String(q1), selectedOption: "A" }], new Date("2026-05-01T10:31:00Z")), {});
    assert.equal(late.answers[0].selectedOption, undefined, "answers arriving after time is up are ignored");
    mock.restoreAll();
});

const { identitiesOf } = require("../src/services/studentBlocking");

test("a block matches the email in any case and the number however it was typed", () => {
    const keys = list => list.map(item => `${item.kind}:${item.value}`).sort();
    const stored = keys(identitiesOf({ email: "Ali@Example.com ", phone: "+923001234567" }));
    for (const typed of ["0300 1234567", "0300-1234567", "923001234567", "00923001234567", "+92 300 1234567"]) {
        assert.deepEqual(keys(identitiesOf({ email: "ali@example.com", phone: typed })), stored, typed);
    }
    assert.deepEqual(identitiesOf({}), []);
});
