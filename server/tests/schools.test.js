const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const School = require("../src/models/School");
const Student = require("../src/models/Student");
const Admin = require("../src/models/Admin");
const Assessment = require("../src/models/Assessment");
const AssessmentAttempt = require("../src/models/AssessmentAttempt");
const { resolveSchoolChoice, schoolFields } = require("../src/services/schoolSelection");
const controller = require("../src/controllers/schoolController");
const { loadScope, previewReport, fullReport, MAX_EXPORT_ATTEMPTS } = require("../src/services/schoolResults");
const { buildWorkbook, workbookName } = require("../src/services/schoolResultsWorkbook");
const { createResultCard, summarize, latin, planPages } = require("../src/services/resultCardPdf");
const { formatDate, formatTime, formatDuration, dateRange, dayStart } = require("../src/services/pakistanTime");
const { downloadResultCard } = require("../src/controllers/studentDashboardController");

const id = () => new mongoose.Types.ObjectId();
const query = value => ({ select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, populate() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const response = () => ({ headers: {}, set(name, value) { if (typeof name === "object") Object.assign(this.headers, name); else this.headers[name] = value; return this; }, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } });
const makeSchool = (extra = {}) => new School({ name: "APS Boys and Girls DHA", classes: [{ name: "Class 9", sections: [{ name: "Section A" }, { name: "Section B" }] }, { name: "Class 10", sections: [] }], ...extra });
afterEach(() => mock.restoreAll());

test("school names ignore case and spacing when checking for duplicates", async () => {
    const school = new School({ name: "  APS   Boys  and Girls DHA " });
    await school.validate();
    assert.equal(school.name, "APS Boys and Girls DHA");
    assert.equal(school.nameKey, "aps boys and girls dha");
});

test("signup accepts private students and schools typed by the student, including older clients", async () => {
    assert.deepEqual(await resolveSchoolChoice({ schoolId: "private", school: "ignored", schoolClassId: "x" }), { school: "Private Student" });
    assert.deepEqual(await resolveSchoolChoice({ schoolId: "other", school: "  City   School  " }), { school: "City School" });
    assert.deepEqual(await resolveSchoolChoice({ school: "Private Candidate" }), { school: "Private Candidate" });
    for (const body of [{ schoolId: "other", school: "A" }, { schoolId: "other", school: "" }, { school: "x".repeat(161) }, {}]) {
        await assert.rejects(resolveSchoolChoice(body), { status: 400 });
    }
});

test("a listed school needs its own class and section from the admin's lists", async () => {
    const school = makeSchool();
    const grade = school.classes[0];
    mock.method(School, "findOne", filter => { assert.equal(filter.isActive, true); return query(String(filter._id) === String(school._id) ? school.toObject() : null); });
    const base = { schoolId: String(school._id) };
    await assert.rejects(resolveSchoolChoice(base), /Select your class/);
    await assert.rejects(resolveSchoolChoice({ ...base, schoolClassId: String(id()) }), /Select your class/);
    await assert.rejects(resolveSchoolChoice({ ...base, schoolClassId: String(grade._id) }), /Select your section/);
    // A section of another class is not valid for this class.
    await assert.rejects(resolveSchoolChoice({ ...base, schoolClassId: String(grade._id), schoolSectionId: String(id()) }), /Select your section/);
    const resolved = await resolveSchoolChoice({ ...base, schoolClassId: String(grade._id), schoolSectionId: String(grade.sections[1]._id) });
    assert.deepEqual({ ...resolved, schoolRef: String(resolved.schoolRef) }, { school: school.name, schoolRef: String(school._id), schoolClass: "Class 9", schoolSection: "Section B" });
    // A class without sections needs no section.
    const noSections = await resolveSchoolChoice({ ...base, schoolClassId: String(school.classes[1]._id) });
    assert.equal(noSections.schoolClass, "Class 10");
    assert.equal(noSections.schoolSection, undefined);
    await assert.rejects(resolveSchoolChoice({ schoolId: String(id()) }), /no longer available/);
    await assert.rejects(resolveSchoolChoice({ schoolId: "not-an-id" }), { status: 400 });
});

test("a school without classes needs no class", async () => {
    const school = new School({ name: "Small School" });
    mock.method(School, "findOne", () => query(school.toObject()));
    const resolved = await resolveSchoolChoice({ schoolId: String(school._id) });
    assert.equal(resolved.school, "Small School");
    assert.equal(resolved.schoolClass, undefined);
});

test("moving to an unmanaged school clears the stored school, class and section", () => {
    assert.deepEqual(schoolFields({ school: "Other School" }), { set: { school: "Other School" }, unset: { schoolRef: "", schoolClass: "", schoolSection: "" } });
    const ref = id();
    assert.deepEqual(schoolFields({ school: "S", schoolRef: ref, schoolClass: "Class 9" }), { set: { school: "S", schoolRef: ref, schoolClass: "Class 9" }, unset: { schoolSection: "" } });
});

test("registration stores the chosen school, class and section on the student", () => {
    const student = new Student({ name: "Ayesha Khan", email: "a@example.com", phone: "+923001234567", city: "Karachi", school: "APS Boys and Girls DHA", schoolRef: id(), schoolClass: "Class 9", schoolSection: "Section A" });
    assert.equal(student.validateSync(), undefined);
    assert.ok(Student.schema.indexes().some(([keys]) => keys.schoolRef === 1 && keys.schoolClass === 1 && keys.schoolSection === 1));
});

test("admins add classes and sections in bulk and duplicates are rejected", async () => {
    const school = makeSchool();
    mock.method(School, "findById", async () => school);
    mock.method(school, "save", async () => school);
    const call = async (handler, req) => { const res = response(); let error; await handler({ params: {}, body: {}, ...req }, res, value => { error = value; }); return { res, error }; };

    let result = await call(controller.addClasses, { params: { id: String(school._id) }, body: { names: ["Class 11", "class 11 ", "Class 12"] } });
    assert.equal(result.res.code, 201);
    assert.deepEqual(school.classes.map(item => item.name), ["Class 9", "Class 10", "Class 11", "Class 12"]);

    result = await call(controller.addClasses, { params: { id: String(school._id) }, body: { name: "CLASS 9" } });
    assert.equal(result.error.status, 409);

    const grade = school.classes[0];
    result = await call(controller.addSections, { params: { id: String(school._id), classId: String(grade._id) }, body: { names: ["Section C", "Section D"] } });
    assert.equal(result.res.code, 201);
    assert.equal(grade.sections.length, 4);
    result = await call(controller.addSections, { params: { id: String(school._id), classId: String(grade._id) }, body: { name: "section a" } });
    assert.equal(result.error.status, 409);
    result = await call(controller.addSections, { params: { id: String(school._id), classId: String(id()) }, body: { name: "A" } });
    assert.equal(result.error.status, 404);
    result = await call(controller.addClasses, { params: { id: String(school._id) }, body: { name: "   " } });
    assert.equal(result.error.status, 400);
});

test("renaming a school, class or section updates students; removing used ones is blocked", async () => {
    const school = makeSchool();
    const grade = school.classes[0];
    const section = grade.sections[0];
    mock.method(School, "findById", async () => school);
    mock.method(School, "exists", async () => null);
    mock.method(school, "save", async () => school);
    const updates = [];
    mock.method(Student, "updateMany", async (filter, update) => { updates.push([filter, update]); });
    const call = async (handler, req) => { const res = response(); let error; await handler({ params: {}, body: {}, ...req }, res, value => { error = value; }); return { res, error }; };

    await call(controller.updateSchool, { params: { id: String(school._id) }, body: { name: "APS DHA" } });
    await call(controller.updateClass, { params: { id: String(school._id), classId: String(grade._id) }, body: { name: "Grade 9" } });
    await call(controller.updateSection, { params: { id: String(school._id), classId: String(grade._id), sectionId: String(section._id) }, body: { name: "Blue" } });
    assert.deepEqual(updates, [
        [{ schoolRef: school._id }, { $set: { school: "APS DHA" } }],
        [{ schoolRef: school._id, schoolClass: "Class 9" }, { $set: { schoolClass: "Grade 9" } }],
        [{ schoolRef: school._id, schoolClass: "Grade 9", schoolSection: "Section A" }, { $set: { schoolSection: "Blue" } }],
    ]);

    mock.method(Student, "exists", async () => ({ _id: id() }));
    for (const [handler, req] of [
        [controller.deleteSchool, { params: { id: String(school._id) } }],
        [controller.deleteClass, { params: { id: String(school._id), classId: String(grade._id) } }],
        [controller.deleteSection, { params: { id: String(school._id), classId: String(grade._id), sectionId: String(section._id) } }],
    ]) assert.equal((await call(handler, req)).error.status, 409);
    assert.equal(grade.sections.length, 2);

    mock.method(Student, "exists", async () => null);
    const removed = await call(controller.deleteSection, { params: { id: String(school._id), classId: String(grade._id), sectionId: String(section._id) } });
    assert.equal(removed.res.body.success, true);
    assert.equal(grade.sections.length, 1);
});

test("creating a school rejects duplicate names and the public list only shows active schools", async () => {
    mock.method(School, "exists", async () => ({ _id: id() }));
    let error;
    await controller.createSchool({ body: { name: "APS" } }, response(), value => { error = value; });
    assert.equal(error.status, 409);

    let filter;
    mock.method(School, "find", value => { filter = value; return query([makeSchool().toObject()]); });
    controller.invalidatePublicSchools();
    const res = response();
    await controller.getPublicSchools({}, res, () => {});
    await controller.getPublicSchools({}, response(), () => {});
    assert.deepEqual(filter, { isActive: true });
    assert.equal(School.find.mock.callCount(), 1);
    assert.match(res.headers["Cache-Control"], /public/);
    assert.deepEqual(res.body.schools[0].classes.map(item => item.name), ["Class 9", "Class 10"]);
    assert.equal(Object.hasOwn(res.body.schools[0], "studentCount"), false);
});

test("school management routes need the schools permission while the signup list is public", async t => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-only-school-routes-secret";
    t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
    mock.method(School, "find", () => query([]));
    let permissions = ["analytics"];
    mock.method(Admin, "findById", () => ({ select: async () => ({ role: "admin", status: "active", currentSessionId: "current", permissions }) }));
    const app = express();
    app.use("/api/schools", require("../src/routes/schoolRoutes"));
    app.use(require("../src/middleware/requestSafety").errorHandler);
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/schools`;
    const token = jwt.sign({ id: String(id()), role: "admin", sid: "current" }, process.env.JWT_SECRET);
    const headers = { Authorization: `Bearer ${token}` };
    controller.invalidatePublicSchools();
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/manage`)).status, 401);
    assert.equal((await fetch(`${base}/manage`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/${id()}/results/export`, { headers })).status, 403);
    assert.equal((await fetch(base, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" })).status, 403);
    permissions = ["schools"];
    mock.method(Student, "aggregate", async () => []);
    assert.equal((await fetch(`${base}/manage`, { headers })).status, 200);
});

test("Pakistan day ranges are inclusive and reject impossible dates", () => {
    assert.equal(new Date(dayStart("2026-10-22")).toISOString(), "2026-10-21T19:00:00.000Z");
    assert.equal(dayStart("2026-02-30"), null);
    assert.equal(dayStart("22-10-2026"), null);
    const range = dateRange("2026-10-01", "2026-10-31");
    assert.equal(range.start.toISOString(), "2026-09-30T19:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-10-31T18:59:59.999Z");
    assert.deepEqual(dateRange(), {});
    assert.deepEqual(Object.keys(dateRange("2026-10-01")), ["start"]);
    for (const [from, to] of [["bad", undefined], [undefined, "2026-13-01"], ["2026-10-31", "2026-10-01"]]) assert.throws(() => dateRange(from, to), { status: 400 });
    assert.equal(formatDate("2026-10-21T19:30:00Z"), "22 Oct 2026");
    assert.equal(formatTime("2026-10-21T10:05:00Z"), "03:05 PM");
    assert.equal(formatTime("2026-10-21T19:05:00Z"), "12:05 AM");
    assert.equal(formatDuration(3725), "1h 02m");
    assert.equal(formatDuration(65), "1m 05s");
});

test("school reports are limited to the chosen class and section and to completed attempts in the date range", async () => {
    const school = makeSchool();
    const grade = school.classes[0];
    const section = grade.sections[1];
    mock.method(School, "findById", () => query(school.toObject()));
    let studentFilter;
    mock.method(Student, "find", filter => { studentFilter = filter; return query([{ _id: id(), name: "Ayesha", schoolClass: "Class 9", schoolSection: "Section B" }]); });
    const scope = await loadScope(String(school._id), { classId: String(grade._id), sectionId: String(section._id), from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(studentFilter, { schoolRef: school._id, schoolClass: "Class 9", schoolSection: "Section B" });
    assert.deepEqual(scope.studentFilter, studentFilter);
    assert.equal(scope.studentIds.length, 1);
    assert.deepEqual(scope.attemptFilter.status, { $in: ["submitted", "timed_out"] });
    assert.equal(scope.attemptFilter.startedAt.$gte.toISOString(), "2026-09-30T19:00:00.000Z");
    assert.equal(scope.attemptFilter.startedAt.$lte.toISOString(), "2026-10-31T18:59:59.999Z");
    await assert.rejects(loadScope(String(school._id), { sectionId: String(section._id) }), /class before/);
    await assert.rejects(loadScope(String(school._id), { classId: String(id()) }), { status: 400 });
    await assert.rejects(loadScope(String(school._id), { classId: String(grade._id), sectionId: String(id()) }), { status: 400 });
    await assert.rejects(loadScope("nope", {}), { status: 400 });
    mock.method(School, "findById", () => query(null));
    await assert.rejects(loadScope(String(id()), {}), { status: 404 });
});

function reportFixtures() {
    const students = [
        { _id: id(), name: "Ayesha Khan", email: "a@example.com", phone: "+923001234567", schoolClass: "Class 9", schoolSection: "Section A" },
        { _id: id(), name: "Bilal Ahmed", email: "b@example.com", phone: "", schoolClass: "Class 9", schoolSection: "Section A" },
    ];
    const assessment = { _id: id(), title: "Motion Topic Test", type: "topic_test", subject: { name: "Physics" } };
    const attempt = (student, minute, percentage, passStatus) => ({ _id: id(), student: student._id, assessment: assessment._id, status: "submitted", startedAt: new Date(Date.UTC(2026, 9, 21, 10, minute)), submittedAt: new Date(Date.UTC(2026, 9, 21, 10, minute + 10)), timeTakenSeconds: 600, score: percentage / 5, totalMarks: 20, percentage, passStatus, isPartialPractice: false });
    return { students, assessment, attempts: [attempt(students[0], 0, 80, "pass"), attempt(students[0], 20, 40, "fail")] };
}

test("report summaries and student totals count every completed attempt and keep students with none", async () => {
    const { students, assessment, attempts } = reportFixtures();
    const scope = { school: { name: "APS" }, className: "Class 9", sectionName: "Section A", range: {}, studentFilter: {}, studentIds: students.map(item => item._id), attemptFilter: {} };
    mock.method(Student, "find", () => query(students));
    mock.method(AssessmentAttempt, "countDocuments", async () => attempts.length);
    mock.method(AssessmentAttempt, "find", () => query(attempts));
    mock.method(Assessment, "find", () => query([assessment]));
    const report = await fullReport(scope);
    assert.deepEqual(report.summary, { students: 2, studentsAttempted: 1, attempts: 2, averagePercentage: 60 });
    const [first, second] = report.studentRows;
    assert.deepEqual([first.attempts, first.passed, first.average, first.best, first.seconds], [2, 1, 60, 80, 1200]);
    assert.deepEqual([second.attempts, second.average, second.first], [0, null, null]);
    assert.equal(report.rows[0].test.subject, "Physics");
    assert.equal(report.rows[0].test.type, "Topic test");

    const book = await buildWorkbook(scope, report, new Date("2026-10-22T09:30:00Z"));
    assert.equal(book.subarray(0, 2).toString(), "PK");
    const { readSheet } = await import("read-excel-file/node");
    const sheet = name => readSheet(book, name);
    assert.equal((await sheet("Summary")).find(row => row[0] === "School")[1], "APS");
    const people = await sheet("Students");
    assert.equal(people.length, 3);
    assert.deepEqual(people[2].slice(1, 3), ["Bilal Ahmed", "b@example.com"]);
    const rows = await sheet("Attempts");
    assert.equal(rows.length, 3);
    assert.deepEqual([rows[1][1], rows[1][4], rows[1][13], rows[1][14]], ["Ayesha Khan", "Motion Topic Test", 80, "Pass"]);
    assert.equal(workbookName(scope, new Date("2026-10-22T09:30:00Z")), "results_APS_Class-9_Section-A_22-Oct-2026.xlsx");
});

test("large workbooks are built on a worker thread and read back identically", async () => {
    const { buildWorkbookOffThread } = require("../src/services/schoolResultsWorkbook");
    const { students, assessment, attempts } = reportFixtures();
    const scope = { school: { name: "APS" }, className: "", sectionName: "", range: { start: new Date("2026-10-01T00:00:00Z") }, studentFilter: {}, studentIds: students.map(item => item._id), attemptFilter: {} };
    mock.method(Student, "find", () => query(students));
    mock.method(AssessmentAttempt, "countDocuments", async () => attempts.length);
    mock.method(AssessmentAttempt, "find", () => query(attempts));
    mock.method(Assessment, "find", () => query([assessment]));
    const report = await fullReport(scope);
    const inline = await buildWorkbookOffThread(scope, report, new Date("2026-10-22T09:30:00Z"));
    const threaded = await buildWorkbookOffThread(scope, report, new Date("2026-10-22T09:30:00Z"), { inlineLimit: 0 });
    assert.equal(threaded.subarray(0, 2).toString(), "PK");
    const { readSheet } = await import("read-excel-file/node");
    for (const name of ["Summary", "Students", "Attempts"]) assert.deepEqual(await readSheet(threaded, name), await readSheet(inline, name));
});

test("downloads that are too large ask the admin to narrow the selection", async () => {
    mock.method(AssessmentAttempt, "countDocuments", async () => MAX_EXPORT_ATTEMPTS + 1);
    mock.method(AssessmentAttempt, "find", () => { throw new Error("Must not load an oversized selection"); });
    mock.method(Student, "find", () => { throw new Error("Must not load students for an oversized selection"); });
    await assert.rejects(fullReport({ studentIds: [id()], studentFilter: {}, attemptFilter: {} }), { status: 413 });
    const empty = await fullReport({ studentIds: [], studentFilter: {}, attemptFilter: {} });
    assert.equal(empty.summary.attempts, 0);
});

test("report preview returns totals for the whole selection and one page of rows", async () => {
    const { students, assessment, attempts } = reportFixtures();
    const scope = { studentIds: students.map(item => item._id), attemptFilter: { student: { $in: [] } } };
    mock.method(Student, "find", filter => { assert.deepEqual(filter._id.$in, [String(students[0]._id)]); return query([students[0]]); });
    mock.method(AssessmentAttempt, "aggregate", async () => [{ attempts: 2, average: 60, students: [students[0]._id] }]);
    mock.method(AssessmentAttempt, "find", () => query(attempts.slice(0, 1)));
    mock.method(Assessment, "find", () => query([assessment]));
    const preview = await previewReport(scope, 1, 1);
    assert.deepEqual(preview.summary, { students: 2, studentsAttempted: 1, attempts: 2, averagePercentage: 60 });
    assert.equal(preview.rows.length, 1);
    assert.equal(preview.rows[0].student.name, "Ayesha Khan");
    assert.deepEqual(preview.pagination, { page: 1, limit: 1, total: 2, pages: 2 });
    const none = await previewReport({ studentIds: [], attemptFilter: {} }, 1, 25);
    assert.deepEqual(none.rows, []);
    assert.equal(none.pagination.pages, 1);
});

test("result cards count only released results and replace characters the PDF font cannot draw", () => {
    const stats = summarize([
        { percentage: 80, passStatus: "pass", timeTakenSeconds: 60 },
        { percentage: 40, passStatus: "fail", timeTakenSeconds: 60 },
        { percentage: 100, passStatus: "pass", timeTakenSeconds: 60, withheld: true },
    ]);
    assert.deepEqual([stats.attempted, stats.released, stats.average, stats.best, stats.passed, stats.seconds], [3, 2, 60, 80, 1, 180]);
    assert.equal(latin("Ayesha  Khan ایشہ"), "Ayesha Khan ????");
    assert.equal(latin("Zoé"), "Zoé");
});

test("rows are planned so the final page always has room for the stamp", () => {
    for (const total of [1, 3, 4, 5, 8, 9, 10, 25, 26, 27, 28, 29, 40, 300]) {
        const plan = planPages(total, 505, 66);
        assert.equal(plan.reduce((sum, count) => sum + count, 0), total);
        assert.ok(plan.every(count => count > 0), `${total}: ${plan}`);
        assert.ok(plan[0] <= Math.floor((772 - 505) / 30));
        assert.ok(plan.slice(1).every(count => count <= Math.floor((772 - 66) / 30)));
        const last = plan.length === 1 ? 505 + plan[0] * 30 : 66 + plan.at(-1) * 30;
        assert.ok(last <= 640, `${total}: stamp would overlap rows ending at ${last}`);
    }
});

async function bufferOf(doc) {
    const chunks = [];
    for await (const chunk of doc) chunks.push(chunk);
    return Buffer.concat(chunks);
}

test("the result card is a valid PDF with a page per batch of tests", async () => {
    const student = { name: "Ayesha Khan", email: "a@example.com", phone: "+923001234567", city: "Karachi", school: "APS Boys and Girls DHA", schoolClass: "Class 9", schoolSection: "Section A", createdAt: new Date("2026-08-14") };
    const attempt = index => ({ startedAt: new Date(Date.UTC(2026, 9, 21, 10, index)), title: `Test ${index}`, subject: "Physics", type: "Topic test", score: 10, totalMarks: 20, percentage: 50, passStatus: "pass", timeTakenSeconds: 600 });
    const pages = async count => {
        const pdf = await bufferOf(createResultCard({ student, attempts: Array.from({ length: count }, (_, index) => attempt(index)), reference: "ID-1" }));
        assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
        return (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
    };
    assert.equal(await pages(0), 1);
    assert.equal(await pages(3), 1);
    assert.equal(await pages(7), 2);
    assert.ok(await pages(60) >= 3);
});

test("students download their own result card as a PDF attachment", async () => {
    const student = { _id: id(), name: "Ayesha Khan", email: "a@example.com", city: "Karachi", school: "APS", createdAt: new Date() };
    let attemptFilter;
    mock.method(Student, "findById", () => query(student));
    mock.method(AssessmentAttempt, "find", filter => { attemptFilter = filter; return query([{ assessment: { title: "Mock", type: "mock_test", subject: { name: "Physics" }, showResultImmediately: false }, startedAt: new Date(), score: 5, totalMarks: 10, percentage: 50, passStatus: "pass", timeTakenSeconds: 30 }]); });
    const chunks = [];
    const res = Object.assign(response(), { on() { return this; }, once(event, listener) { if (event === "finish") this.onFinish = listener; return this; }, emit() {}, write(chunk) { chunks.push(Buffer.from(chunk)); return true; }, end(chunk) { if (chunk) chunks.push(Buffer.from(chunk)); this.ended = true; this.onFinish?.(); } });
    await downloadResultCard({ student: { _id: student._id } }, res, error => { throw error; });
    await new Promise(resolve => { const wait = () => res.ended ? resolve() : setTimeout(wait, 5); wait(); });
    assert.equal(attemptFilter.student, student._id);
    assert.deepEqual(attemptFilter.status, { $in: ["submitted", "timed_out"] });
    assert.equal(res.headers["Content-Type"], "application/pdf");
    assert.match(res.headers["Content-Disposition"], /^attachment; filename="IlmiDunya-Result-Card-Ayesha-Khan-.*\.pdf"$/);
    assert.equal(Buffer.concat(chunks).subarray(0, 5).toString(), "%PDF-");
});

function studentFlow(t) {
    const crypto = require("node:crypto");
    const auth = require("../src/controllers/studentAuthController");
    const StudentAuthChallenge = require("../src/models/StudentAuthChallenge");
    const previousSecret = process.env.JWT_SECRET;
    const previousKey = process.env.RESEND_API_KEY;
    process.env.JWT_SECRET = "test-only-school-signup-secret-0123456789";
    process.env.RESEND_API_KEY = "test-only";
    t.after(() => {
        if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
        if (previousKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousKey;
    });
    t.mock.method(globalThis, "fetch", async () => ({ ok: true, text: async () => "" }));
    t.mock.method(Student, "findOne", () => query(null));
    return { auth, StudentAuthChallenge, crypto };
}

const profile = { name: "Ayesha Khan", email: "ayesha@example.com", phone: "0300 1234567", city: "Karachi", gender: "female", password: "Passw0rdOK1" };

test("signup keeps the chosen school, class and section until the email code is verified", async t => {
    const { auth, StudentAuthChallenge, crypto } = studentFlow(t);
    const school = makeSchool();
    const grade = school.classes[0];
    t.mock.method(School, "findOne", () => query(school.toObject()));
    t.mock.method(School, "exists", async () => ({ _id: school._id }));
    t.mock.method(StudentAuthChallenge, "findOne", () => query(null));
    t.mock.method(StudentAuthChallenge, "deleteMany", async () => ({}));
    let saved;
    t.mock.method(StudentAuthChallenge.prototype, "save", async function save() { saved = this; return this; });

    const missing = response();
    await auth.requestRegistrationCode({ body: { ...profile, schoolId: String(school._id) } }, missing);
    assert.equal(missing.code, 400);
    assert.match(missing.body.message, /Select your class/);

    const res = response();
    await auth.requestRegistrationCode({ body: { ...profile, schoolId: String(school._id), schoolClassId: String(grade._id), schoolSectionId: String(grade.sections[0]._id) } }, res);
    assert.equal(res.code, 202);
    assert.deepEqual([saved.payload.school, saved.payload.schoolClass, saved.payload.schoolSection], [school.name, "Class 9", "Section A"]);
    assert.equal(String(saved.payload.schoolRef), String(school._id));

    // Verifying the code creates the student with those details.
    const code = "123456";
    const hash = crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${saved._id}:${code}`).digest("hex");
    saved.codeHash = hash;
    t.mock.method(StudentAuthChallenge, "findOne", () => ({ select: async () => saved }));
    t.mock.method(StudentAuthChallenge, "findOneAndDelete", () => ({ select: async () => saved }));
    let created;
    t.mock.method(Student, "create", async data => { created = data; return new Student(data); });
    t.mock.method(Student.prototype, "save", async function save() { return this; });
    const verified = response();
    await auth.verifyRegistrationCode({ body: { challengeId: String(saved._id), otp: code } }, verified);
    assert.equal(verified.code, 201);
    assert.deepEqual([created.school, created.schoolClass, created.schoolSection], [school.name, "Class 9", "Section A"]);
    assert.equal(String(created.schoolRef), String(school._id));
    assert.equal(verified.body.student.schoolClass, "Class 9");
    assert.equal(verified.body.student.schoolSection, "Section A");

    // A school removed while the student was entering the code is reported, not saved.
    t.mock.method(School, "exists", async () => null);
    created = null;
    const stale = response();
    await auth.verifyRegistrationCode({ body: { challengeId: String(saved._id), otp: code } }, stale);
    assert.equal(stale.code, 409);
    assert.equal(created, null);
});

