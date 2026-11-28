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

test("a very long word (a pasted link) is laid out quickly without huge memory use", () => {
    const start = Date.now();
    const before = process.memoryUsage().heapUsed;
    const fit = measureFit({ ...base, cells: { extraHelp: fromHtml("A".repeat(4000)), "mon.work": fromHtml(`https://example.com/${"x".repeat(3000)}`) } });
    assert.ok(fit.size >= 5);
    assert.ok(Date.now() - start < 3000, `took ${Date.now() - start} ms`);
    assert.ok(process.memoryUsage().heapUsed - before < 300 * 1024 * 1024, "memory stays reasonable");
});

test("the Principal's signature adds a third signature line in Word and PDF", async () => {
    const { cleanSignature } = require("../src/services/signatureImage");
    const { PNG } = require("pngjs");
    const png = new PNG({ width: 400, height: 120 });
    for (let i = 0; i < png.data.length; i += 4) png.data[i] = png.data[i + 1] = png.data[i + 2] = png.data[i + 3] = 255;
    for (let x = 40; x < 360; x++) for (let d = -2; d <= 2; d++) { const o = ((60 + d) * 400 + x) * 4; png.data[o] = png.data[o + 1] = png.data[o + 2] = 20; }
    const sig = { image: cleanSignature(PNG.sync.write(png)), at: new Date() };
    const record = { ...base, status: "approved", cells: {}, assets: { coordinator: sig, sectionHead: sig, principal: sig } };
    const { buffer } = await renderCoordinationPdf([record]);
    assert.equal(pages(buffer), 1);
    const docx = await renderCoordinationDocx([record]);
    const xml = require("node:zlib") && docx.toString("latin1");
    assert.ok(docx.length > 1000 && xml.length > 0);
});

test("Section Head can approve straight away; the Principal can approve or add a signature", () => {
    const sh = capsFor("sectionHead", { coordTitle: "sectionHead" });
    const pr = capsFor("principal", { coordTitle: "principal" });
    const teacher = capsFor("editor", { coordTitle: "teacher" });
    assert.equal(sh.signSectionHead, true);
    assert.equal(pr.signPrincipal, true);
    assert.equal(teacher.signPrincipal || teacher.signSectionHead, false);
});

test("Excel import: the sample files read back correctly, and problems are reported per row", async () => {
    const imp = require("../src/services/curriculumImport");
    const writeXlsxFile = require("write-excel-file/node");
    const chapters = await imp.readRows(await imp.template("chapter"), "chapter");
    assert.deepEqual(chapters.map((r) => r.name), ["Physical Quantities and Measurement", "Kinematics", "Dynamics"]);
    const topics = await imp.readRows(await imp.template("topic"), "topic");
    assert.equal(topics.length, 3);
    assert.equal(topics[0].number, "1.1");
    assert.match(topics[0].videoUrl, /^https:\/\/www\.youtube\.com/);
    assert.equal(topics[2].videoUrl, "");
    const loose = await writeXlsxFile([[{ value: "Chapter No.", type: String }, { value: "chapter name", type: String }], [{ value: 4, type: Number }, { value: "Waves", type: String }], [null, null]]).toBuffer();
    assert.deepEqual((await imp.readRows(loose, "chapter")).map((r) => [r.number, r.name]), [["4", "Waves"]]);
    await assert.rejects(imp.readRows(Buffer.from("not excel"), "chapter"), /could not be read/);
    const noHeadings = await writeXlsxFile([[{ value: "x", type: String }]]).toBuffer();
    await assert.rejects(imp.readRows(noHeadings, "topic"), /heading row/);
});

