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
    const record = { ...base, cells, attendees: ["Section Head", "Mr. Haris", "Ms. Ammara"], font: "garamond" };
    const { sizes } = await renderCoordinationPdf([record]);
    const docx = await renderCoordinationDocx([record], { sizes });
    const [week] = await readCoordinationDocx(docx);
    assert.equal(week.week, 16);
    assert.equal(plainText(week.cells["mon.subTopics"]), "Big Data");
    assert.equal(week.cells["mon.subTopics"][0].runs[0].b, true);
    assert.equal(week.cells["mon.methods"][0].list, "ul");
    assert.equal(plainText(week.cells["mon.methods"]), "Brainstorming\nPair work");
    assert.equal(plainText(week.cells.topic), "Chapter 4");
    assert.equal(plainText(week.cells.teacher), "Ms. Tahniyat");
    assert.equal(plainText(week.cells.attendee2), "Mr. Haris");
    assert.equal(plainText(week.cells.attendee3), "Ms. Ammara");
    assert.equal(plainText(week.cells.submitDate), "23-August-26");
});

test("departments decide who can see, edit and sign", () => {
    const cs = "dept-cs", chem = "dept-chem";
    const person = (coordTitle, coordDepartment = null, extra = {}) => ({ _id: Math.random().toString(36), role: "admin", permissions: ["coordination"], coordTitle, coordDepartment, ...extra });
    const csFile = { department: cs };
    const caps = (p) => capsFor(roleIn(csFile, p), p);
    const teacher = person("teacher", cs), coordinator = person("coordinator", cs), chemTeacher = person("teacher", chem), sh = person("sectionHead"), principal = person("principal");
    assert.deepEqual([caps(teacher).view, caps(teacher).edit, caps(teacher).signCoordinator], [true, true, false]);
    assert.deepEqual([caps(coordinator).signCoordinator, caps(coordinator).signSectionHead], [true, false]);
    assert.equal(roleIn(csFile, chemTeacher), null, "another department sees nothing");
    assert.equal(roleIn(csFile, person("coordinator", chem)), null, "another department's coordinator sees nothing");
    assert.deepEqual([caps(sh).edit, caps(sh).signSectionHead, caps(sh).signCoordinator], [true, true, false]);
    assert.deepEqual([caps(principal).view, caps(principal).download, caps(principal).comment, caps(principal).edit, caps(principal).signSectionHead], [true, true, true, false, false]);
    assert.deepEqual([caps(coordinator).deleteWeek, caps(sh).deleteWeek, caps(principal).deleteWeek, caps(teacher).deleteWeek], [true, true, true, false]);
    assert.equal(roleIn(csFile, person("")), null, "no title, no access");
    const superAdmin = person("", null, { role: "super_admin" });
    assert.deepEqual([roleIn(csFile, superAdmin), caps(superAdmin).signCoordinator], ["manager", false]);
});
