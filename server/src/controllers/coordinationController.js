const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Subject = require("../models/Subject");
const { ROLES, CoordinationFile, CoordinationWeek, CoordinationVersion, CoordinationComment, CoordinationActivity, CoordinationSetting } = require("../models/Coordination");
const svc = require("../services/coordService");
const { isManager, roleIn, capsFor } = require("../services/coordAccess");
const { buildRecords, classLabel } = require("../services/coordRecord");
const { renderCoordinationPdf, measureFit } = require("../services/coordPdf");
const { renderCoordinationDocx } = require("../services/coordDocx");
const { readCoordinationDocx } = require("../services/coordImport");
const { cleanSignature } = require("../services/signatureImage");
const { storeImage } = require("../services/mediaStore");
const { labelOf, KEYS } = require("../services/coordTemplate");
const hub = require("../services/coordHub");
const { attachNames } = require("../services/coordSubjects");

const { fail } = svc;
const id = (value) => (mongoose.isValidObjectId(value) ? String(value) : fail("Not found.", 404));
const send = (res, error) => res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Something went wrong. Please try again." });
const wrap = (handler) => async (req, res) => { try { await handler(req, res); } catch (error) { if (!error.status) console.error("[coordination]", req.method, req.originalUrl, error); send(res, error); } };
const SESSION = /^\d{4}-\d{4}$/;
const text = (value, max) => String(value ?? "").trim().slice(0, max);

function fileSummary(file, admin, weeks = []) {
    const role = roleIn(file, admin);
    const subject = file.subject || {};
    return {
        id: String(file._id), session: file.session, sections: file.sections, showQr: file.showQr,
        subject: { id: String(subject._id || ""), name: subject.name || "", className: subject.class?.name || "", classLabel: classLabel(subject.class?.name), board: subject.board?.name || "", group: subject.group?.name || "" },
        role, caps: capsFor(role, admin),
        members: (file.members || []).map((m) => ({ admin: String(m.admin?._id || m.admin), name: m.admin?.name || "", email: m.admin?.email || "", role: m.role })),
        counts: { total: weeks.length, draft: weeks.filter((w) => w.status === "draft").length, submitted: weeks.filter((w) => w.status === "submitted").length, approved: weeks.filter((w) => w.status === "approved").length, overdue: weeks.filter((w) => w.status !== "approved" && w.dueDate && new Date(w.dueDate) < new Date()).length },
        updatedAt: file.updatedAt,
    };
}
// Loads files with their subject and members; board, class and group names are added safely (attachNames).
const populateFile = (query) => {
    const run = query.populate({ path: "subject", select: "name class board group" }).populate("members.admin", "name email");
    const exec = run.exec.bind(run);
    run.exec = async (...args) => {
        const result = await exec(...args);
        const files = Array.isArray(result) ? result : [result];
        await attachNames(files.map((f) => f?.subject));
        return result;
    };
    return run;
};

// ----- Files -----
exports.listFiles = wrap(async (req, res) => {
    const filter = isManager(req.admin) ? {} : { "members.admin": req.admin._id };
    const files = await populateFile(CoordinationFile.find(filter).sort({ session: -1, updatedAt: -1 })).lean();
    const weeks = await CoordinationWeek.find({ file: { $in: files.map((f) => f._id) } }).select("file status dueDate").lean();
    const byFile = new Map();
    for (const w of weeks) { const key = String(w.file); if (!byFile.has(key)) byFile.set(key, []); byFile.get(key).push(w); }
    res.json({ success: true, files: files.map((f) => fileSummary(f, req.admin, byFile.get(String(f._id)) || [])), canManage: isManager(req.admin) });
});

exports.createFile = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only coordination managers can create files.", 403);
    const subject = await Subject.findById(id(req.body.subjectId)).select("_id");
    if (!subject) fail("Choose a subject.");
    const session = text(req.body.session, 9);
    if (!SESSION.test(session)) fail("Write the session like 2026-2027.");
    const exists = await CoordinationFile.findOne({ subject: subject._id, session });
    if (exists) fail("A coordination file for this subject and session already exists.", 409);
    const file = await CoordinationFile.create({ subject: subject._id, session, sections: text(req.body.sections, 20), createdBy: req.admin._id, members: [] });
    res.status(201).json({ success: true, file: fileSummary(await populateFile(CoordinationFile.findById(file._id)).lean(), req.admin) });
});

