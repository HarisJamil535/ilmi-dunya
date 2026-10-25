const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const School = require("../src/models/School");
const Student = require("../src/models/Student");
const Subject = require("../src/models/Subject");
const Assessment = require("../src/models/Assessment");
const IssuedReport = require("../src/models/IssuedReport");
const { loadScope } = require("../src/services/schoolResults");
const { gradeFor } = require("../src/services/schoolReportData");
const { renderSchoolPdf, ordinal } = require("../src/services/schoolReportPdf");
const { verifyReport } = require("../src/controllers/schoolResultsController");

const id = () => new mongoose.Types.ObjectId();
const query = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, distinct: async () => value, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const response = () => ({ headers: {}, set(name, value) { if (typeof name === "object") Object.assign(this.headers, name); else this.headers[name] = value; return this; }, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } });
afterEach(() => mock.restoreAll());

test("grades follow the board scale and positions read naturally", () => {
    assert.deepEqual([95, 80, 79.9, 70, 60, 50, 40, 33, 32.9, 0].map(value => gradeFor(value).grade), ["A+", "A+", "A", "A", "B", "C", "D", "E", "F", "F"]);
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"]);
});

test("choosing a subject narrows the report to that subject's tests", async () => {
    const school = new School({ name: "APS", classes: [{ name: "Class 9", sections: [] }] });
    const subjectId = id();
    const tests = [id(), id()];
    mock.method(School, "findById", () => query(school.toObject()));
    mock.method(Student, "find", () => query([{ _id: id() }]));
    mock.method(Subject, "findById", () => query({ _id: subjectId, name: "Physics", class: { name: "9th" } }));
    mock.method(Assessment, "find", filter => { assert.deepEqual(filter, { subject: subjectId }); return query(tests); });
    const scope = await loadScope(String(school._id), { subjectId: String(subjectId) });
    assert.deepEqual(scope.subject, { _id: subjectId, name: "Physics", className: "9th" });
    assert.deepEqual(scope.attemptFilter.assessment, { $in: tests });
    await assert.rejects(loadScope(String(school._id), { subjectId: "nope" }), { status: 400 });
});

const attempt = (studentId, n, percentage, extra = {}) => ({
    studentId, testId: `t${n}`, title: `Topic test ${n}`, type: "Topic test", subject: "Physics", subjectId: "s1", chapter: "Ch 1: Measurements", chapterId: "c1", topic: `1.${n} Topic ${n}`, topicId: `p${n}`,
    attemptNo: 1, startedAt: new Date(Date.UTC(2026, 9, n, 5)), submittedAt: new Date(Date.UTC(2026, 9, n, 5, 10)), timeTakenSeconds: 600, score: percentage / 10, totalMarks: 10, percentage,
    grade: gradeFor(percentage).grade, passStatus: percentage >= 40 ? "pass" : "fail", submission: "Submitted", practiceSet: false, questions: 10, correct: percentage / 10, skipped: 0, wrong: 10 - percentage / 10, ...extra,
});
const stats = list => ({ attempts: list.length, passed: list.filter(a => a.passStatus === "pass").length, failed: list.filter(a => a.passStatus === "fail").length, average: list.reduce((s, a) => s + a.percentage, 0) / list.length, best: Math.max(...list.map(a => a.percentage)), lowest: Math.min(...list.map(a => a.percentage)), passRate: 50, seconds: 600 * list.length, questions: 10 * list.length, correct: 5, wrong: 5, skipped: 0, accuracy: 50, students: 1, tests: list.length });

