const { test } = require("node:test");
const assert = require("node:assert/strict");
const { scoreAttempt, rankedAttempts, scoreTest, scoreStudent, buildRanking, attemptRankingNote, RULES } = require("../src/services/ranking");

const base = new Date("2026-05-01T08:00:00Z").getTime();
let seq = 0;
// An attempt with `pct` percent correct on `n` questions, using `share` of the allowed time, started `hours` after base.
const att = ({ pct = 80, n = 20, share = 0.8, hours = 0, scope = "s1", student = "a", type = "topic_test", chapter = "c1" } = {}) => {
    const startedAt = new Date(base + hours * 3600e3);
    const allowed = n * 60;
    return { _id: `x${++seq}`, student, scopeKey: scope, type, chapter, score: pct * n / 100, totalMarks: n, questionCount: n, startedAt, expiresAt: new Date(startedAt.getTime() + allowed * 1000), submittedAt: new Date(startedAt.getTime() + allowed * share * 1000), timeTakenSeconds: allowed * share };
};

test("an attempt is 90% accuracy plus a speed bonus that needs at least 60% correct", () => {
    assert.equal(scoreAttempt(att({ pct: 100, share: 1 })).score, 90, "full time, no bonus");
    assert.equal(scoreAttempt(att({ pct: 100, share: 0.5 })).score, 100, "half time, full bonus");
    assert.equal(scoreAttempt(att({ pct: 100, share: 0.75 })).score, 95);
    assert.equal(scoreAttempt(att({ pct: 50, share: 0.2 })).score, 45, "below 60% no speed bonus");
    assert.ok(scoreAttempt(att({ pct: 80, share: 0.5 })).score < scoreAttempt(att({ pct: 90, share: 1 })).score + 10);
});

test("answering in under 3 seconds per question is guessing and scores 0", () => {
    const rushed = att({ pct: 100, n: 20, share: 50 / 1200 }); // 50 s for 20 questions
    assert.deepEqual([scoreAttempt(rushed).score, scoreAttempt(rushed).guessed], [0, true]);
    assert.equal(scoreAttempt(att({ pct: 100, n: 20, share: 70 / 1200 })).guessed, false);
});

test("retakes count only 12 hours apart, at most 3, and the first attempt weighs 60%", () => {
    const list = [att({ pct: 40, hours: 0 }), att({ pct: 100, hours: 1 }), att({ pct: 100, hours: 13 }), att({ pct: 100, hours: 30 }), att({ pct: 100, hours: 50 })];
    const ranked = rankedAttempts(list);
    assert.deepEqual(ranked.map(a => a._id), [list[0]._id, list[2]._id, list[3]._id]);
    const t = scoreTest(list);
    const first = scoreAttempt(list[0]).score, best = scoreAttempt(list[2]).score;
    assert.equal(t.score, Number((0.6 * first + 0.4 * best).toFixed(2)));
    assert.ok(t.score < best, "memorising answers on a retake cannot give full marks");
});

test("short tests weigh less than full-length tests", () => {
    assert.equal(scoreTest([att({ n: 5 })]).weight, 0.5);
    assert.equal(scoreTest([att({ n: 20 })]).weight, 1);
    assert.equal(scoreTest([att({ n: 60 })]).weight, 1);
});

test("a chapter test and its topic tests do not both count", () => {
    const topicA = scoreTest([att({ pct: 90, scope: "t1" })]), topicB = scoreTest([att({ pct: 90, scope: "t2" })]);
    const chapter = scoreTest([att({ pct: 60, scope: "ch", type: "chapter_test" })]);
    const both = scoreStudent([{ ...topicA, type: "topic_test", chapter: "c1" }, { ...topicB, type: "topic_test", chapter: "c1" }, { ...chapter, type: "chapter_test", chapter: "c1" }]);
    assert.equal(both.testsTaken, 2, "the better set (topics) is kept, the chapter test is dropped");
    const other = scoreStudent([{ ...topicA, type: "topic_test", chapter: "c1" }, { ...chapter, type: "chapter_test", chapter: "c2" }]);
    assert.equal(other.testsTaken, 2, "different chapters both count");
});

test("many low scores no longer beat fewer high scores, and one lucky test cannot top the board", () => {
    const many = (student, pct, count) => Array.from({ length: count }, (_, i) => att({ student, pct, share: 1, scope: `${student}-${i}`, chapter: `${student}-c${i}` }));
    const { ranked, all } = buildRanking([...many("A", 30, 40), ...many("B", 90, 10), ...many("C", 100, 1), ...many("D", 85, 40)]);
    assert.deepEqual(ranked.map(r => r.studentId), ["D", "B", "A"], "C needs 3 tests to be ranked");
    const byId = Object.fromEntries(all.map(r => [r.studentId, r]));
    assert.ok(byId.B.points > byId.A.points * 1.8, "accuracy dominates volume");
    assert.ok(byId.C.points < byId.B.points, "a single 100% is pulled toward the 50% starting point");
    assert.equal(byId.C.ranked, false);
    assert.ok(byId.D.points <= 1000 && byId.D.points > 700);
});

test("low averages are never lifted, and guessing earns nothing", () => {
    const runs = (student, pct, count, share = 1) => Array.from({ length: count }, (_, i) => att({ student, pct, share, scope: `${student}-${i}`, chapter: `${student}-c${i}` }));
    const { all } = buildRanking([...runs("weak", 30, 10), ...runs("guess", 100, 5, 0.01), ...runs("solid", 95, 3), ...runs("busy", 50, 40)]);
    const byId = Object.fromEntries(all.map(r => [r.studentId, r]));
    assert.equal(byId.guess.points, 0);
    assert.equal(byId.guess.ranked, false, "a zero score is not listed");
    assert.ok(Math.abs(byId.weak.skill - 27) < 0.01, "30% accuracy stays 27 (90% share), not pulled up toward 50");
    assert.ok(byId.solid.points > byId.busy.points * 0.95, "3 tests at 95% stay close to 40 tests at 50%");
});

test("ties go to higher accuracy, then faster answers", () => {
    const { ranked } = buildRanking([
        ...[0, 1, 2].map(i => att({ student: "slow", pct: 80, share: 1, scope: `s${i}`, chapter: `s${i}` })),
        ...[0, 1, 2].map(i => att({ student: "fast", pct: 80, share: 1, n: 20, scope: `f${i}`, chapter: `f${i}` })),
    ]);
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].rank, 1, "identical records share a rank");
});

test("the result page explains whether an attempt counts", () => {
    const first = att({ scope: "r", hours: 0 }), quick = att({ scope: "r", hours: 2 }), later = att({ scope: "r", hours: 14 });
    assert.equal(attemptRankingNote(first, [first, quick, later]).counts, true);
    assert.match(attemptRankingNote(quick, [first, quick, later]).reason, /12 hours/);
    assert.equal(attemptRankingNote(later, [first, quick, later]).counts, true);
    const rushed = att({ scope: "q", share: 0.01 });
    assert.deepEqual([attemptRankingNote(rushed, [rushed]).score, attemptRankingNote(rushed, [rushed]).counts], [0, true]);
    assert.equal(RULES.minTestsToRank, 3);
});