exports.updateFile = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only coordination managers can change files.", 403);
    const file = await CoordinationFile.findById(id(req.params.id));
    if (!file) fail("Not found.", 404);
    if (req.body.sections !== undefined) file.sections = text(req.body.sections, 20);
    if (req.body.showQr !== undefined) file.showQr = Boolean(req.body.showQr);
    if (Array.isArray(req.body.members)) {
        const members = [];
        const seen = new Set();
        for (const m of req.body.members.slice(0, 60)) {
            const adminId = id(m.admin);
            if (seen.has(adminId) || !ROLES.includes(m.role)) continue;
            seen.add(adminId); members.push({ admin: adminId, role: m.role });
        }
        const found = await Admin.countDocuments({ _id: { $in: members.map((m) => m.admin) } });
        if (found !== members.length) fail("One of the chosen people no longer exists.");
        file.members = members;
    }
    await file.save();
    res.json({ success: true, file: fileSummary(await populateFile(CoordinationFile.findById(file._id)).lean(), req.admin) });
});

exports.deleteFile = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only coordination managers can delete files.", 403);
    const file = await CoordinationFile.findById(id(req.params.id));
    if (!file) fail("Not found.", 404);
    const weekIds = (await CoordinationWeek.find({ file: file._id }).select("_id").lean()).map((w) => w._id);
    await Promise.all([CoordinationVersion.deleteMany({ week: { $in: weekIds } }), CoordinationComment.deleteMany({ week: { $in: weekIds } }), CoordinationActivity.deleteMany({ week: { $in: weekIds } }), CoordinationWeek.deleteMany({ file: file._id })]);
    await file.deleteOne();
    res.json({ success: true });
});

// People who can be added to a file: admins with access to the Coordination area.
exports.people = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only coordination managers can choose people.", 403);
    const admins = await Admin.find({ status: "active", $or: [{ role: "super_admin" }, { permissions: { $in: ["coordination", "coordinationManage"] } }] }).select("name email role").sort({ name: 1 }).lean();
    res.json({ success: true, people: admins.map((a) => ({ id: String(a._id), name: a.name, email: a.email, role: a.role })) });
});

exports.subjects = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only coordination managers can create files.", 403);
    // Names are looked up separately (not populated), so an old subject with a missing or malformed
    // board, class or group still lists instead of failing the whole request.
    const Board = mongoose.model("Board"), Class = mongoose.model("Class"), Group = mongoose.model("Group");
    const [subjects, boards, classes, groups] = await Promise.all([
        Subject.find({}).select("name class board group").lean(),
        Board.find({}).select("name").lean(), Class.find({}).select("name").lean(), Group.find({}).select("name").lean(),
    ]);
    const names = (rows) => new Map(rows.map((r) => [String(r._id), r.name || ""]));
    const [b, c, g] = [names(boards), names(classes), names(groups)];
    const list = subjects.filter((s) => s.name).map((s) => ({ id: String(s._id), name: s.name, className: c.get(String(s.class)) || "", board: b.get(String(s.board)) || "", group: g.get(String(s.group)) || "" }));
    list.sort((x, y) => `${x.className} ${x.name}`.localeCompare(`${y.className} ${y.name}`, undefined, { numeric: true }));
    res.json({ success: true, subjects: list });
});

exports.getFile = wrap(async (req, res) => {
    const { file, role, caps } = await svc.accessFile(id(req.params.id), req.admin);
    await file.populate("members.admin", "name email");
    const weeks = await CoordinationWeek.find({ file: file._id }).select("week term dueDate status lastEditAt updatedBy signatures rev").populate("updatedBy", "name").sort({ week: 1 }).lean();
    const openComments = await CoordinationComment.aggregate([{ $match: { week: { $in: weeks.map((w) => w._id) }, resolved: false } }, { $group: { _id: "$week", n: { $sum: 1 } } }]);
    const commentCount = new Map(openComments.map((c) => [String(c._id), c.n]));
    res.json({
        success: true,
        file: { ...fileSummary({ ...file.toObject(), subject: file.subject }, req.admin, weeks), role, caps },
        weeks: weeks.map((w) => ({ id: String(w._id), week: w.week, term: w.term, dueDate: w.dueDate, status: w.status, lastEditAt: w.lastEditAt, lastEditBy: w.updatedBy?.name || "", openComments: commentCount.get(String(w._id)) || 0, signed: { coordinator: Boolean(w.signatures?.coordinator?.admin), sectionHead: Boolean(w.signatures?.sectionHead?.admin) } })),
    });
});

