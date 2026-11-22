const mongoose = require("mongoose");
const { readSheet } = require("read-excel-file/node");
const writeXlsxFile = require("write-excel-file/node");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const { safeUrl } = require("./publishing");

// Adding many chapters (to a subject) or topics (to a chapter) at once from an Excel file.
// Every upload is checked first and shown as a preview; nothing is saved until the admin confirms.
const MAX_ROWS = 300;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const key = (v) => norm(v).toLowerCase();
const headerKey = (v) => key(v).replace(/[^a-z]/g, "");

// Column headings, matched loosely ("Chapter No.", "chapter number", "ChapterNumber" all work).
const COLUMNS = {
    chapter: {
        number: ["chapternumber", "chapterno", "number", "no", "sr", "srno"],
        name: ["chaptername", "name", "chapter", "title", "chaptertitle"],
    },
    topic: {
        number: ["topicnumber", "topicno", "number", "no", "sr", "srno"],
        name: ["topicname", "name", "topic", "title", "topictitle"],
        description: ["description", "details", "summary", "about"],
        videoUrl: ["youtubelink", "youtubevideolink", "youtubeurl", "videolink", "videourl", "video", "youtube", "link"],
    },
};

const TEMPLATES = {
    chapter: {
        headers: ["Chapter Number", "Chapter Name"],
        widths: [18, 60],
        rows: [[1, "Physical Quantities and Measurement"], [2, "Kinematics"], [3, "Dynamics"]],
        notes: ["Chapter Number: a whole number (1, 2, 3...). Each number can be used once in a subject.", "Chapter Name: required, up to 80 characters."],
    },
    topic: {
        headers: ["Topic Number", "Topic Name", "Description", "YouTube Link"],
        widths: [16, 46, 50, 46],
        rows: [["1.1", "Introduction to Physics", "What physics is and why we study it", "https://www.youtube.com/watch?v=xxxxxxxxxxx"], ["1.2", "Physical Quantities", "Base and derived quantities", ""], ["1.3", "International System of Units", "", ""]],
        notes: ["Topic Number: like 1, 1.2 or 1.2.3. Each number can be used once in a chapter.", "Topic Name: required, up to 120 characters.", "Description and YouTube Link are optional: leave them empty if you do not have them.", "Tip: if Excel changes 1.10 into 1.1, select the Topic Number column, choose Format Cells > Text, and type the numbers again."],
    },
};

async function template(kind) {
    const t = TEMPLATES[kind];
    const head = t.headers.map((value) => ({ value, type: String, fontWeight: "bold", backgroundColor: "#EDE9FE", color: "#3B0764" }));
    const body = t.rows.map((row) => row.map((value) => (value === "" ? null : { value, type: typeof value === "number" ? Number : String })));
    const guide = [[{ value: "How to fill this sheet", type: String, fontWeight: "bold" }], ...t.notes.map((n) => [{ value: n, type: String }]), [{ value: "Replace the example rows with your own, keep the first row (the headings) as it is, then upload the file.", type: String }]];
    return writeXlsxFile([
        { data: [head, ...body], sheet: kind === "chapter" ? "Chapters" : "Topics", columns: t.widths.map((width) => ({ width })), stickyRowsCount: 1 },
        { data: guide, sheet: "Instructions", columns: [{ width: 110 }] },
    ]).toBuffer();
}

