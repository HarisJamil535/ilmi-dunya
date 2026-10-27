const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { normalizeConfig, generateSelection, buildPaper, allocate, plainMath, totalMarks } = require("../src/services/paperEngine");

const oid = () => String(new mongoose.Types.ObjectId());
const ids = { board: oid(), class: oid(), subject: oid(), ch1: oid(), ch2: oid(), t1: oid() };
const base = (sections, extra = {}) => ({ header: { schoolName: "APS", examName: "Mid Term" }, scope: { board: ids.board, class: ids.class, subject: ids.subject, chapters: [{ chapter: ids.ch1 }, { chapter: ids.ch2 }] }, sections, ...extra });
const mcq = (chapter, n, extra = {}) => ({ _id: oid(), contentType: "mcq", chapter, topic: ids.t1, questionText: `MCQ ${n}`, options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }, { key: "C", text: "Three" }, { key: "D", text: "All of the above" }], correctOption: "B", ...extra });
const written = (chapter, type, n) => ({ _id: oid(), contentType: type, chapter, topic: ids.t1, questionText: `${type} ${n}` });
const bank = () => [
    ...Array.from({ length: 30 }, (_, i) => mcq(i % 2 ? ids.ch1 : ids.ch2, i)),
    ...Array.from({ length: 12 }, (_, i) => written(i % 2 ? ids.ch1 : ids.ch2, "short_question", i)),
    ...Array.from({ length: 12 }, (_, i) => written(i % 2 ? ids.ch1 : ids.ch2, "long_question", i)),
];

test("patterns are validated with clear messages and marks add up", () => {
    const config = normalizeConfig(base([{ kind: "mcq", total: 12, marksEach: 1 }, { kind: "short", total: 10, attempt: 7, marksEach: 2 }, { kind: "long", total: 5, attempt: 3, marksEach: 8, choice: true }]));
    assert.equal(totalMarks(config), 12 + 14 + 24, "attempt × marks for each section");
    assert.equal(config.sections[0].attempt, 12, "MCQs are always all attempted");
    assert.equal(config.sections[2].choice, true);
    for (const bad of [[], [{ kind: "essay", total: 3, marksEach: 1 }], [{ kind: "short", total: 5, attempt: 6, marksEach: 2 }], [{ kind: "mcq", total: 5, marksEach: 0 }], [{ kind: "mcq", total: 5, marksEach: 1.3 }], [{ kind: "mcq", total: 500, marksEach: 1 }]]) {
        assert.throws(() => normalizeConfig(base(bad)), { status: 400 }, JSON.stringify(bad));
    }
    assert.throws(() => normalizeConfig({ ...base([{ kind: "mcq", total: 5, marksEach: 1 }]), scope: { board: ids.board, class: ids.class, subject: ids.subject, chapters: [] } }), /chapter/);
    assert.deepEqual(normalizeConfig(base([{ kind: "mcq", total: 5, marksEach: 0.5 }], { versions: ["b", "A", "z"] })).versions, ["A", "B"]);
});

test("weights share questions between chapters and never exceed what exists", () => {
    const shares = allocate(10, [{ key: "a", weight: 3, cap: 99 }, { key: "b", weight: 1, cap: 99 }]);
    assert.deepEqual([shares.get("a"), shares.get("b")], [8, 2]);
    const capped = allocate(10, [{ key: "a", weight: 1, cap: 2 }, { key: "b", weight: 1, cap: 99 }]);
    assert.deepEqual([capped.get("a"), capped.get("b")], [2, 8], "leftover goes to the chapter with room");
    assert.equal([...allocate(5, [{ key: "a", weight: 1, cap: 1 }, { key: "b", weight: 1, cap: 1 }]).values()].reduce((a, b) => a + b), 2);
});

test("auto picking fills every section without repeating a question, spread over the chapters", () => {
    const config = normalizeConfig(base([{ kind: "mcq", total: 12, marksEach: 1 }, { kind: "short", total: 6, attempt: 4, marksEach: 2 }, { kind: "long", total: 3, marksEach: 8, choice: true }]));
    const { selection, warnings } = generateSelection(config, bank(), { seed: "x" });
    assert.deepEqual(warnings, []);
    assert.equal(selection.S1.reduce((sum, slot) => sum + slot.questions.length, 0), 12);
    assert.equal(selection.S2.length, 6);
    assert.equal(selection.S3.length, 3);
    assert.ok(selection.S3.every(slot => slot.questions.length === 2), "every long question has an either/or pair");
    const all = Object.values(selection).flat().flatMap(slot => slot.questions);
    assert.equal(new Set(all).size, all.length, "no question is used twice");
    const again = generateSelection(config, bank(), { seed: "x" });
    assert.equal(again.selection.S1.length, selection.S1.length);
    const chapterOf = new Map(bank().map(q => [String(q._id), String(q.chapter)]));
    const bankMap = bank();
    const { selection: even } = generateSelection(config, bankMap, { seed: "y" });
    const perChapter = even.S1.flatMap(slot => slot.questions).map(id => bankMap.find(q => String(q._id) === id).chapter);
    assert.ok(Math.abs(perChapter.filter(c => c === ids.ch1).length - 6) <= 1, "two equal chapters share the MCQs evenly");
    void chapterOf;
});

