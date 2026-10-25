const path = require("node:path");
const { Worker } = require("node:worker_threads");
const writeXlsxFile = require("write-excel-file/node");
const { shifted, formatDate, formatDateTime, formatDuration } = require("./pakistanTime");

const BRAND = "#623FCD";
const SOFT = "#F3EFFF";
const BORDER = "#D9D2F2";

const header = value => ({ value, fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: BRAND, alignVertical: "center", wrap: true, borderColor: BORDER });
const text = (value, extra = {}) => ({ value: value ?? "", type: String, alignVertical: "center", borderColor: BORDER, ...extra });
const number = (value, extra = {}) => value === null || value === undefined ? text("", extra) : { value, type: Number, alignVertical: "center", borderColor: BORDER, ...extra };
// Excel stores dates without a time zone, so the Pakistan wall-clock time is written as-is.
const date = (value, format) => value ? { value: shifted(value), type: Date, format, alignVertical: "center", borderColor: BORDER } : text("");

const resultLabel = status => status === "pass" ? "Pass" : status === "fail" ? "Fail" : "—";
const submission = row => row.status === "timed_out" ? "Time ran out" : row.autoSubmitted ? "Auto-submitted" : "Submitted";

function sheetRange(scope) {
    const { start, end } = scope.range;
    if (!start && !end) return "All dates";
    return `${start ? formatDate(start) : "Beginning"} to ${end ? formatDate(end) : "today"}`;
}

function summarySheet(scope, report, generatedAt) {
    const line = (label, value) => [text(label, { fontWeight: "bold", backgroundColor: SOFT }), text(value)];
    return {
        sheet: "Summary",
        columns: [{ width: 26 }, { width: 48 }],
        data: [
            [{ value: "IlmiDunya — School Results Report", fontWeight: "bold", fontSize: 16, textColor: BRAND, columnSpan: 2 }, null],
            [text(""), text("")],
            line("School", scope.school.name),
            line("Class", scope.className || "All classes"),
            line("Section", scope.sectionName || "All sections"),
            line("Subject", scope.subject ? `${scope.subject.name}${scope.subject.className ? ` (${scope.subject.className})` : ""}` : "All subjects"),
            line("Attempts taken", sheetRange(scope)),
            line("Report generated", `${formatDateTime(generatedAt)} (Pakistan time)`),
            [text(""), text("")],
            line("Students in selection", String(report.summary.students)),
            line("Students who attempted", String(report.summary.studentsAttempted)),
            line("Completed attempts", String(report.summary.attempts)),
            line("Average score", `${report.summary.averagePercentage}%`),
            [text(""), text("")],
            [{ value: "Only completed attempts are included. Times are in Pakistan Standard Time. Scores for tests whose results are still withheld are included here for school staff.", wrap: true, columnSpan: 2, textColor: "#64748B" }, null],
        ],
    };
}

function studentsSheet(report) {
    const columns = [6, 28, 30, 18, 14, 12, 10, 9, 12, 10, 14, 16, 16].map(width => ({ width }));
    const titles = ["#", "Student", "Email", "WhatsApp / phone", "Class", "Section", "Attempts", "Passed", "Average %", "Best %", "Total time", "First attempt", "Last attempt"];
    return {
        sheet: "Students",
        columns,
        stickyRowsCount: 1,
        data: [
            titles.map(header),
            ...report.studentRows.map((student, index) => [
                number(index + 1), text(student.name), text(student.email), text(student.phone), text(student.class), text(student.section),
                number(student.attempts), number(student.passed), number(student.average), number(student.best),
                text(student.attempts ? formatDuration(student.seconds) : ""),
                text(student.first ? formatDateTime(student.first) : "No attempts"), text(student.last ? formatDateTime(student.last) : ""),
            ]),
        ],
    };
}

function attemptsSheet(report) {
    const columns = [6, 28, 12, 10, 38, 18, 20, 14, 12, 12, 12, 10, 10, 10, 9, 16, 12].map(width => ({ width }));
    const titles = ["#", "Student", "Class", "Section", "Test", "Test type", "Subject", "Date", "Start time", "Submit time", "Time taken", "Marks", "Out of", "Score %", "Result", "Submission", "Practice set"];
    return {
        sheet: "Attempts",
        columns,
        stickyRowsCount: 1,
        data: [
            titles.map(header),
            ...report.rows.map((row, index) => [
                number(index + 1), text(row.student.name), text(row.student.class), text(row.student.section),
                text(row.test.title), text(row.test.type), text(row.test.subject),
                date(row.startedAt, "dd mmm yyyy"), date(row.startedAt, "hh:mm AM/PM"), date(row.submittedAt, "hh:mm AM/PM"),
                text(formatDuration(row.timeTakenSeconds)),
                number(row.score), number(row.totalMarks), number(row.percentage),
                text(resultLabel(row.passStatus)), text(submission(row)), text(row.isPartialPractice ? "Yes" : "No"),
            ]),
        ],
    };
}

async function buildWorkbook(scope, report, generatedAt = new Date()) {
    return writeXlsxFile([summarySheet(scope, report, generatedAt), studentsSheet(report), attemptsSheet(report)]).toBuffer();
}

// Building a big workbook takes seconds of pure computation, so it runs on a worker thread.
const INLINE_LIMIT = 1000;
const WORKER_TIMEOUT_MS = 120000;

async function buildWorkbookOffThread(scope, report, generatedAt = new Date(), { inlineLimit = INLINE_LIMIT } = {}) {
    if (report.rows.length + report.studentRows.length <= inlineLimit) return buildWorkbook(scope, report, generatedAt);
    // Only plain values cross to the worker; database ids are not needed in the file.
    const payload = {
        generatedAt: generatedAt.getTime(),
        scope: { school: { name: scope.school.name }, className: scope.className, sectionName: scope.sectionName, subject: scope.subject ? { name: scope.subject.name, className: scope.subject.className } : null, range: { start: scope.range.start, end: scope.range.end } },
        report: {
            summary: report.summary,
            studentRows: report.studentRows,
            rows: report.rows.map(({ student, test, startedAt, submittedAt, timeTakenSeconds, score, totalMarks, percentage, passStatus, status, autoSubmitted, isPartialPractice }) => ({
                student: { name: student.name, class: student.class, section: student.section }, test, startedAt, submittedAt, timeTakenSeconds, score, totalMarks, percentage, passStatus, status, autoSubmitted, isPartialPractice,
            })),
        },
    };
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, "workbookWorker.js"), { workerData: payload });
        const timer = setTimeout(() => {
            worker.terminate();
            reject(Object.assign(new Error("The Excel file took too long to create. Choose a class, section or shorter date range."), { status: 504 }));
        }, WORKER_TIMEOUT_MS);
        const finish = (action, value) => { clearTimeout(timer); action(value); };
        worker.once("message", message => message.error ? finish(reject, new Error(message.error)) : finish(resolve, Buffer.from(message.buffer)));
        worker.once("error", error => finish(reject, error));
        worker.once("exit", code => { if (code !== 0) finish(reject, new Error(`Excel worker stopped (${code}).`)); });
    });
}

function workbookName(scope, generatedAt = new Date()) {
    const part = value => String(value || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const day = formatDate(generatedAt).replaceAll(" ", "-");
    return `${["results", part(scope.school.name), part(scope.className), part(scope.sectionName), part(scope.subject?.name), day].filter(Boolean).join("_")}.xlsx`;
}

module.exports = { buildWorkbook, buildWorkbookOffThread, workbookName };