test("signup with another school or as a private student stores no school reference", async t => {
    const { auth, StudentAuthChallenge } = studentFlow(t);
    t.mock.method(School, "findOne", () => { throw new Error("Unmanaged schools must not be looked up"); });
    t.mock.method(StudentAuthChallenge, "findOne", () => query(null));
    t.mock.method(StudentAuthChallenge, "deleteMany", async () => ({}));
    const payloads = [];
    t.mock.method(StudentAuthChallenge.prototype, "save", async function save() { payloads.push(this.payload); return this; });
    await auth.requestRegistrationCode({ body: { ...profile, schoolId: "other", school: "City Grammar School" } }, response());
    await auth.requestRegistrationCode({ body: { ...profile, email: "bilal@example.com", phone: "0301 7654321", schoolId: "private" } }, response());
    assert.deepEqual(payloads.map(item => item.school), ["City Grammar School", "Private Student"]);
    assert.ok(payloads.every(item => !item.schoolRef && !item.schoolClass && !item.schoolSection));
});

test("students can change their school, class and section, which clears stale details", async t => {
    const { auth } = studentFlow(t);
    const school = makeSchool();
    const grade = school.classes[0];
    t.mock.method(School, "findOne", () => query(school.toObject()));
    const updates = [];
    t.mock.method(Student, "findOneAndUpdate", async (filter, update) => {
        updates.push([filter, update]);
        return new Student({ name: "Ayesha Khan", email: "a@example.com", phone: "+923001234567", city: "Karachi", school: update.$set.school, schoolRef: update.$set.schoolRef, schoolClass: update.$set.schoolClass, schoolSection: update.$set.schoolSection });
    });
    const studentId = id();
    const listed = response();
    await auth.updateStudentSchool({ student: { _id: studentId }, body: { schoolId: String(school._id), schoolClassId: String(grade._id), schoolSectionId: String(grade.sections[1]._id) } }, listed);
    assert.equal(listed.body.student.schoolSection, "Section B");
    assert.deepEqual(updates[0][0], { _id: studentId, status: "active" });
    assert.equal(updates[0][1].$unset, undefined);

    const moved = response();
    await auth.updateStudentSchool({ student: { _id: studentId }, body: { schoolId: "other", school: "City Grammar School" } }, moved);
    assert.equal(moved.body.student.school, "City Grammar School");
    assert.deepEqual(updates[1][1].$unset, { schoolRef: "", schoolClass: "", schoolSection: "" });

    const invalid = response();
    await auth.updateStudentSchool({ student: { _id: studentId }, body: { schoolId: String(school._id) } }, invalid);
    assert.equal(invalid.code, 400);
    assert.equal(updates.length, 2);
});