test("scenario questions stay together and count toward the MCQ total", () => {
    const scenario = oid();
    const questions = [...Array.from({ length: 10 }, (_, i) => mcq(ids.ch1, i)), ...Array.from({ length: 4 }, (_, i) => mcq(ids.ch1, 100 + i, { scenario }))];
    const config = normalizeConfig({ ...base([{ kind: "mcq", total: 8, marksEach: 1 }]), scope: { board: ids.board, class: ids.class, subject: ids.subject, chapters: [{ chapter: ids.ch1 }] } });
    for (let n = 0; n < 25; n++) {
        const { selection } = generateSelection(config, questions, { seed: `s${n}` });
        const total = selection.S1.reduce((sum, slot) => sum + slot.questions.length, 0);
        assert.equal(total, 8);
        for (const slot of selection.S1.filter(slot => slot.scenario)) assert.equal(slot.questions.length, 4, "all four scenario questions or none");
    }
    const tight = generateSelection(normalizeConfig({ ...base([{ kind: "mcq", total: 3, marksEach: 1 }]), scope: { board: ids.board, class: ids.class, subject: ids.subject, chapters: [{ chapter: ids.ch1 }] } }), questions.slice(10), { seed: "t" });
    assert.equal(tight.selection.S1.reduce((sum, slot) => sum + slot.questions.length, 0), 0, "a block bigger than the room is skipped, not split");
    assert.equal(tight.warnings.length, 1);
});

test("shortages produce warnings instead of broken papers", () => {
    const config = normalizeConfig(base([{ kind: "mcq", total: 99, marksEach: 1 }]));
    const { selection, warnings } = generateSelection(config, bank().slice(0, 5), { seed: "w" });
    assert.equal(selection.S1.length, 5);
    assert.match(warnings[0].message, /only 5 of 99/);
});

test("the printed paper has numbered questions, marks lines and an answer key; versions shuffle but keep answers right", () => {
    const config = normalizeConfig(base([{ kind: "mcq", total: 10, marksEach: 0.5 }, { kind: "short", total: 5, attempt: 3, marksEach: 2 }, { kind: "long", total: 2, marksEach: 8, choice: true }], { versions: ["A", "B"] }));
    const questions = bank();
    const { selection } = generateSelection(config, questions, { seed: "p" });
    const a = buildPaper(config, selection, questions, "A", { seed: "p" });
    const b = buildPaper(config, selection, questions, "B", { seed: "p" });
    assert.equal(a.totalMarks, 5 + 6 + 16);
    assert.equal(a.sections[1].attemptLine.startsWith("Attempt any 3 of the following 5 short questions."), true);
    assert.match(a.sections[2].attemptLine, /choosing one from each pair/);
    assert.equal(a.sections[2].items[0].alternatives.length, 2);
    assert.deepEqual(a.sections[0].items.map(item => item.no), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(a.key.length, 10);
    const stem = (paper, n) => paper.sections[0].items.find(item => item.no === n).text;
    assert.notDeepEqual(a.sections[0].items.map(item => item.text), b.sections[0].items.map(item => item.text), "version B has a different order");
    assert.deepEqual([...a.sections[0].items.map(item => item.text)].sort(), [...b.sections[0].items.map(item => item.text)].sort(), "same questions");
    for (const paper of [a, b]) for (const item of paper.sections[0].items) {
        assert.equal(item.options.find(option => option.key === item.answer).text, "Two", "the key points at the right option after shuffling");
        assert.equal(item.options.at(-1).text, "All of the above", "'All of the above' always stays last");
    }
    void stem;
    assert.equal(a.sections[1].items.length, 5);
});

test("formulas print as readable text", () => {
    assert.equal(plainMath("Find $x^{2}$ if $\\frac{a}{b}=2$"), "Find x^(2) if (a)/(b)=2");
    assert.equal(plainMath("$\\theta \\times 5 \\leq \\pi$"), "θ × 5 ≤ π");
});
