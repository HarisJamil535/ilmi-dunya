const { loadScope, previewReport, fullReport } = require("../services/schoolResults");
const { buildWorkbookOffThread, workbookName } = require("../services/schoolResultsWorkbook");
const { createConcurrencyLimit } = require("../services/concurrencyLimit");
const path = require("node:path");
const crypto = require("node:crypto");
const { Worker } = require("node:worker_threads");
const IssuedReport = require("../models/IssuedReport");
const { pdfReportData, subjectsInScope } = require("../services/schoolReportData");
const { formatDate } = require("../services/pakistanTime");

// Each workbook needs a worker thread and a lot of memory, so only a couple are built at a time.
const exportTurn = createConcurrencyLimit(2);

const filtersFor = scope => ({
    school: { _id: scope.school._id, name: scope.school.name },
    className: scope.className,
    sectionName: scope.sectionName,
    subject: scope.subject,
    from: scope.range.start || null,
    to: scope.range.end || null,
});

// On-screen report: totals for the whole selection and one page of attempts.
const getSchoolResults = async (req, res, next) => {
    try {
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
        const scope = await loadScope(req.params.id, req.query);
        res.json({ success: true, filters: filtersFor(scope), ...await previewReport(scope, page, limit) });
    } catch (error) { next(error); }
};

// Excel download with a summary, a student sheet and one row per attempt.
const exportSchoolResults = (req, res, next) => exportTurn(() => buildExport(req, res, next));

const buildExport = async (req, res, next) => {
    try {
        const scope = await loadScope(req.params.id, req.query);
        const report = await fullReport(scope);
        const generatedAt = new Date();
        const buffer = await buildWorkbookOffThread(scope, report, generatedAt);
        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${workbookName(scope, generatedAt)}"`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "private, no-store",
        }).send(buffer);
    } catch (error) { next(error); }
};

// Subjects the selected students have taken tests in, for the subject filter.
const getResultSubjects = async (req, res, next) => {
    try {
        const scope = await loadScope(req.params.id, req.query);
        res.json({ success: true, subjects: await subjectsInScope(scope) });
    } catch (error) { next(error); }
};

// Unambiguous letters and digits, so a reference read from paper is typed correctly.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newReference = (issuedAt) => {
    const day = new Date(issuedAt.getTime() + 5 * 3600 * 1000).toISOString().slice(2, 10).replaceAll("-", "");
    return `IDR-${day}-${[...crypto.randomBytes(6)].map(byte => ALPHABET[byte % ALPHABET.length]).join("")}`;
};

const periodLabel = ({ start, end }) => (!start && !end ? "All dates" : `${start ? formatDate(start) : "Beginning"} to ${end ? formatDate(end) : formatDate(new Date())}`);
const verifyBase = () => {
    try { return new URL(process.env.SITE_URL).origin; } catch { return "https://www.ilmidunya.org"; }
};

const PDF_WORKER_TIMEOUT_MS = 150000;
function renderOffThread(meta, data) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, "../services/reportPdfWorker.js"), { workerData: { meta, data } });
        const timer = setTimeout(() => {
            worker.terminate();
            reject(Object.assign(new Error("The PDF took too long to create. Choose a class, section, subject or shorter date range."), { status: 504 }));
        }, PDF_WORKER_TIMEOUT_MS);
        const finish = (action, value) => { clearTimeout(timer); action(value); };
        worker.once("message", message => message.error ? finish(reject, new Error(message.error)) : finish(resolve, Buffer.from(message.buffer)));
        worker.once("error", error => finish(reject, error));
        worker.once("exit", code => { if (code !== 0) finish(reject, new Error(`PDF worker stopped (${code}).`)); });
    });
}

// A class/section result report, or a report card for every student, with a verification record.
const exportSchoolResultsPdf = (req, res, next) => exportTurn(() => buildPdf(req, res, next));

