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

test("a row of one to four pictures is cleaned, drawn in the PDF and placed in the Word file", async () => {
    const { PNG } = require("pngjs");
    const { cleanBlocks } = require("../src/services/pbaContent");
    const url = n => `/api/media/images/${String(n).repeat(24)}`;
    const png = (() => { const p = new PNG({ width: 40, height: 30 }); p.data.fill(180); return PNG.sync.write(p); })();
    const blocks = cleanBlocks([{ type: "gallery", size: "large", images: [1, 2, 3, 4, 5].map(n => ({ url: url(n), caption: `Pic ${n}` })) }]);
    assert.equal(blocks[0].images.length, 4);
    assert.equal(cleanBlocks([{ type: "gallery", images: [{ url: "" }] }]).length, 0);
    assert.throws(() => cleanBlocks([{ type: "gallery", images: [{ url: "https://evil.example/a.png" }] }]));
    const withRow = { ...practical, blocks: [...blocks], parts: [] };
    const doc = pbaPaper.buildPbaPaper(config, { S1: [{ id: practical._id }] }, new Map([[practical._id, withRow]]), "A");
    const images = new Map([1, 2, 3, 4].map(n => [url(n), png]));
    assert.equal((await renderPbaPdf(doc, { images })).buffer.subarray(0, 4).toString(), "%PDF");
    const zip = await JSZip.loadAsync(await renderPbaDocx(doc, { images }));
    assert.equal((await zip.file("word/document.xml").async("string")).split("<w:drawing>").length - 1, 4);
});

test("the credit line can be switched off in every format", async () => {
    const off = pbaPaper.buildPbaPaper({ ...config, layout: { ...config.layout, credit: false } }, { S1: [{ id: practical._id }] }, new Map([[practical._id, practical]]), "A");
    assert.equal(pbaPaper.normalizePbaConfig({ ...config, layout: { credit: false } }).layout.credit, false);
    assert.equal(config.layout.credit, true);
    const xml = async doc => { const zip = await JSZip.loadAsync(await renderPbaDocx(doc, {})); return Object.values(zip.files).filter(f => /word\/footer/.test(f.name)); };
    const footers = async doc => (await Promise.all((await xml(doc)).map(f => f.async("string")))).join("");
    assert.ok((await footers(paper)).includes("IlmiDunya"));
    assert.ok(!(await footers(off)).includes("IlmiDunya"));
    assert.ok((await renderPbaPdf(off, {})).buffer.length > 1000);
});
