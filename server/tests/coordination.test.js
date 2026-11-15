const test = require("node:test");
const assert = require("node:assert");
const { renderCoordinationPdf, measureFit } = require("../src/services/coordPdf");
const { renderCoordinationDocx } = require("../src/services/coordDocx");
const { readCoordinationDocx } = require("../src/services/coordImport");
const { fromHtml, plainText } = require("../src/services/coordRichText");
const { capsFor, roleIn } = require("../src/services/coordAccess");
const { keys } = require("../src/services/coordTemplate");

const base = { status: "draft", title: "WEEKLY SUBJECT COORDINATION MEETING 2026-2027 RECORD (CLASS PRE – X)", footerText: "Guide", caption: "Fig: Weekly Subject Coordination Meeting Record", pageNumber: 1, pageCount: 1, assets: {} };
const pages = (pdf) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;

test("a full week fits on one page, and very long text shrinks instead of spilling over", async () => {
    const long = fromHtml(`<ul>${"<li>Brainstorming with a long description of the activity that teachers write</li>".repeat(14)}</ul>`);
    const cells = Object.fromEntries(keys.map((k) => [k, k.includes(".") ? long : fromHtml("Short text")]));
    const fit = measureFit({ ...base, cells });
    assert.ok(fit.size < 9);
    const { buffer, sizes } = await renderCoordinationPdf([{ ...base, cells }, { ...base, cells: {} }]);
    assert.equal(pages(buffer), 2, "two weeks, two pages");
    assert.equal(sizes[1].size, 9.5, "an empty week uses the largest text size");
});

test("Word export can be read back by the importer", async () => {
    const cells = { "mon.subTopics": fromHtml("<b>Big Data</b>"), "mon.methods": fromHtml("<ul><li>Brainstorming</li><li>Pair work</li></ul>"), "tue.work": fromHtml("<b>C.W:</b> Make a table"), topic: fromHtml("Chapter 4"), teacher: fromHtml("Ms. Tahniyat"), attendee2: fromHtml("Mr. Haris"), week: fromHtml("16"), submitDate: fromHtml("23-August-26") };
    const { sizes } = await renderCoordinationPdf([{ ...base, cells }]);
    const docx = await renderCoordinationDocx([{ ...base, cells }], { sizes });
    const [week] = await readCoordinationDocx(docx);
    assert.equal(week.week, 16);
    assert.equal(plainText(week.cells["mon.subTopics"]), "Big Data");
    assert.equal(week.cells["mon.subTopics"][0].runs[0].b, true);
    assert.equal(week.cells["mon.methods"][0].list, "ul");
    assert.equal(plainText(week.cells["mon.methods"]), "Brainstorming\nPair work");
    assert.equal(plainText(week.cells.topic), "Chapter 4");
    assert.equal(plainText(week.cells.teacher), "Ms. Tahniyat");
    assert.equal(plainText(week.cells.attendee2), "Mr. Haris");
    assert.equal(plainText(week.cells.submitDate), "23-August-26");
});

test("roles decide who can edit and who can sign", () => {
    const admin = (id, extra = {}) => ({ _id: id, role: "admin", permissions: ["coordination"], ...extra });
    const file = { members: [{ admin: "a", role: "viewer" }, { admin: "b", role: "editor" }, { admin: "c", role: "coordinator" }, { admin: "d", role: "sectionHead" }] };
    const caps = (id, extra) => capsFor(roleIn(file, admin(id, extra)), admin(id, extra));
    assert.deepEqual([caps("a").edit, caps("a").comment], [false, true]);
    assert.deepEqual([caps("b").edit, caps("b").signCoordinator], [true, false]);
    assert.deepEqual([caps("c").signCoordinator, caps("c").signSectionHead], [true, false]);
    assert.deepEqual([caps("d").signSectionHead, caps("d").reopen], [true, true]);
    assert.equal(roleIn(file, admin("x")), null, "not a member: no access");
    assert.equal(roleIn(file, admin("x", { permissions: ["coordinationManage"] })), "manager");
    assert.equal(caps("x", { role: "super_admin" }).signCoordinator, false, "managers cannot sign for others");
});