const buildPdf = async (req, res, next) => {
    try {
        const kind = req.query.kind === "cards" ? "cards" : "report";
        const scope = await loadScope(req.params.id, req.query);
        const data = await pdfReportData(scope);
        const issuedAt = new Date();
        const reference = newReference(issuedAt);
        const position = new Map(data.merit.map(key => [key, data.students.find(student => student._id === key)?.position]));
        const carded = data.students.filter(student => student.summary);
        const cardReferences = Object.fromEntries(carded.map((student, index) => [student._id, `${reference}-${String(index + 1).padStart(3, "0")}`]));
        const meta = {
            kind, reference, issuedAt, verifyBase: verifyBase(), cardReferences,
            schoolName: scope.school.name, className: scope.className, sectionName: scope.sectionName, period: periodLabel(scope.range),
            documentTitle: `${kind === "cards" ? "Student Report Cards" : "Result Report"} - ${scope.school.name}`,
            runningTitle: `${kind === "cards" ? "Student report cards" : "Result report"} · ${[scope.school.name, scope.className, scope.sectionName].filter(Boolean).join(" · ")}`,
        };
        const buffer = await renderOffThread(meta, data);
        const subjectName = data.subject ? `${data.subject.name}${data.subject.className ? ` (${data.subject.className})` : ""}` : "";
        await IssuedReport.create({
            reference, kind, schoolName: scope.school.name, className: scope.className, sectionName: scope.sectionName, subjectName, period: meta.period,
            students: data.overall.studentsInScope, studentsAttempted: data.overall.studentsAttempted, attempts: data.overall.attempts,
            average: data.overall.average, passRate: data.overall.passRate, issuedAt, issuedBy: req.admin?._id,
            ...(kind === "cards" ? { cards: carded.map(student => ({
                reference: cardReferences[student._id], name: student.name, className: student.className, sectionName: student.sectionName,
                tests: student.summary.tests, attempts: student.summary.attempts, average: student.summary.average, grade: student.grade, position: position.get(student._id),
            })) } : {}),
        });
        const part = value => String(value || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
        const fileName = `${["IlmiDunya", kind === "cards" ? "Report-Cards" : "Result-Report", part(scope.school.name), part(scope.className), part(scope.sectionName), part(data.subject?.name), formatDate(issuedAt).replaceAll(" ", "-")].filter(Boolean).join("_")}.pdf`;
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "private, no-store",
            "X-Report-Reference": reference,
        }).send(buffer);
    } catch (error) { next(error); }
};

// Public check for a printed report or card: shows what IlmiDunya issued under that reference.
const verifyReport = async (req, res, next) => {
    try {
        const reference = String(req.params.reference || "").trim().toUpperCase();
        if (!/^IDR-\d{6}-[A-Z0-9]{6}(-\d{3})?$/.test(reference)) return res.status(404).json({ success: false, message: "No IlmiDunya document has this reference." });
        const base = reference.slice(0, 17);
        const record = await IssuedReport.findOne({ reference: base }).select("-issuedBy -cards._id").lean();
        const card = reference.length > 17 ? record?.cards?.find(item => item.reference === reference) : null;
        if (!record || (reference.length > 17 && !card)) return res.status(404).json({ success: false, message: "No IlmiDunya document has this reference." });
        const document = {
            reference, kind: card ? "card" : record.kind, issuedAt: record.issuedAt, schoolName: record.schoolName, className: record.className,
            sectionName: record.sectionName, subjectName: record.subjectName, period: record.period,
        };
        if (card) Object.assign(document, { student: card.name, studentClass: card.className, studentSection: card.sectionName, tests: card.tests, attempts: card.attempts, average: card.average, grade: card.grade, position: card.position, outOf: record.studentsAttempted });
        else Object.assign(document, { students: record.students, studentsAttempted: record.studentsAttempted, attempts: record.attempts, average: record.average, passRate: record.passRate, cards: record.cards?.length || 0 });
        res.set("Cache-Control", "no-store").json({ success: true, document });
    } catch (error) { next(error); }
};

module.exports = { getSchoolResults, exportSchoolResults, getResultSubjects, exportSchoolResultsPdf, verifyReport };