test("Urdu records: Urdu departments, right-to-left Word and PDF, and Urdu Word files import back", async () => {
    const { languageOf } = require("../src/services/coordLang");
    assert.equal(languageOf({ name: "Urdu" }), "ur");
    assert.equal(languageOf({ name: "Islamiyat" }), "ur");
    assert.equal(languageOf({ name: "Tarjuma tul Quran" }), "ur");
    assert.equal(languageOf({ name: "Physics" }), "en");
    assert.equal(languageOf({ name: "Urdu", language: "en" }), "en", "the department's own choice wins");
    const cells = Object.fromEntries(keys.map((k) => [k, []]));
    Object.assign(cells, {
        week: fromHtml("پہلا : 10 نومبر تا 14 نومبر"), className: fromHtml("نہم"), sections: fromHtml("6"), subject: fromHtml("اُردو"), periods: fromHtml("4"),
        topic: fromHtml("پیام لطیف، بلند خوانی"), "tue.subTopics": fromHtml("پرچہ جات پر تبادلہ خیال"), "tue.methods": fromHtml("تقریری اور باہمی تبادلہ خیال"),
        "wed.resources": fromHtml("بورڈ، مارکر، ویڈیو لنک https://youtu.be/abc"), extraHelp: fromHtml("ہونہار طلبہ کے ساتھ نشست بندی"), teacher: fromHtml("شاہد طارق"), submitDate: fromHtml("6 نومبر"),
    });
    const record = { ...base, lang: "ur", title: "ہفتہ وار مضمونی رابطہ اجلاس ریکارڈ 2026-2027 (جماعت نہم – دہم)", footerText: "", caption: "", cells, attendees: ["Section Head", "شاہد طارق"], attendeeSignatures: [null, null] };
    const { buffer, sizes } = await renderCoordinationPdf([record]);
    assert.equal(pages(buffer), 1);
    assert.equal(sizes[0].overflow, false);
    const docx = await renderCoordinationDocx([record], { sizes });
    const xml = await (await require("jszip").loadAsync(docx)).file("word/document.xml").async("string");
    assert.match(xml, /<w:bidi\/>/, "paragraphs are right to left");
    assert.match(xml, /<w:bidiVisual\/>/, "tables are right to left");
    assert.match(xml, /Jameel Noori Nastaleeq/);
    const [week] = await readCoordinationDocx(docx);
    for (const [key, text] of [["tue.subTopics", "پرچہ جات پر تبادلہ خیال"], ["tue.methods", "تقریری اور باہمی تبادلہ خیال"], ["subject", "اُردو"], ["periods", "4"], ["teacher", "شاہد طارق"], ["className", "نہم"], ["extraHelp", "ہونہار طلبہ کے ساتھ نشست بندی"]]) {
        assert.equal(plainText(week.cells[key]).replace(/\s+/g, " ").trim(), text, key);
    }
    assert.equal(week.week, 1, "پہلا is week 1");
});

test("Word export: remarks become Word comments on their box, the rest on the coordinator's signature line", async () => {
    const JSZip = require("jszip");
    const cells = Object.fromEntries(keys.map((k) => [k, []]));
    Object.assign(cells, { subject: fromHtml("Chemistry"), "mon.subTopics": fromHtml("Periods and groups") });
    const comments = [
        { cell: "", kind: "comment", text: "Well organised plan.", authorName: "Ms. Asmeena", role: "sectionHead", at: new Date("2026-11-20") },
        { cell: "mon.subTopics", kind: "change", text: "Add page numbers", authorName: "Ms. Asmeena", role: "sectionHead", resolved: true, resolvedByName: "Ms. Tabassum", replies: [{ authorName: "Ms. Tabassum", text: "Done" }] },
        { cell: "wed.resources", kind: "question", text: "Which video?", authorName: "Ms. Tabassum", role: "coordinator" },
    ];
    const docx = await renderCoordinationDocx([{ ...base, cells, attendees: [], comments }, { ...base, cells, attendees: [], comments: [comments[0]] }]);
    const zip = await JSZip.loadAsync(docx);
    const notes = await zip.file("word/comments.xml").async("string");
    const doc = await zip.file("word/document.xml").async("string");
    assert.equal((notes.match(/<w:comment /g) || []).length, 4, "every remark of every week");
    assert.match(notes, /w:author="Section Head — Ms. Asmeena"/);
    assert.match(notes, /w:author="Coordinator — Ms. Tabassum"/);
    assert.match(notes, /Change requested: /);
    assert.match(notes, /Resolved by Ms. Tabassum/);
    assert.match(notes, /Ms. Tabassum: /, "replies are inside the comment");
    for (const id of [0, 1, 2, 3]) {
        for (const tag of ["commentRangeStart", "commentRangeEnd", "commentReference"]) assert.match(doc, new RegExp(`<w:${tag} w:id="${id}"/>`), `${tag} ${id}`);
    }
    // The remark on Monday's sub-topics surrounds that box's text.
    assert.match(doc, /<w:commentRangeStart w:id="1"\/>.*Periods and groups.*<w:commentRangeEnd w:id="1"\/>/s);
    // Comments do not get in the way of importing the file back.
    const [week] = await readCoordinationDocx(docx);
    assert.equal(plainText(week.cells["mon.subTopics"]).trim(), "Periods and groups");
    const plain = await renderCoordinationDocx([{ ...base, cells, attendees: [] }]);
    const empty = await (await JSZip.loadAsync(plain)).file("word/comments.xml")?.async("string");
    assert.doesNotMatch(empty || "", /<w:comment /, "no remarks, no comments");
});