// Reads the first sheet into objects using the heading row (which may be below a few blank rows).
async function readRows(buffer, kind) {
    let sheet;
    try { sheet = await readSheet(buffer); } catch { fail("This file could not be read. Upload an Excel file (.xlsx), for example the sample file."); }
    const want = COLUMNS[kind];
    const headerIndex = sheet.findIndex((row) => row.some((cell) => want.name.includes(headerKey(cell))));
    if (headerIndex < 0) fail(`The heading row was not found. The first row should have the headings: ${TEMPLATES[kind].headers.join(", ")}.`);
    const headers = sheet[headerIndex].map(headerKey);
    const columnOf = Object.fromEntries(Object.entries(want).map(([field, names]) => [field, headers.findIndex((h) => names.includes(h))]));
    if (columnOf.name < 0) fail(`The "${TEMPLATES[kind].headers[1]}" column is missing. Use the sample file's headings.`);
    const rows = [];
    sheet.slice(headerIndex + 1).forEach((cells, i) => {
        const pick = (field) => (columnOf[field] >= 0 ? cells[columnOf[field]] : "");
        const row = Object.fromEntries(Object.keys(want).map((field) => [field, pick(field) instanceof Date ? "" : norm(pick(field))]));
        if (Object.values(row).every((v) => !v)) return; // blank line
        rows.push({ line: headerIndex + i + 2, ...row });
    });
    if (!rows.length) fail("The file has no rows below the headings. Add your chapters or topics and upload it again.");
    if (rows.length > MAX_ROWS) fail(`Upload up to ${MAX_ROWS} rows at a time. This file has ${rows.length}.`);
    return rows;
}

// Numbers may come back from Excel as 1 or "1.0", or 1.1 as a float; keep them the way people wrote them.
const chapterNumber = (v) => { const n = Number(v); return Number.isSafeInteger(n) && n >= 1 && n <= 999 ? n : null; };
const topicNumber = (v) => { const s = norm(v).replace(/\.0+$/, ""); return /^\d+(\.\d+)*$/.test(s) && s.length <= 20 ? s : null; };

// Each row comes back with status "new" (will be added), "exists" (already there, skipped) or "error".
async function checkChapters(buffer, context) {
    for (const f of ["board", "class", "group", "subject"]) if (!mongoose.isValidObjectId(context[f])) fail("Select the board, class, group and subject first.");
    if (!(await Subject.exists({ _id: context.subject, board: context.board, class: context.class, group: context.group }))) fail("The subject does not belong to the selected board, class and group.");
    const rows = await readRows(buffer, "chapter");
    const existing = await Chapter.find({ board: context.board, class: context.class, group: context.group, subject: context.subject }).select("name chapterNumber").lean();
    const byNumber = new Map(existing.map((c) => [c.chapterNumber, c])), byName = new Map(existing.map((c) => [key(c.name), c]));
    const seenNumber = new Map(), seenName = new Map();
    let next = Math.max(0, ...existing.map((c) => c.chapterNumber || 0)) + 1;
    return rows.map((r) => {
        const out = { line: r.line, name: r.name, number: r.number, status: "new", message: "" };
        if (!r.name) return { ...out, status: "error", message: "Chapter name is empty." };
        if (r.name.length > 80) return { ...out, status: "error", message: "Chapter name is longer than 80 characters." };
        let n = r.number === "" ? null : chapterNumber(r.number);
        if (r.number !== "" && n === null) return { ...out, status: "error", message: "Chapter number must be a whole number like 1, 2, 3." };
        if (n === null) { while (byNumber.has(next) || seenNumber.has(next)) next++; n = next; out.message = `Numbered ${n} automatically.`; }
        out.number = n;
        const sameName = byName.get(key(r.name));
        if (sameName) return { ...out, status: "exists", message: `Already added as Chapter ${sameName.chapterNumber}. Skipped.` };
        if (byNumber.has(n)) return { ...out, status: "error", message: `Chapter ${n} already exists ("${byNumber.get(n).name}"). Use another number.` };
        if (seenNumber.has(n)) return { ...out, status: "error", message: `Chapter number ${n} is used twice in this file (row ${seenNumber.get(n)}).` };
        if (seenName.has(key(r.name))) return { ...out, status: "error", message: `This chapter is listed twice in this file (row ${seenName.get(key(r.name))}).` };
        seenNumber.set(n, r.line); seenName.set(key(r.name), r.line);
        return out;
    });
}

