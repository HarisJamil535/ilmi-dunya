const Student = require("../models/Student");
const Subject = require("../models/Subject");
require("../models/Class"); // subjects are shown with their class name
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const { fail } = require("./publishing");
const { testTypeLabel } = require("./schoolResults");

// A PDF lays out every row by hand, so very large selections are split by class, section, subject or dates.
const MAX_PDF_ATTEMPTS = 6000;
const MAX_PDF_STUDENTS = 800;

// Common Pakistani board grading scale.
const GRADES = [
    { grade: "A+", min: 80, label: "Exceptional" },
    { grade: "A", min: 70, label: "Excellent" },
    { grade: "B", min: 60, label: "Very good" },
    { grade: "C", min: 50, label: "Good" },
    { grade: "D", min: 40, label: "Fair" },
    { grade: "E", min: 33, label: "Satisfactory" },
    { grade: "F", min: 0, label: "Needs improvement" },
];
const gradeFor = percentage => GRADES.find(item => (Number(percentage) || 0) >= item.min) || GRADES[GRADES.length - 1];
const round = (value, digits = 1) => Math.round((Number(value) || 0) * 10 ** digits) / 10 ** digits;
const id = value => (value ? String(value) : "");

// The subjects that students in this selection have attempted, for the subject filter.
async function subjectsInScope(scope) {
    if (!scope.studentIds.length) return [];
    const rows = await AssessmentAttempt.aggregate([
        // Every subject is listed, whichever one is currently chosen.
        { $match: (({ assessment, ...rest }) => rest)(scope.attemptFilter) },
        { $group: { _id: "$assessment" } },
        { $lookup: { from: "assessments", localField: "_id", foreignField: "_id", as: "test", pipeline: [{ $project: { subject: 1 } }] } },
        { $unwind: "$test" },
        { $group: { _id: "$test.subject" } },
    ]);
    const subjects = await Subject.find({ _id: { $in: rows.map(row => row._id) } }).select("name class").populate("class", "name").lean();
    return subjects.map(subject => ({ _id: subject._id, name: subject.name, className: subject.class?.name || "" }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.className.localeCompare(b.className));
}

// Running statistics for a group of attempts (a student, subject, chapter or topic).
const emptyStats = () => ({ attempts: 0, passed: 0, failed: 0, totalPercentage: 0, best: 0, lowest: null, seconds: 0, questions: 0, correct: 0, wrong: 0, skipped: 0, students: new Set(), tests: new Set() });
function add(stats, attempt) {
    stats.attempts += 1;
    if (attempt.passStatus === "pass") stats.passed += 1;
    if (attempt.passStatus === "fail") stats.failed += 1;
    stats.totalPercentage += attempt.percentage;
    stats.best = Math.max(stats.best, attempt.percentage);
    stats.lowest = stats.lowest === null ? attempt.percentage : Math.min(stats.lowest, attempt.percentage);
    stats.seconds += attempt.timeTakenSeconds;
    stats.questions += attempt.questions;
    stats.correct += attempt.correct;
    stats.wrong += attempt.wrong;
    stats.skipped += attempt.skipped;
    stats.students.add(attempt.studentId);
    stats.tests.add(attempt.testId);
    return stats;
}
const finish = stats => ({
    attempts: stats.attempts,
    passed: stats.passed,
    failed: stats.failed,
    average: stats.attempts ? round(stats.totalPercentage / stats.attempts) : 0,
    best: round(stats.best),
    lowest: round(stats.lowest ?? 0),
    passRate: stats.passed + stats.failed ? round(stats.passed / (stats.passed + stats.failed) * 100) : 0,
    seconds: stats.seconds,
    questions: stats.questions,
    correct: stats.correct,
    wrong: stats.wrong,
    skipped: stats.skipped,
    accuracy: stats.questions ? round(stats.correct / stats.questions * 100) : 0,
    students: stats.students.size,
    tests: stats.tests.size,
});

// Everything both PDF reports need, as plain values so it can be handed to a worker thread.
async function pdfReportData(scope) {
    const { subject } = scope;
    const students = scope.studentIds.length
        ? await Student.find(scope.studentFilter).select("name email phone city schoolClass schoolSection createdAt").sort({ schoolClass: 1, schoolSection: 1, name: 1, _id: 1 }).lean()
        : [];
    if (students.length > MAX_PDF_STUDENTS) fail(`This selection has ${students.length} students. Choose a class or section to create a PDF for at most ${MAX_PDF_STUDENTS}.`, 413);

    const pipeline = [
        { $match: scope.attemptFilter },
        { $lookup: { from: "assessments", localField: "assessment", foreignField: "_id", as: "test", pipeline: [{ $project: { title: 1, type: 1, subject: 1, chapter: 1, topic: 1 } }] } },
        { $unwind: "$test" },
        { $project: {
            student: 1, startedAt: 1, submittedAt: 1, timeTakenSeconds: 1, score: 1, totalMarks: 1, percentage: 1, passStatus: 1, status: 1, autoSubmitted: 1, isPartialPractice: 1, test: 1,
            questions: { $size: "$answers" },
            correct: { $size: { $filter: { input: "$answers", cond: "$$this.isCorrect" } } },
            skipped: { $size: { $filter: { input: "$answers", cond: { $eq: [{ $ifNull: ["$$this.selectedOption", ""] }, ""] } } } },
        } },
        { $sort: { startedAt: 1, _id: 1 } },
    ];
    const count = scope.studentIds.length ? await AssessmentAttempt.countDocuments(scope.attemptFilter) : 0;
    if (count > MAX_PDF_ATTEMPTS) fail(`This selection has ${count.toLocaleString("en-US")} attempts. Choose a class, section, subject or shorter date range to create a PDF of at most ${MAX_PDF_ATTEMPTS.toLocaleString("en-US")}.`, 413);
    const raw = count ? await AssessmentAttempt.aggregate(pipeline).allowDiskUse(true) : [];

    const [subjects, chapters, topics] = await Promise.all([
        Subject.find({ _id: { $in: [...new Set(raw.map(row => id(row.test.subject)))].filter(Boolean) } }).select("name class").populate("class", "name").lean(),
        Chapter.find({ _id: { $in: [...new Set(raw.map(row => id(row.test.chapter)))].filter(Boolean) } }).select("name chapterNumber").lean(),
        Topic.find({ _id: { $in: [...new Set(raw.map(row => id(row.test.topic)))].filter(Boolean) } }).select("name topicNumber").lean(),
    ]);
    const subjectName = new Map(subjects.map(item => [id(item._id), item.name]));
    const chapterInfo = new Map(chapters.map(item => [id(item._id), { name: item.name, number: item.chapterNumber }]));
    const topicInfo = new Map(topics.map(item => [id(item._id), { name: item.name, number: item.topicNumber }]));

    // Attempt number per student per test, counted in date order.
    const tries = new Map();
    const attempts = raw.map(row => {
        const key = `${row.student}:${row.test._id}`;
        tries.set(key, (tries.get(key) || 0) + 1);
        const chapter = chapterInfo.get(id(row.test.chapter));
        const topic = topicInfo.get(id(row.test.topic));
        const percentage = row.totalMarks > 0 ? round(row.score / row.totalMarks * 100, 2) : 0;
        return {
            studentId: id(row.student),
            testId: id(row.test._id),
            title: row.test.title || "Test",
            type: testTypeLabel(row.test.type),
            subject: subjectName.get(id(row.test.subject)) || "",
            subjectId: id(row.test.subject),
            // A chapter or topic deleted since the test was taken is shown by the test's title.
            chapter: chapter ? `Ch ${chapter.number}: ${chapter.name}` : row.test.chapter ? row.test.title || "Chapter" : "",
            chapterId: id(row.test.chapter),
            topic: topic ? `${topic.number} ${topic.name}` : row.test.topic ? row.test.title || "Topic" : "",
            topicId: id(row.test.topic),
            attemptNo: tries.get(key),
            startedAt: row.startedAt,
            submittedAt: row.submittedAt,
            timeTakenSeconds: Number(row.timeTakenSeconds) || 0,
            score: Number(row.score) || 0,
            totalMarks: Number(row.totalMarks) || 0,
            percentage,
            grade: gradeFor(percentage).grade,
            passStatus: row.passStatus,
            submission: row.status === "timed_out" ? "Time ran out" : row.autoSubmitted ? "Auto-submitted" : "Submitted",
            practiceSet: Boolean(row.isPartialPractice),
            questions: row.questions,
            correct: row.correct,
            skipped: row.skipped,
            wrong: Math.max(0, row.questions - row.correct - row.skipped),
        };
    });

    const group = keyOf => {
        const map = new Map();
        for (const attempt of attempts) {
            const key = keyOf(attempt);
            if (!key) continue;
            if (!map.has(key)) map.set(key, emptyStats());
            add(map.get(key), attempt);
        }
        return map;
    };
    const overall = finish(attempts.reduce((stats, attempt) => add(stats, attempt), emptyStats()));
    const bySubject = group(attempt => attempt.subjectId);
    const byChapter = group(attempt => attempt.chapterId);
    const byTopic = group(attempt => attempt.topicId);
    const byStudent = group(attempt => attempt.studentId);

    // Each student's attempts and per-subject statistics, gathered in one pass.
    const ownAttempts = new Map();
    const ownSubjects = new Map();
    for (const attempt of attempts) {
        if (!ownAttempts.has(attempt.studentId)) { ownAttempts.set(attempt.studentId, []); ownSubjects.set(attempt.studentId, new Map()); }
        ownAttempts.get(attempt.studentId).push(attempt);
        const subjects = ownSubjects.get(attempt.studentId);
        if (!subjects.has(attempt.subjectId)) subjects.set(attempt.subjectId, { subject: attempt.subject || "Other", stats: emptyStats() });
        add(subjects.get(attempt.subjectId).stats, attempt);
    }

    const studentRows = students.map(student => {
        const stats = byStudent.get(id(student._id));
        const own = ownAttempts.get(id(student._id)) || [];
        const subjectsOfStudent = [...(ownSubjects.get(id(student._id))?.values() || [])]
            .map(item => ({ subject: item.subject, ...finish(item.stats) }))
            .sort((a, b) => a.subject.localeCompare(b.subject));
        const summary = stats ? finish(stats) : null;
        return {
            _id: id(student._id),
            name: student.name,
            email: student.email || "",
            phone: student.phone || "",
            city: student.city || "",
            className: student.schoolClass || "",
            sectionName: student.schoolSection || "",
            memberSince: student.createdAt || null,
            summary,
            grade: summary ? gradeFor(summary.average).grade : "",
            subjects: subjectsOfStudent,
            attempts: own,
            first: own[0]?.startedAt || null,
            last: own[own.length - 1]?.startedAt || null,
        };
    });

    // Merit list: higher average first, then higher accuracy, more tests, and less time.
    const ranked = studentRows.filter(row => row.summary)
        .sort((a, b) => b.summary.average - a.summary.average || b.summary.accuracy - a.summary.accuracy || b.summary.tests - a.summary.tests || a.summary.seconds - b.summary.seconds || a.name.localeCompare(b.name));
    let position = 0;
    ranked.forEach((row, index) => {
        const previous = ranked[index - 1];
        if (!previous || previous.summary.average !== row.summary.average || previous.summary.accuracy !== row.summary.accuracy) position = index + 1;
        row.position = position;
    });

    const distribution = GRADES.map(item => ({ ...item, students: ranked.filter(row => row.grade === item.grade).length }));
    // The first attempt seen for each group supplies its names.
    const samples = new Map();
    for (const attempt of attempts) for (const key of [attempt.subjectId, attempt.chapterId, attempt.topicId]) if (key && !samples.has(key)) samples.set(key, attempt);
    const named = (map, extra) => [...map.entries()].map(([key, value]) => ({ ...extra(samples.get(key)), ...finish(value) }));

    return {
        subject: subject ? { name: subject.name, className: subject.className } : null,
        overall: { ...overall, studentsInScope: students.length, studentsAttempted: ranked.length },
        distribution,
        subjects: named(bySubject, sample => ({ name: sample.subject || "Other" })).sort((a, b) => a.name.localeCompare(b.name)),
        chapters: named(byChapter, sample => ({ name: sample.chapter, subject: sample.subject })).sort((a, b) => a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name, undefined, { numeric: true })),
        topics: named(byTopic, sample => ({ name: sample.topic, subject: sample.subject, chapter: sample.chapter })).sort((a, b) => a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name, undefined, { numeric: true })),
        students: studentRows,
        merit: ranked.map(row => row._id),
        notAttempted: studentRows.filter(row => !row.summary).map(row => ({ name: row.name, className: row.className, sectionName: row.sectionName })),
    };
}

module.exports = { pdfReportData, subjectsInScope, gradeFor, GRADES, MAX_PDF_ATTEMPTS, MAX_PDF_STUDENTS };