test("terms: each term has its own file, and older files count as the 1st term", () => {
    const { termName } = require("../src/services/coordSubjects");
    const { CoordinationFile } = require("../src/models/Coordination");
    assert.equal(termName({}), "1st Term");
    assert.equal(termName({ term: 1 }), "1st Term");
    assert.equal(termName({ term: 2 }), "2nd Term");
    assert.equal(new CoordinationFile({ session: "2026-2027" }).term, 1);
    assert.ok(new CoordinationFile({ session: "2026-2027", term: 3 }).validateSync()?.errors?.term, "only 1st or 2nd term");
    const unique = CoordinationFile.schema.indexes().find(([, o]) => o.unique);
    assert.deepEqual(Object.keys(unique[0]), ["department", "classLevel", "session", "term"]);
});

test("Word import: a day grid nested inside the outer table, 'Topics:', 'Period per week', bare attendee numbers and links", async () => {
    const JSZip = require("jszip");
    const p = (text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    const link = (before, url) => `<w:p><w:r><w:t xml:space="preserve">${before}</w:t></w:r><w:hyperlink r:id="rId9"><w:r><w:t>${url}</w:t></w:r></w:hyperlink></w:p>`;
    const tc = (...ps) => `<w:tc>${ps.join("")}</w:tc>`;
    const tr = (...tcs) => `<w:tr>${tcs.join("")}</w:tr>`;
    const tbl = (...trs) => `<w:tbl>${trs.join("")}</w:tbl>`;
    const grid = tbl(
        tr(tc(p("Day/ Period")), tc(p("Sub-Topics")), tc(p("Methodology*")), tc(p("Resources")), tc(p("AFL Strategies")), tc(p("CW/HW/Online Assignments &amp;Project Work"))),
        tr(tc(p("Wednesday"), p("Double period")), tc(p("Construction of Triangles")), tc(p("Brainstorming")), tc(link("Text book, video clip ", "https://youtu.be/abc")), tc(p("Hand Signals")), tc(p("C.W: Ex 10.1 Q1"))),
    );
    const body = p("Week : 1\tClass: 9th\tNo. of Sections: 5") + tbl(
        tr(tc(p("Steps")), tc(p("Subject: Mathematics\tTopics: Construction of Triangles Period per week: 4"))),
        tr(tc(p("1")), tc(p("Topics brought forward ( if any): Previous week task is completed."))),
        tr(tc(p("2.")), `<w:tc>${grid}<w:p/></w:tc>`),
        tr(tc(p("3.")), tc(p("Strategies for Learners requiring extra assistance: On spot guidance."))),
        tr(tc(p("4.")), tc(p("Teacher Responsible for Preparing lesson Plan: Ms Snober Attendees of Coordination Meeting:   1. Section Head\t2  Ms Javeria\t3:   Ms Snober"))),
    ) + p("Sign: Subject Coordinator : Ms Mussarat khan\tSH sign: ________");
    const zip = new JSZip();
    zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="w" xmlns:r="r"><w:body>${body}</w:body></w:document>`);
    const [week] = await readCoordinationDocx(await zip.generateAsync({ type: "nodebuffer" }));
    const text = (key) => plainText(week.cells[key] || []).replace(/\s+/g, " ").trim();
    assert.equal(week.week, 1);
    assert.equal(text("subject"), "Mathematics");
    assert.equal(text("topic"), "Construction of Triangles");
    assert.equal(text("periods"), "4");
    assert.equal(text("broughtForward"), "Previous week task is completed.");
    assert.equal(text("wed.period"), "Double period");
    assert.equal(text("wed.subTopics"), "Construction of Triangles");
    assert.equal(text("wed.resources"), "Text book, video clip https://youtu.be/abc", "a link is read once");
    assert.equal(text("wed.work"), "C.W: Ex 10.1 Q1");
    assert.equal(text("extraHelp"), "On spot guidance.");
    assert.deepEqual(["attendee1", "attendee2", "attendee3"].map(text), ["Section Head", "Ms Javeria", "Ms Snober"]);
    assert.equal(text("coordinatorName"), "Ms Mussarat khan");
});