// ----- Weeks -----
exports.createWeek = wrap(async (req, res) => {
    const { file, caps } = await svc.accessFile(id(req.params.id), req.admin);
    if (!caps.edit) fail("You can view this file but not add weeks.", 403);
    const number = Number(req.body.week);
    if (!Number.isInteger(number) || number < 1 || number > 60) fail("Choose a week between 1 and 60.");
    if (await CoordinationWeek.exists({ file: file._id, week: number })) fail(`Week ${number} already exists.`, 409);
    let cells = {};
    // Start from another week (this file's previous week, or the same week in an earlier session).
    if (req.body.copyFrom) {
        const source = await CoordinationWeek.findById(id(req.body.copyFrom)).lean();
        if (!source) fail("The week to copy was not found.", 404);
        const sourceFile = await CoordinationFile.findById(source.file).lean();
        if (!roleIn(sourceFile, req.admin)) fail("You do not have access to the week you chose to copy.", 403);
        const flat = svc.flatCells(source.cells);
        for (const key of ["week", "submitDate", "distributeDate", "coordinatorName", "sectionHeadName"]) delete flat[key];
        cells = svc.nestCells(flat);
    }
    const week = await CoordinationWeek.create({ file: file._id, week: number, term: text(req.body.term, 30), dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined, cells, updatedBy: req.admin._id, lastEditAt: new Date() });
    await svc.logActivity(week, req.admin, "created", "", req.body.copyFrom ? "Started from a copy of another week" : "");
    res.status(201).json({ success: true, id: String(week._id) });
});

// Weeks from other files the person can copy (same subject earlier sessions, and this file).
exports.copySources = wrap(async (req, res) => {
    const { file } = await svc.accessFile(id(req.params.id), req.admin);
    const files = await CoordinationFile.find({ subject: file.subject._id }).lean();
    const allowed = files.filter((f) => roleIn(f, req.admin));
    const weeks = await CoordinationWeek.find({ file: { $in: allowed.map((f) => f._id) } }).select("file week term status").sort({ week: 1 }).lean();
    const session = new Map(allowed.map((f) => [String(f._id), f.session]));
    res.json({ success: true, weeks: weeks.map((w) => ({ id: String(w._id), label: `${session.get(String(w.file))} · Week ${w.week}${w.term ? ` (${w.term})` : ""}`, session: session.get(String(w.file)), week: w.week })) });
});

