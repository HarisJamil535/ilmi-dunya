const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const pbaPaper = require("../src/services/pbaPaper");

const oid = () => String(new mongoose.Types.ObjectId());
const ids = { board: oid(), class: oid(), subject: oid(), js: oid(), html: oid(), css: oid(), fix: oid(), draw: oid() };
const practical = (topic, category, title, marks = [3, 3]) => ({ _id: oid(), topic, category, title, marks: marks.reduce((a, b) => a + b, 0), blocks: [{ type: "text", text: title }], parts: marks.map(m => ({ marks: m, blocks: [{ type: "text", text: `part of ${title}` }], space: { mode: "lines", size: 4 }, answer: [] })) });
const bank = [
    ...Array.from({ length: 3 }, (_, i) => practical(ids.js, ids.fix, `JS ${i}`)), ...Array.from({ length: 3 }, (_, i) => practical(ids.html, ids.draw, `HTML ${i}`, [1, 2, 3])),
    ...Array.from({ length: 2 }, (_, i) => practical(ids.css, ids.draw, `CSS ${i}`, [1, 1, 1, 1, 2])), { _id: oid(), topic: ids.js, category: ids.fix, title: "No content yet", parts: [], blocks: [] },
];
const config = (extra = {}) => pbaPaper.normalizePbaConfig({
    header: { schoolName: "APS", paperTitle: "PBA COMPUTER SSC-II", timeAllowed: "2 hours" },
    scope: { board: ids.board, class: ids.class, subject: ids.subject },
    sections: [{ name: "SECTION-A", slots: [{ topics: [ids.js] }, { topics: [ids.html] }, { topics: [ids.css] }] }, { name: "SECTION-B", slots: [{ categories: [ids.draw] }] }],
    ...extra,
});

test("a PBA pattern is validated and given sensible defaults", () => {
    const c = config();
    assert.deepEqual([c.kind, c.versions, c.layout.rollNumber, c.layout.rollDigits, c.layout.spaceMode, c.header.candidateFields.length], ["pba", ["A"], true, 7, "practical", 5]);
    assert.equal(c.sections[0].id, "S1");
    for (const bad of [{ sections: [] }, { sections: [{ name: "A", slots: [] }] }, { scope: { subject: "x" } }, { sections: Array.from({ length: 7 }, () => ({ slots: [{}] })) }]) assert.throws(() => config(bad), { status: 400 }, JSON.stringify(bad));
    assert.equal(config({ layout: { rollNumber: false, rollDigits: 99, spaceMode: "none" } }).layout.rollDigits, 10);
});

test("each question slot takes a matching practical with a written question, without repeats", () => {
    const c = config();
    const { selection, warnings } = pbaPaper.generatePbaSelection(c, bank, { seed: "x" });
    assert.deepEqual(warnings, []);
    const picked = Object.values(selection).flat().map(entry => entry.id);
    assert.equal(new Set(picked).size, 4);
    const byId = new Map(bank.map(p => [String(p._id), p]));
    assert.equal(byId.get(selection.S1[0].id).topic, ids.js);
    assert.equal(byId.get(selection.S1[1].id).topic, ids.html);
    assert.equal(byId.get(selection.S2[0].id).category, ids.draw);
    assert.ok(!picked.includes(String(bank.at(-1)._id)), "a practical without a question is never picked");
    const empty = pbaPaper.generatePbaSelection(config({ sections: [{ name: "A", slots: [{ topics: [oid()] }] }] }), bank, { seed: "x" });
    assert.equal(empty.selection.S1[0], null);
    assert.match(empty.warnings[0].message, /no practical/);
});

test("kept questions stay, and the paper shows numbered questions, parts and marks", () => {
    const c = config();
    const keep = { S1: [{ id: String(bank[1]._id) }, null, null] };
    const { selection } = pbaPaper.generatePbaSelection(c, bank, { seed: "y", keep });
    assert.equal(selection.S1[0].id, String(bank[1]._id));
    const byId = new Map(bank.map(p => [String(p._id), p]));
    selection.S1[1] = { ...selection.S1[1], partMarks: [2, 2, 2] };
    const paper = pbaPaper.buildPbaPaper(c, selection, byId);
    assert.deepEqual(paper.sections[0].questions.map(q => q.label), ["Q-1", "Q-2", "Q-3"]);
    assert.deepEqual(paper.sections[0].questions[1].parts.map(p => [p.label, p.marks]), [["a", 2], ["b", 2], ["c", 2]], "marks can be changed for this paper only");
    assert.equal(paper.sections[0].questions[0].marks, 6);
    assert.equal(paper.sections[0].questions[1].marks, 6);
    assert.equal(paper.sections[0].title, "SECTION-A [3×6=18 marks]", "equal questions print as 3×6=18");
    assert.match(paper.sections[1].title, /^SECTION-B \[\d+ marks\]$/);
    assert.equal(paper.totalMarks, paper.sections.reduce((s, x) => s + x.marks, 0));
    assert.equal(paper.sections[1].questions[0].label, "Q-4", "numbering continues across sections");
});

test("other versions pick different practicals where they can, and keep written ones", () => {
    const c = config({ versions: ["A", "B"] });
    const { selection } = pbaPaper.generatePbaSelection(c, bank, { seed: "v" });
    selection.S2[0] = { id: "c_mine1234" };
    const b = pbaPaper.selectionForVersion(c, selection, bank, "B", "v");
    const a = Object.values(selection).flat().map(entry => entry?.id);
    assert.equal(b.S2[0].id, "c_mine1234", "a question the teacher wrote is the same in every version");
    assert.notEqual(b.S1[0].id, selection.S1[0].id);
    assert.ok(b.S1[0].id && a.length === 4);
    assert.equal(pbaPaper.selectionForVersion(c, selection, bank, "A", "v"), selection);
});
