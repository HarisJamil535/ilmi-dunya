const { test } = require("node:test");
const assert = require("node:assert/strict");
const JSZip = require("jszip");
const mongoose = require("mongoose");
const pbaPaper = require("../src/services/pbaPaper");
const { renderPbaPdf, measurePba } = require("../src/services/pbaPaperPdf");
const { renderPbaDocx } = require("../src/services/pbaPaperDocx");

const oid = () => String(new mongoose.Types.ObjectId());
const code = "let marks = [45, 90];\nfor (let i = 0; i < 2; i++)\n{\n    console.log(marks[i]);\n}";
const practical = { _id: oid(), title: "Debug", marks: 6, blocks: [{ type: "text", text: "**Debug** this code with a very long paper title to wrap" }, { type: "code", language: "javascript", code }], parts: [{ marks: 3, blocks: [{ type: "text", text: "Rewrite the code." }], space: { mode: "lines", size: 4 }, answer: [{ type: "code", language: "javascript", code: "ok();" }] }, { marks: 3, blocks: [{ type: "text", text: "Explain:\n- one\n- two" }], space: { mode: "box", size: 5 }, answer: [] }] };
const config = pbaPaper.normalizePbaConfig({ header: { schoolName: "A Very Long School Name Public Schools", examName: "FIRST TERM EXAMINATIONS", paperTitle: "PBA COMPUTER SSC-II", timeAllowed: "2 hours" }, scope: { board: oid(), class: oid(), subject: oid() }, sections: [{ name: "SECTION-A", slots: [{}] }] });
const paper = pbaPaper.buildPbaPaper(config, { S1: [{ id: practical._id }] }, new Map([[practical._id, practical]]), "A");

test("the PDF renders for the paper, the answer key and the E-sheet", async () => {
    for (const mode of ["paper", "key", "esheet"]) {
        const { buffer, info } = await renderPbaPdf(paper, { mode });
        assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
        assert.ok(info.pages >= 1);
    }
    assert.equal((await measurePba(paper, {})).fits, true);
});

test("a page limit that is too small is reported, not hidden", async () => {
    const tight = { ...paper, layout: { ...paper.layout, pages: 1 } };
    const long = { ...tight, sections: [{ ...tight.sections[0], questions: Array.from({ length: 6 }, (_, i) => ({ ...tight.sections[0].questions[0], id: `q${i}`, number: i + 1, label: `Q-${i + 1}` })) }] };
    const info = await measurePba(long, {});
    assert.equal(info.fits, false);
    assert.equal(info.wanted, 1);
});

test("the Word file keeps code spacing and shows the answer only in the key", async () => {
    const word = async mode => (await JSZip.loadAsync(await renderPbaDocx(paper, { mode }))).file("word/document.xml").async("string");
    const normal = await word("paper"); const key = await word("key");
    assert.ok(normal.includes("console.log(marks[i]);") && normal.includes("Roll Number"));
    assert.ok(!normal.includes("ok();"));
    assert.ok(key.includes("ok();") && key.includes("ANSWER KEY"));
});