exports.getWeek = wrap(async (req, res) => {
    const { week, file, role, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    await file.populate("members.admin", "name email");
    const [comments, activity, versions, siblings, settings] = await Promise.all([
        CoordinationComment.find({ week: week._id }).sort({ createdAt: 1 }).lean(),
        CoordinationActivity.find({ week: week._id }).sort({ createdAt: -1 }).limit(60).lean(),
        CoordinationVersion.find({ week: week._id }).select("note status byName createdAt").sort({ createdAt: -1 }).limit(60).lean(),
        CoordinationWeek.find({ file: file._id }).select("week status").sort({ week: 1 }).lean(),
        svc.settings(),
    ]);
    const [record] = await buildRecords(file, [week], settings);
    res.json({
        success: true,
        week: { id: String(week._id), week: week.week, term: week.term, dueDate: week.dueDate, status: week.status, rev: week.rev, cells: svc.htmlCells(week.cells), signatures: svc.publicSignatures(week), verifyCode: week.status === "approved" ? week.verifyCode : "", lastEditAt: week.lastEditAt },
        defaults: { week: `${week.week}${week.term ? ` (${week.term})` : ""}`, className: classLabel(file.subject?.class?.name), sections: file.sections, subject: file.subject?.name || "" },
        file: fileSummary({ ...file.toObject(), subject: file.subject }, req.admin), role, caps,
        me: { id: String(req.admin._id), name: req.admin.name, hasSignature: Boolean(req.admin.signatureUrl), signatureUrl: req.admin.signatureUrl || "" },
        settings: { title: (settings.title || "").replace("{session}", file.session), footerText: (settings.footerText || "").replace("{session}", file.session), caption: settings.caption, watermarkUrl: settings.watermarkUrl, watermarkOpacity: settings.watermarkOpacity, quickPicks: settings.quickPicks },
        fit: measureFit(record),
        comments: comments.map(publicComment),
        activity: activity.map(svc.publicActivity),
        versions: versions.map((v) => ({ id: String(v._id), note: v.note, status: v.status, byName: v.byName, at: v.createdAt })),
        siblings: siblings.map((w) => ({ id: String(w._id), week: w.week, status: w.status })),
    });
});

exports.fit = wrap(async (req, res) => {
    const { week, file } = await svc.accessWeek(id(req.params.id), req.admin);
    const [record] = await buildRecords(file, [week], await svc.settings());
    res.json({ success: true, fit: measureFit(record) });
});

exports.updateWeek = wrap(async (req, res) => {
    const { week, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.edit) fail("You cannot change this week.", 403);
    if (req.body.term !== undefined) week.term = text(req.body.term, 30);
    if (req.body.dueDate !== undefined) week.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : undefined;
    if (req.body.week !== undefined) {
        const number = Number(req.body.week);
        if (!Number.isInteger(number) || number < 1 || number > 60) fail("Choose a week between 1 and 60.");
        if (number !== week.week && await CoordinationWeek.exists({ file: week.file, week: number })) fail(`Week ${number} already exists.`, 409);
        week.week = number;
    }
    await week.save();
    hub.emit(week._id, "meta", { week: week.week, term: week.term, dueDate: week.dueDate });
    res.json({ success: true });
});

exports.deleteWeek = wrap(async (req, res) => {
    const { week, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.deleteWeek) fail("Only the Subject Coordinator or a manager can delete a week.", 403);
    if (week.status === "approved" && !caps.manage) fail("An approved week can only be deleted by a manager.", 403);
    await Promise.all([CoordinationVersion.deleteMany({ week: week._id }), CoordinationComment.deleteMany({ week: week._id }), CoordinationActivity.deleteMany({ week: week._id })]);
    await week.deleteOne();
    hub.emit(week._id, "deleted", { by: req.admin.name });
    res.json({ success: true });
});

// Saves several cells at once (used when the live connection is not available).
exports.saveCells = wrap(async (req, res) => {
    // [{ key: "mon.methods", html }] (a list, because dotted field names are refused by the request filter)
    const cells = Array.isArray(req.body.cells) ? req.body.cells : [];
    let week;
    for (const { key, html } of cells.slice(0, 80)) {
        if (typeof key !== "string") continue;
        const result = await svc.saveCell({ weekId: id(req.params.id), admin: req.admin, key, content: String(html ?? "") });
        week = result.week;
        if (result.changed) hub.emit(week._id, "cell", { cell: key, html: svc.htmlCells(week.cells)[key], rev: week.rev, by: req.admin.name, byId: String(req.admin._id) });
    }
    res.json({ success: true, rev: week?.rev });
});

exports.status = wrap(async (req, res) => {
    const { week } = await svc.changeStatus({ weekId: id(req.params.id), admin: req.admin, action: req.params.action });
    res.json({ success: true, status: week.status, signatures: svc.publicSignatures(week), verifyCode: week.status === "approved" ? week.verifyCode : "" });
});

// ----- Import -----
exports.importIntoWeek = wrap(async (req, res) => {
    const { week, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.edit) fail("You cannot edit this week.", 403);
    if (week.status !== "draft") fail("Reopen this week before importing into it.", 409);
    if (!req.file) fail("Choose a Word (.docx) file.");
    const found = await readCoordinationDocx(req.file.buffer);
    const wanted = Number(req.body.pick);
    const chosen = found.find((w) => w.week === wanted) || found.find((w) => w.week === week.week) || found[0];
    await svc.replaceCells(week, req.admin, chosen.cells, `Imported from ${text(req.file.originalname, 80) || "a Word file"}`);
    res.json({ success: true, imported: Object.keys(chosen.cells).length, foundWeeks: found.map((w) => w.week), notes: chosen.notes });
});

exports.importIntoFile = wrap(async (req, res) => {
    const { file, caps } = await svc.accessFile(id(req.params.id), req.admin);
    if (!caps.edit) fail("You cannot add weeks to this file.", 403);
    if (!req.file) fail("Choose a Word (.docx) file.");
    const found = await readCoordinationDocx(req.file.buffer);
    const replace = req.body.replace === "true";
    const results = [];
    let fallback = Number(req.body.startWeek) || 1;
    for (const item of found) {
        const number = item.week || fallback;
        fallback = number + 1;
        let week = await CoordinationWeek.findOne({ file: file._id, week: number });
        if (week && (!replace || week.status !== "draft")) { results.push({ week: number, result: week.status !== "draft" ? "skipped (already submitted or approved)" : "skipped (already exists)" }); continue; }
        if (!week) week = await CoordinationWeek.create({ file: file._id, week: number, cells: {}, updatedBy: req.admin._id, lastEditAt: new Date() });
        await svc.replaceCells(week, req.admin, item.cells, `Imported from ${text(req.file.originalname, 80) || "a Word file"}`);
        results.push({ week: number, result: "imported", id: String(week._id) });
    }
    res.json({ success: true, results });
});

// ----- Export -----
async function exportWeeks(res, file, weeks, format, name) {
    const settings = await svc.settings();
    const records = await buildRecords(file, weeks, settings);
    const pdf = await renderCoordinationPdf(records, { title: name });
    // Remember the size that fits, so the editor's page preview can match.
    await Promise.all(weeks.map((w, i) => (w.fontSize !== pdf.sizes[i]?.size ? CoordinationWeek.updateOne({ _id: w._id }, { fontSize: pdf.sizes[i]?.size || 0 }) : null)));
    const safe = name.replace(/[^\w.-]+/g, "_").slice(0, 90);
    if (format === "pdf") {
        res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safe}.pdf"`, "Cache-Control": "no-store" }).send(pdf.buffer);
        return;
    }
    const watermark = records[0]?.assets?.watermark || null;
    const docx = await renderCoordinationDocx(records, { sizes: pdf.sizes, watermark, title: name });
    res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safe}.docx"`, "Cache-Control": "no-store" }).send(docx);
}

