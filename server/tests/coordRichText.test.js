const test = require("node:test");
const assert = require("node:assert");
const { fromHtml, toHtml, plainText } = require("../src/services/coordRichText");

test("keeps formatting, lists and alignment", () => {
    const p = fromHtml('<div><b>C.W:</b> Classify <i>data</i></div><ul><li>Brain storming</li><li><u>Pair</u> work</li></ul><div style="text-align:center"><span style="color:rgb(220, 38, 38)">Red</span></div>');
    assert.deepEqual(p[0], { list: "", align: "left", runs: [{ t: "C.W:", b: true }, { t: " Classify " }, { t: "data", i: true }] });
    assert.equal(p[1].list, "ul"); assert.equal(p[2].runs[0].u, true);
    assert.equal(p[3].align, "center"); assert.equal(p[3].runs[0].c, "#dc2626");
    assert.deepEqual(fromHtml(toHtml(p)), p);
});

test("drops scripts, attributes and unknown markup", () => {
    const p = fromHtml('<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:x" onclick="y">link</a><style>p{}</style>ok');
    assert.equal(plainText(p), "linkok");
    assert.ok(!/script|onerror|javascript/.test(toHtml(p)));
});

test("line breaks and entities", () => {
    assert.equal(plainText(fromHtml("one<br>two &amp; three&nbsp;")), "one\ntwo & three");
});
