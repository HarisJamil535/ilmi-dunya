const { test } = require("node:test");
const assert = require("node:assert/strict");
const content = require("../src/services/pbaContent");
const pba = require("../src/services/pba");

const img = "/api/media/images/0123456789abcdef01234567";

test("text, code, image, table and labelling blocks are cleaned and limited", () => {
    const blocks = content.cleanBlocks([
        { type: "text", text: "  Debug the **code**  " }, { type: "text", text: "   " },
        { type: "code", language: "javascript", code: "let a = 1;\n  if (a) {\n  }\n\n" }, { type: "code", language: "cobol", code: "x" },
        { type: "image", url: img, caption: " A router ", size: "huge" },
        { type: "table", rows: [["Item", "Cost"], ["Fruits"]] },
        { type: "labelling", items: [{ image: img, name: "Router", purpose: "Connects networks" }] },
    ]);
    assert.deepEqual(blocks.map(b => b.type), ["text", "code", "code", "image", "table", "labelling"]);
    assert.equal(blocks[0].text, "Debug the **code**");
    assert.equal(blocks[1].code, "let a = 1;\n  if (a) {\n  }", "indentation inside code is kept");
    assert.equal(blocks[2].language, "text", "unknown languages become plain text");
    assert.deepEqual([blocks[3].caption, blocks[3].size], ["A router", "medium"]);
    assert.deepEqual(blocks[4].rows, [["Item", "Cost"], ["Fruits", ""]], "rows are padded to the same width");
    assert.deepEqual(blocks[5].columns, ["Item", "Name", "Purpose"]);
    for (const bad of [[{ type: "video" }], [{ type: "image", url: "https://evil.example/x.png" }], "not a list", [{ type: "text", text: 5 }]]) assert.throws(() => content.cleanBlocks(bad), { status: 400 }, JSON.stringify(bad));
    assert.throws(() => content.cleanBlocks(Array.from({ length: content.LIMITS.blocks + 1 }, () => ({ type: "text", text: "x" }))), { status: 400 });
});

test("parts carry marks, an answer space and a model answer; the total is their sum", () => {
    const parts = content.cleanParts([{ marks: 3, blocks: [{ type: "text", text: "a" }], space: { mode: "lines", size: 6 }, answer: [{ type: "code", code: "x" }] }, { marks: 1.5 }, { marks: 2, space: { mode: "weird", size: 999 } }]);
    assert.deepEqual(parts.map(p => p.marks), [3, 1.5, 2]);
    assert.deepEqual([parts[0].space, parts[2].space], [{ mode: "lines", size: 6 }, { mode: "none", size: 30 }]);
    assert.equal(content.totalOf(parts, 99), 6.5, "the parts decide the total");
    assert.equal(content.totalOf([], 4), 4, "a question without parts keeps the typed total");
    for (const bad of [[{ marks: -1 }], [{ marks: 1.3 }], [{ marks: "x" }], Array.from({ length: 13 }, () => ({ marks: 1 }))]) assert.throws(() => content.cleanParts(bad), { status: 400 });
});

test("the markup becomes styled runs, bullets and numbered lines", () => {
    const [first, bullets, numbers, last] = content.paragraphs("Hello **bold** __under__ *it*\n- one\n- two\n1. first\n2) second\nRs ______ total");
    assert.deepEqual(first.runs.map(r => [r.text, !!r.bold, !!r.underline, !!r.italic]), [["Hello ", false, false, false], ["bold", true, false, false], [" ", false, false, false], ["under", false, true, false], [" ", false, false, false], ["it", false, false, true]]);
    assert.deepEqual([bullets.type, bullets.items.length, numbers.type, numbers.items.map(i => i.number)], ["ul", 2, "ol", [1, 2]]);
    assert.equal(last.runs[0].text, "Rs ______ total", "blank lines written with underscores stay as they are");
    assert.equal(content.plain("**a** b\n- c\n- d"), "a b c; d");
});

test("a practical keeps its question, parts and total marks", () => {
    const refs = { topics: new Set(), categories: new Set() };
    const practical = pba.cleanPractical({ title: "Debug the code", blocks: [{ type: "code", language: "javascript", code: "let x;" }], parts: [{ marks: 3 }, { marks: 3, answer: [{ type: "text", text: "Fix the loop" }] }], answerVisible: true }, refs);
    assert.deepEqual([practical.marks, practical.parts.length, practical.answerVisible, practical.blocks[0].type], [6, 2, true, "code"]);
    assert.equal(pba.cleanPractical({ title: "Plain", marks: 4 }, refs).marks, 4);
    assert.deepEqual(pba.cleanPractical({ title: "Old style practical" }, refs).blocks, []);
});