exports.exportWeek = wrap(async (req, res) => {
    const { week, file } = await svc.accessWeek(id(req.params.id), req.admin);
    const format = req.query.format === "pdf" ? "pdf" : "docx";
    await exportWeeks(res, file, [week], format, `${file.subject?.name || "Subject"} ${classLabel(file.subject?.class?.name)} Week ${week.week} Coordination`);
});

exports.exportFile = wrap(async (req, res) => {
    const { file } = await svc.accessFile(id(req.params.id), req.admin);
    const filter = { file: file._id };
    if (req.query.only === "approved") filter.status = "approved";
    const from = Number(req.query.from), to = Number(req.query.to);
    if (from || to) filter.week = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const weeks = await CoordinationWeek.find(filter).sort({ week: 1 }).limit(60);
    if (!weeks.length) fail("There are no weeks to download yet.", 404);
    const format = req.query.format === "pdf" ? "pdf" : "docx";
    await exportWeeks(res, file, weeks, format, `${file.subject?.name || "Subject"} ${classLabel(file.subject?.class?.name)} Coordination ${file.session}`);
});

// ----- History -----
exports.saveVersion = wrap(async (req, res) => {
    const { week, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.edit) fail("You cannot save versions of this week.", 403);
    await svc.snapshot(week, req.admin, text(req.body.note, 120) || "Saved by hand");
    await svc.logActivity(week, req.admin, "saved a version", "", text(req.body.note, 120));
    res.json({ success: true });
});