async function checkTopics(buffer, chapterId) {
    if (!mongoose.isValidObjectId(chapterId)) fail("Select a chapter first.");
    const chapter = await Chapter.findById(chapterId).lean();
    if (!chapter) fail("The selected chapter no longer exists.", 404);
    const rows = await readRows(buffer, "topic");
    const existing = await Topic.find({ chapterId }).select("name topicNumber").lean();
    const byNumber = new Map(existing.map((t) => [String(t.topicNumber), t])), byName = new Map(existing.map((t) => [key(t.name), t]));
    const seenNumber = new Map(), seenName = new Map();
    let auto = existing.length;
    return { chapter, rows: rows.map((r) => {
        const out = { line: r.line, name: r.name, number: r.number, description: r.description || "", videoUrl: r.videoUrl || "", status: "new", message: "" };
        if (!r.name) return { ...out, status: "error", message: "Topic name is empty." };
        if (r.name.length > 120) return { ...out, status: "error", message: "Topic name is longer than 120 characters." };
        if (out.description.length > 2000) return { ...out, status: "error", message: "Description is longer than 2000 characters." };
        if (out.videoUrl && !/^https?:\/\//i.test(out.videoUrl)) out.videoUrl = `https://${out.videoUrl}`;
        if (out.videoUrl && !safeUrl(out.videoUrl)) return { ...out, status: "error", message: "The YouTube link is not a valid web address. Leave it empty if there is no video." };
        let n = r.number === "" ? null : topicNumber(r.number);
        if (r.number !== "" && n === null) return { ...out, status: "error", message: "Topic number must look like 1, 1.2 or 1.2.3." };
        if (n === null) { do { auto++; n = `${chapter.chapterNumber || 1}.${auto}`; } while (byNumber.has(n) || seenNumber.has(n)); out.message = `Numbered ${n} automatically.`; }
        out.number = n;
        const sameName = byName.get(key(r.name));
        if (sameName) return { ...out, status: "exists", message: `Already added as Topic ${sameName.topicNumber}. Skipped.` };
        if (byNumber.has(n)) return { ...out, status: "error", message: `Topic ${n} already exists ("${byNumber.get(n).name}"). Use another number.` };
        if (seenNumber.has(n)) return { ...out, status: "error", message: `Topic number ${n} is used twice in this file (row ${seenNumber.get(n)}).` };
        if (seenName.has(key(r.name))) return { ...out, status: "error", message: `This topic is listed twice in this file (row ${seenName.get(key(r.name))}).` };
        seenNumber.set(n, r.line); seenName.set(key(r.name), r.line);
        return out;
    }) };
}

const summary = (rows) => ({ total: rows.length, add: rows.filter((r) => r.status === "new").length, skipped: rows.filter((r) => r.status === "exists").length, errors: rows.filter((r) => r.status === "error").length });

async function importChapters(buffer, context, { save }) {
    const rows = await checkChapters(buffer, context);
    let added = 0;
    if (save) {
        const toAdd = rows.filter((r) => r.status === "new");
        if (toAdd.length) added = (await Chapter.insertMany(toAdd.map((r) => ({ name: r.name, chapterNumber: r.number, board: context.board, class: context.class, group: context.group, subject: context.subject })), { ordered: false })).length;
    }
    return { rows, summary: summary(rows), added };
}

async function importTopics(buffer, chapterId, { save }) {
    const { chapter, rows } = await checkTopics(buffer, chapterId);
    let added = 0;
    if (save) {
        const toAdd = rows.filter((r) => r.status === "new");
        if (toAdd.length) added = (await Topic.insertMany(toAdd.map((r) => ({ name: r.name, topicNumber: r.number, description: r.description, videoUrl: r.videoUrl, chapterId: chapter._id, subjectId: chapter.subject, boardId: chapter.board, classId: chapter.class, groupId: chapter.group })), { ordered: false })).length;
    }
    return { rows, summary: summary(rows), added };
}

module.exports = { template, readRows, checkChapters, checkTopics, importChapters, importTopics, MAX_ROWS };
