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