exports.getVersion = wrap(async (req, res) => {
    const { week } = await svc.accessWeek(id(req.params.id), req.admin);
    const version = await CoordinationVersion.findOne({ _id: id(req.params.versionId), week: week._id }).lean();
    if (!version) fail("Not found.", 404);
    const before = svc.flatCells(version.cells), now = svc.flatCells(week.cells);
    const changed = Object.keys(now).filter((k) => JSON.stringify(before[k] || []) !== JSON.stringify(now[k] || [])).map((k) => ({ key: k, label: labelOf(k), then: svc.plainText(before[k]), now: svc.plainText(now[k]) }));
    res.json({ success: true, version: { id: String(version._id), note: version.note, byName: version.byName, at: version.createdAt, cells: svc.htmlCells(version.cells) }, changed });
});

exports.restoreVersion = wrap(async (req, res) => {
    const { week, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.edit) fail("You cannot restore this week.", 403);
    if (week.status !== "draft") fail("Reopen this week before restoring an older version.", 409);
    const version = await CoordinationVersion.findOne({ _id: id(req.params.versionId), week: week._id }).lean();
    if (!version) fail("Not found.", 404);
    await svc.replaceCells(week, req.admin, svc.flatCells(version.cells), `Restored the version from ${new Date(version.createdAt).toLocaleString("en-GB")}`);
    res.json({ success: true });
});

// ----- Comments -----
const publicComment = (c) => ({ id: String(c._id), cell: c.cell, cellLabel: c.cell ? labelOf(c.cell) : "", kind: c.kind, text: c.text, author: String(c.author), authorName: c.authorName, resolved: c.resolved, resolvedByName: c.resolvedByName || "", at: c.createdAt, replies: (c.replies || []).map((r) => ({ id: String(r._id), author: String(r.author), authorName: r.authorName, text: r.text, at: r.at })) });

exports.addComment = wrap(async (req, res) => {
    const { week, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.comment) fail("You cannot comment here.", 403);
    const body = text(req.body.text, 1000);
    if (!body) fail("Write a comment first.");
    const comment = await CoordinationComment.create({ week: week._id, cell: KEYS.has(req.body.cell) ? req.body.cell : "", kind: ["question", "change"].includes(req.body.kind) ? req.body.kind : "comment", text: body, author: req.admin._id, authorName: req.admin.name });
    await svc.logActivity(week, req.admin, { question: "asked a question", change: "requested a change", comment: "commented" }[comment.kind], comment.cell, body.slice(0, 120));
    hub.emit(week._id, "comment", publicComment(comment));
    res.status(201).json({ success: true, comment: publicComment(comment) });
});

async function commentFor(req) {
    const comment = await CoordinationComment.findById(id(req.params.commentId));
    if (!comment) fail("Not found.", 404);
    const access = await svc.accessWeek(comment.week, req.admin);
    return { comment, ...access };
}

exports.replyComment = wrap(async (req, res) => {
    const { comment, week, caps } = await commentFor(req);
    if (!caps.comment) fail("You cannot reply here.", 403);
    const body = text(req.body.text, 1000);
    if (!body) fail("Write a reply first.");
    if (comment.replies.length >= 100) fail("This thread is full. Start a new comment.");
    comment.replies.push({ author: req.admin._id, authorName: req.admin.name, text: body });
    await comment.save();
    await svc.logActivity(week, req.admin, "replied", comment.cell, body.slice(0, 120));
    hub.emit(week._id, "comment", publicComment(comment));
    res.json({ success: true, comment: publicComment(comment) });
});

exports.updateComment = wrap(async (req, res) => {
    const { comment, week, caps } = await commentFor(req);
    if (!caps.comment) fail("You cannot change this comment.", 403);
    if (req.body.resolved !== undefined) {
        comment.resolved = Boolean(req.body.resolved);
        comment.resolvedByName = comment.resolved ? req.admin.name : "";
        await svc.logActivity(week, req.admin, comment.resolved ? "resolved a comment" : "reopened a comment", comment.cell);
    }
    await comment.save();
    hub.emit(week._id, "comment", publicComment(comment));
    res.json({ success: true, comment: publicComment(comment) });
});

exports.deleteComment = wrap(async (req, res) => {
    const { comment, week, caps } = await commentFor(req);
    if (String(comment.author) !== String(req.admin._id) && !caps.manage) fail("Only the writer or a manager can delete this comment.", 403);
    await comment.deleteOne();
    hub.emit(week._id, "comment-deleted", { id: String(comment._id) });
    res.json({ success: true });
});

