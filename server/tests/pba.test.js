const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const pba = require("../src/services/pba");

const oid = () => String(new mongoose.Types.ObjectId());

test("lecture links must be YouTube and notes links must be web links", () => {
    assert.equal(pba.videoLink("https://youtu.be/abc123XYZ"), "https://youtu.be/abc123XYZ");
    assert.equal(pba.videoLink("  https://www.youtube.com/watch?v=abc  "), "https://www.youtube.com/watch?v=abc");
    assert.equal(pba.videoLink(""), "");
    for (const bad of ["https://vimeo.com/1", "javascript:alert(1)", "youtube.com/watch?v=1", "https://user:pw@youtube.com/x", "https://evil.com/youtube.com"]) {
        assert.throws(() => pba.videoLink(bad), { status: 400 }, bad);
    }
    assert.equal(pba.notesLink("https://drive.google.com/file/d/1/view"), "https://drive.google.com/file/d/1/view");
    for (const bad of ["javascript:alert(1)", "ftp://x.com/a.pdf", "data:text/html,hi", "not a link"]) assert.throws(() => pba.notesLink(bad), { status: 400 }, bad);
});

test("a topic needs a name; its subtopics are cleaned and limited", () => {
    assert.throws(() => pba.cleanTopic({ title: "   " }), { status: 400 });
    const topic = pba.cleanTopic({ title: " HTML ", subtopics: [{ title: "Tags", videoUrl: "https://youtu.be/abc123", notesUrl: "" }, { title: "Tables" }] });
    assert.equal(topic.title, "HTML");
    assert.deepEqual(topic.subtopics.map(s => [s.title, s.videoUrl, s.notesUrl]), [["Tags", "https://youtu.be/abc123", ""], ["Tables", "", ""]]);
    assert.throws(() => pba.cleanTopic({ title: "x", subtopics: [{ title: "" }] }), { status: 400 });
    assert.throws(() => pba.cleanTopic({ title: "x", subtopics: Array.from({ length: pba.LIMITS.subtopics + 1 }, (_, i) => ({ title: `s${i}` })) }), { status: 400 });
    assert.equal(pba.cleanTopic({ title: "x" }).subtopics, undefined, "a topic edit without subtopics leaves them alone");
});

test("a practical can only point at this subject's topic and category", () => {
    const topic = oid(), category = oid();
    const refs = { topics: new Set([topic]), categories: new Set([category]) };
    const ok = pba.cleanPractical({ title: "Portfolio page", topic, category, label: "Section A" }, refs);
    assert.deepEqual([ok.topic, ok.category, ok.label], [topic, category, "Section A"]);
    assert.deepEqual([pba.cleanPractical({ title: "x" }, refs).topic, pba.cleanPractical({ title: "x", topic: "" }, refs).topic], [null, null]);
    assert.throws(() => pba.cleanPractical({ title: "x", topic: oid() }, refs), { status: 400 });
    assert.throws(() => pba.cleanPractical({ title: "x", category: "nope" }, refs), { status: 400 });
    assert.throws(() => pba.cleanPractical({ title: "" }, refs), { status: 400 });
});

test("the introduction keeps only complete facts and links", () => {
    const setting = pba.cleanSetting({ intro: "  Hello  ", facts: [{ label: "Marks", value: "30" }, { label: "", value: "x" }, { label: "Time" }], links: [{ title: "Framework", url: "https://fbise.edu.pk/x.pdf" }, { title: "", url: "https://a.com" }] });
    assert.equal(setting.intro, "Hello");
    assert.deepEqual(setting.facts, [{ label: "Marks", value: "30" }]);
    assert.deepEqual(setting.links, [{ title: "Framework", url: "https://fbise.edu.pk/x.pdf" }]);
    assert.throws(() => pba.cleanSetting({ links: [{ title: "Bad", url: "javascript:1" }] }), { status: 400 });
});