function fixture() {
    const ayesha = Array.from({ length: 30 }, (_, i) => attempt("a", i + 1, 50 + (i % 6) * 10)); // long enough to need a second page
    const bilal = [attempt("b", 1, 30)];
    const student = (key, name, list, position) => ({ _id: key, name, className: "Class 9", sectionName: "A", city: "Lahore", memberSince: new Date(), summary: list ? stats(list) : null, grade: list ? gradeFor(stats(list).average).grade : "", subjects: list ? [{ subject: "Physics", ...stats(list) }] : [], attempts: list || [], first: list?.[0].startedAt, last: null, position });
    const students = [student("a", "Ayesha Khan", ayesha, 1), student("b", "Bilal Ahmed", bilal, 2), student("c", "Iqra Ali", null)];
    const all = [...ayesha, ...bilal];
    return {
        subject: null, overall: { ...stats(all), studentsInScope: 3, studentsAttempted: 2 },
        distribution: [["A+", 80], ["A", 70], ["B", 60], ["C", 50], ["D", 40], ["E", 33], ["F", 0]].map(([grade, min]) => ({ grade, min, label: grade, students: grade === "B" ? 1 : grade === "F" ? 1 : 0 })),
        subjects: [{ name: "Physics", ...stats(all) }], chapters: [{ name: "Ch 1: Measurements", subject: "Physics", ...stats(all) }],
        topics: [1, 2, 3, 4, 5].map(n => ({ name: `1.${n} Topic ${n}`, subject: "Physics", chapter: "Ch 1", ...stats(all.filter(a => a.topicId === `p${n}`)) })),
        students, merit: ["a", "b"], notAttempted: [{ name: "Iqra Ali", className: "Class 9", sectionName: "A" }],
    };
}
const meta = kind => ({ kind, reference: "IDR-261025-K7Q2MX", issuedAt: new Date(), verifyBase: "https://www.ilmidunya.org", cardReferences: { a: "IDR-261025-K7Q2MX-001", b: "IDR-261025-K7Q2MX-002" }, schoolName: "APS Boys and Girls DHA", className: "Class 9", sectionName: "", period: "All dates", documentTitle: "Report", runningTitle: "Result report" });
const pages = buffer => (buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length;

test("the result report and report cards render as PDFs", async () => {
    const report = await renderSchoolPdf(meta("report"), fixture());
    assert.equal(report.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pages(report) >= 2);
    const cards = await renderSchoolPdf(meta("cards"), fixture());
    assert.equal(cards.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pages(cards) >= 3, "one card spans two pages, the other fits on one, and students without tests get none");
    const empty = await renderSchoolPdf(meta("cards"), { ...fixture(), students: [], merit: [] });
    assert.equal(pages(empty), 1, "an empty selection still produces a one-page document saying so");
});

test("anyone can verify a report or a single card by its reference, and unknown references are not found", async () => {
    const record = { reference: "IDR-261025-K7Q2MX", kind: "cards", schoolName: "APS", className: "Class 9", sectionName: "", period: "All dates", students: 40, studentsAttempted: 33, attempts: 160, average: 67, passRate: 85, issuedAt: new Date(), cards: [{ reference: "IDR-261025-K7Q2MX-004", name: "Amna Butt", className: "Class 9", sectionName: "Section A", tests: 7, attempts: 8, average: 94, grade: "A+", position: 4 }] };
    let asked;
    mock.method(IssuedReport, "findOne", filter => { asked = filter; return query(filter.reference === record.reference ? record : null); });
    let res = response();
    await verifyReport({ params: { reference: "idr-261025-k7q2mx-004" } }, res, assert.fail);
    assert.equal(asked.reference, "IDR-261025-K7Q2MX");
    assert.deepEqual([res.body.document.kind, res.body.document.student, res.body.document.position, res.body.document.outOf], ["card", "Amna Butt", 4, 33]);
    assert.equal(res.body.document.email, undefined, "no contact details are shown publicly");
    res = response();
    await verifyReport({ params: { reference: "IDR-261025-K7Q2MX" } }, res, assert.fail);
    assert.deepEqual([res.body.document.kind, res.body.document.cards, res.body.document.average], ["cards", 1, 67]);
    for (const reference of ["IDR-261025-K7Q2MX-999", "IDR-261025-ZZZZZZ", "anything", "IDR-261025-K7Q2MX-004x"]) {
        res = response();
        await verifyReport({ params: { reference } }, res, assert.fail);
        assert.equal(res.code, 404, reference);
    }
});