// ----- My signature -----
exports.getSignature = wrap(async (req, res) => { res.json({ success: true, signatureUrl: req.admin.signatureUrl || "" }); });
exports.uploadSignature = wrap(async (req, res) => {
    if (!req.file) fail("Choose or draw your signature.");
    const png = cleanSignature(req.file.buffer);
    const url = await storeImage(png, "signature");
    await Admin.updateOne({ _id: req.admin._id }, { signatureUrl: url });
    res.json({ success: true, signatureUrl: url });
});
exports.removeSignature = wrap(async (req, res) => {
    await Admin.updateOne({ _id: req.admin._id }, { signatureUrl: "" });
    res.json({ success: true });
});

// ----- Settings -----
exports.getSettings = wrap(async (req, res) => { res.json({ success: true, settings: await svc.settings(), canManage: isManager(req.admin) }); });
exports.updateSettings = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only coordination managers can change the record's look.", 403);
    const update = {};
    for (const key of ["title", "footerText", "caption"]) if (req.body[key] !== undefined) update[key] = text(req.body[key], 140);
    if (req.body.watermarkUrl !== undefined) update.watermarkUrl = /^\/api\/media\/images\/[a-f\d]{24}$/.test(req.body.watermarkUrl) || req.body.watermarkUrl === "" ? req.body.watermarkUrl : fail("Upload the watermark picture again.");
    if (req.body.watermarkOpacity !== undefined) update.watermarkOpacity = Math.max(0.03, Math.min(0.4, Number(req.body.watermarkOpacity) || 0.12));
    if (req.body.quickPicks && typeof req.body.quickPicks === "object") {
        for (const group of ["methods", "afl", "resources"]) if (Array.isArray(req.body.quickPicks[group])) update[`quickPicks.${group}`] = [...new Set(req.body.quickPicks[group].map((v) => text(v, 60)).filter(Boolean))].slice(0, 40);
    }
    const settings = await CoordinationSetting.findOneAndUpdate({ key: "main" }, { $set: update }, { new: true, upsert: true });
    res.json({ success: true, settings });
});
exports.uploadWatermark = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only coordination managers can change the watermark.", 403);
    if (!req.file) fail("Choose a picture.");
    const head = req.file.buffer.subarray(0, 4).toString("binary");
    if (!/^\x89PNG/.test(head) && !(req.file.buffer[0] === 0xff && req.file.buffer[1] === 0xd8)) fail("Use a PNG or JPG picture for the watermark (it is printed in Word and PDF).");
    const url = await storeImage(req.file.buffer, "coordination-watermark");
    res.json({ success: true, imageUrl: url });
});

// ----- Public verification (QR code) -----
exports.verify = async (req, res) => {
    try {
        const code = String(req.params.code || "");
        if (!/^[\w-]{6,40}$/.test(code)) return res.status(404).json({ success: false, message: "This record could not be found." });
        const week = await CoordinationWeek.findOne({ verifyCode: code }).lean();
        if (!week) return res.status(404).json({ success: false, message: "This record could not be found." });
        const file = await populateFile(CoordinationFile.findById(week.file)).lean();
        const current = week.status === "approved" && week.fingerprint === svc.fingerprintOf({ cells: week.cells });
        res.set("Cache-Control", "no-store").json({
            success: true,
            record: {
                valid: current,
                status: week.status,
                message: current ? "This coordination record is genuine and has not been changed since it was approved." : "This record was reopened or changed after it was approved. Ask for the latest signed copy.",
                subject: file?.subject?.name || "", className: file?.subject?.class?.name || "", session: file?.session || "", week: week.week, term: week.term || "",
                coordinator: week.signatures?.coordinator ? { name: week.signatures.coordinator.name, at: week.signatures.coordinator.at } : null,
                sectionHead: week.signatures?.sectionHead ? { name: week.signatures.sectionHead.name, at: week.signatures.sectionHead.at } : null,
            },
        });
    } catch { res.status(500).json({ success: false, message: "Please try again." }); }
};
