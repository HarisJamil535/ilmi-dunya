const mongoose = require("mongoose");
const School = require("../models/School");
const Student = require("../models/Student");
const Assessment = require("../models/Assessment");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const { fail } = require("./publishing");
const { dateRange } = require("./pakistanTime");

const COMPLETED = ["submitted", "timed_out"];
const MAX_EXPORT_ATTEMPTS = 30000;
const attemptFields = "student assessment status startedAt submittedAt timeTakenSeconds score totalMarks percentage passStatus isPartialPractice autoSubmitted";

const testTypeLabel = type => String(type || "").replaceAll("_", " ").replace(/^\w/, letter => letter.toUpperCase());

// Works out which school, class, section, students and dates a report covers.
async function loadScope(schoolId, query = {}) {
    if (!mongoose.isValidObjectId(schoolId)) fail("Choose a valid school.");
    const school = await School.findById(schoolId).lean();
    if (!school) fail("School not found.", 404);

    let grade = null;
    let section = null;
    if (query.classId) {
        grade = mongoose.isValidObjectId(query.classId) ? school.classes.find(item => String(item._id) === String(query.classId)) : null;
        if (!grade) fail("Choose a class that belongs to this school.");
        if (query.sectionId) {
            section = mongoose.isValidObjectId(query.sectionId) ? grade.sections.find(item => String(item._id) === String(query.sectionId)) : null;
            if (!section) fail("Choose a section that belongs to this class.");
        }
    } else if (query.sectionId) {
        fail("Choose a class before choosing a section.");
    }

    const range = dateRange(query.from, query.to);
    const filter = {
        schoolRef: school._id,
        ...(grade ? { schoolClass: grade.name } : {}),
        ...(section ? { schoolSection: section.name } : {}),
    };
    // Only ids here: a report page does not need every student's details.
    const studentIds = (await Student.find(filter).select("_id").lean()).map(student => student._id);

    return {
        school,
        className: grade?.name || "",
        sectionName: section?.name || "",
        range,
        studentFilter: filter,
        studentIds,
        attemptFilter: {
            student: { $in: studentIds },
            status: { $in: COMPLETED },
            ...(range.start || range.end ? { startedAt: { ...(range.start ? { $gte: range.start } : {}), ...(range.end ? { $lte: range.end } : {}) } } : {}),
        },
    };
}

async function loadTests(attempts) {
    const ids = [...new Set(attempts.map(attempt => String(attempt.assessment)))];
    if (!ids.length) return new Map();
    const tests = await Assessment.find({ _id: { $in: ids } }).select("title type subject").populate("subject", "name").lean();
    return new Map(tests.map(test => [String(test._id), { title: test.title, type: testTypeLabel(test.type), subject: test.subject?.name || "" }]));
}

const rowFor = (attempt, student, test) => ({
    _id: attempt._id,
    student: { _id: student?._id, name: student?.name || "Removed student", class: student?.schoolClass || "", section: student?.schoolSection || "" },
    test: test || { title: "Removed test", type: "", subject: "" },
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeTakenSeconds: attempt.timeTakenSeconds || 0,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    passStatus: attempt.passStatus,
    status: attempt.status,
    autoSubmitted: Boolean(attempt.autoSubmitted),
    isPartialPractice: Boolean(attempt.isPartialPractice),
});

// One page of attempts plus totals for the whole selection.
async function previewReport(scope, page, limit) {
    const none = !scope.studentIds.length;
    const [totals, attempts] = none ? [[], []] : await Promise.all([
        AssessmentAttempt.aggregate([
            { $match: scope.attemptFilter },
            { $group: { _id: null, attempts: { $sum: 1 }, average: { $avg: "$percentage" }, students: { $addToSet: "$student" } } },
        ]),
        AssessmentAttempt.find(scope.attemptFilter).select(attemptFields).sort({ startedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    const total = totals[0] || { attempts: 0, average: 0, students: [] };
    const [tests, people] = await Promise.all([
        loadTests(attempts),
        attempts.length ? Student.find({ _id: { $in: [...new Set(attempts.map(attempt => String(attempt.student)))] } }).select("name schoolClass schoolSection").lean() : [],
    ]);
    const students = new Map(people.map(student => [String(student._id), student]));
    return {
        summary: {
            students: scope.studentIds.length,
            studentsAttempted: total.students.length,
            attempts: total.attempts,
            averagePercentage: Math.round((total.average || 0) * 100) / 100,
        },
        rows: attempts.map(attempt => rowFor(attempt, students.get(String(attempt.student)), tests.get(String(attempt.assessment)))),
        pagination: { page, limit, total: total.attempts, pages: Math.max(1, Math.ceil(total.attempts / limit)) },
    };
}

// Every attempt in scope with per-student totals, for the Excel file.
async function fullReport(scope) {
    let attempts = [];
    let students = [];
    if (scope.studentIds.length) {
        const count = await AssessmentAttempt.countDocuments(scope.attemptFilter);
        if (count > MAX_EXPORT_ATTEMPTS) fail(`This selection has ${count.toLocaleString("en-US")} attempts. Choose a class, section or shorter date range to download at most ${MAX_EXPORT_ATTEMPTS.toLocaleString("en-US")}.`, 413);
        [students, attempts] = await Promise.all([
            Student.find(scope.studentFilter).select("name email phone schoolClass schoolSection").sort({ schoolClass: 1, schoolSection: 1, name: 1, _id: 1 }).lean(),
            AssessmentAttempt.find(scope.attemptFilter).select(attemptFields).sort({ startedAt: 1, _id: 1 }).lean(),
        ]);
    }
    const tests = await loadTests(attempts);
    const byStudent = new Map(students.map(student => [String(student._id), student]));
    const stats = new Map();
    const rows = attempts.map(attempt => {
        const key = String(attempt.student);
        const stat = stats.get(key) || { attempts: 0, passed: 0, total: 0, best: 0, seconds: 0, first: null, last: null };
        stat.attempts += 1;
        if (attempt.passStatus === "pass") stat.passed += 1;
        stat.total += attempt.percentage || 0;
        stat.best = Math.max(stat.best, attempt.percentage || 0);
        stat.seconds += attempt.timeTakenSeconds || 0;
        stat.first = stat.first && stat.first < attempt.startedAt ? stat.first : attempt.startedAt;
        stat.last = stat.last && stat.last > attempt.startedAt ? stat.last : attempt.startedAt;
        stats.set(key, stat);
        return rowFor(attempt, byStudent.get(key), tests.get(String(attempt.assessment)));
    });
    const attemptedStudents = stats.size;
    return {
        rows,
        studentRows: students.map(student => {
            const stat = stats.get(String(student._id));
            return {
                name: student.name,
                email: student.email,
                phone: student.phone || "",
                class: student.schoolClass || "",
                section: student.schoolSection || "",
                attempts: stat?.attempts || 0,
                passed: stat?.passed || 0,
                average: stat ? Math.round((stat.total / stat.attempts) * 100) / 100 : null,
                best: stat ? stat.best : null,
                seconds: stat?.seconds || 0,
                first: stat?.first || null,
                last: stat?.last || null,
            };
        }),
        summary: {
            students: students.length,
            studentsAttempted: attemptedStudents,
            attempts: rows.length,
            averagePercentage: rows.length ? Math.round((rows.reduce((sum, row) => sum + (row.percentage || 0), 0) / rows.length) * 100) / 100 : 0,
        },
    };
}

module.exports = { COMPLETED, MAX_EXPORT_ATTEMPTS, loadScope, previewReport, fullReport, testTypeLabel };
