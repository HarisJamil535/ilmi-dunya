const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Subject = require("../models/Subject");
const { CoordinationNotification, CLASS_LEVELS, CoordinationAnnouncement, CoordinationDepartment, CoordinationFile, CoordinationWeek, CoordinationVersion, CoordinationComment, CoordinationActivity, CoordinationSetting } = require("../models/Coordination");
const svc = require("../services/coordService");
const { isManager, roleIn, capsFor, fileFilter, canCreateFile, seesEverything } = require("../services/coordAccess");
const { hashPassword } = require("../services/passwords");
const { FONTS, fontKey } = require("../services/coordFonts");
const { buildRecords, classLabel, attendeePeople } = require("../services/coordRecord");
const { renderCoordinationPdf, measureFit } = require("../services/coordPdf");
const { renderCoordinationDocx } = require("../services/coordDocx");
const { readCoordinationDocx } = require("../services/coordImport");
const { cleanSignature } = require("../services/signatureImage");
const { storeImage } = require("../services/mediaStore");
const { labelOf, KEYS } = require("../services/coordTemplate");
const hub = require("../services/coordHub");
const { attachNames, fileTitle, departmentNameOf } = require("../services/coordSubjects");

const { fail } = svc;
const id = (value) => (mongoose.isValidObjectId(value) ? String(value) : fail("Not found.", 404));
const send = (res, error) => res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Something went wrong. Please try again." });
const wrap = (handler) => async (req, res) => { try { await handler(req, res); } catch (error) { if (!error.status) console.error("[coordination]", req.method, req.originalUrl, error); send(res, error); } };
const SESSION = /^\d{4}-\d{4}$/;
const text = (value, max) => String(value ?? "").trim().slice(0, max);

const TITLES = { teacher: "Teacher", coordinator: "Subject Coordinator", sectionHead: "Section Head", principal: "Principal" };
const USERNAME = /^[a-z0-9][a-z0-9._@-]{2,59}$/;
const SALUTATIONS = ["", "Mr.", "Ms.", "Mrs.", "Miss", "Dr.", "Sir", "Madam"];
const { displayName } = require("../services/coordPeople");
const { notify, publicNotification, peopleFor, validMentions } = require("../services/coordNotify");

// Coordination staff grouped by department, plus the school-wide Section Head and Principal.
async function staffDirectory() {
    const people = await Admin.find({ coordTitle: { $in: Object.keys(TITLES) } }).select("name salutation email coordTitle coordDepartment status signatureUrl createdAt lastLoginAt").sort({ createdAt: 1 }).lean();
    const byDepartment = new Map();
    const org = { sectionHead: null, principal: null };
    for (const p of people) {
        const person = { id: String(p._id), name: displayName(p), plainName: p.name, salutation: p.salutation || "", username: p.email, title: p.coordTitle, titleLabel: TITLES[p.coordTitle], department: p.coordDepartment ? String(p.coordDepartment) : "", status: p.status, hasSignature: Boolean(p.signatureUrl), lastLoginAt: p.lastLoginAt };
        if (p.coordTitle === "sectionHead" || p.coordTitle === "principal") { org[p.coordTitle] = person; continue; }
        if (!person.department) continue;
        if (!byDepartment.has(person.department)) byDepartment.set(person.department, []);
        byDepartment.get(person.department).push(person);
    }
    // The Subject Coordinator is listed first in each department.
    for (const list of byDepartment.values()) list.sort((a, b) => Number(b.title === "coordinator") - Number(a.title === "coordinator"));
    return { byDepartment, org };
}

function fileSummary(file, admin, weeks = [], directory = null, departments = new Map()) {
    const role = roleIn(file, admin);
    const subject = file.subject || {};
    const departmentId0 = file.department ? String(file.department?._id || file.department) : "";
    const title = fileTitle(file, departments.get(departmentId0) || "");
    const departmentId = file.department ? String(file.department?._id || file.department) : "";
    const members = directory ? (directory.byDepartment.get(departmentId) || []).filter((p) => p.status === "active") : [];
    return {
        id: String(file._id), session: file.session, sections: file.sections, showQr: file.showQr,
        department: { id: departmentId, name: departments.get(departmentId) || file.department?.name || "" },
        classLevel: title.classLevel || "",
        subject: { id: String(subject._id || ""), name: title.subject, className: title.className, classLabel: title.className, board: subject.board?.name || "", group: subject.group?.name || "" },
        role, caps: capsFor(role, admin),
        members: members.map((m) => ({ admin: m.id, name: m.name, role: m.title === "coordinator" ? "coordinator" : "editor", title: m.titleLabel, hasSignature: m.hasSignature })),
        counts: { total: weeks.length, draft: weeks.filter((w) => w.status === "draft").length, submitted: weeks.filter((w) => w.status === "submitted").length, approved: weeks.filter((w) => w.status === "approved").length, overdue: weeks.filter((w) => w.status !== "approved" && w.dueDate && new Date(w.dueDate) < new Date()).length },
        updatedAt: file.updatedAt,
    };
}
// Loads files with their subject; board, class and group names are added safely (attachNames).
const populateFile = (query) => {
    const run = query.populate({ path: "subject", select: "name class board group" });
    const exec = run.exec.bind(run);
    run.exec = async (...args) => {
        const result = await exec(...args);
        const files = Array.isArray(result) ? result : [result];
        await attachNames(files.map((f) => f?.subject));
        return result;
    };
    return run;
};
const departmentNames = async () => new Map((await CoordinationDepartment.find({}).select("name").lean()).map((d) => [String(d._id), d.name]));

// ----- Overview: departments, staff and what the signed-in person is -----
exports.overview = wrap(async (req, res) => {
    const [departments, directory] = await Promise.all([CoordinationDepartment.find({}).sort({ order: 1, name: 1 }).lean(), staffDirectory()]);
    const fileCounts = new Map((await CoordinationFile.aggregate([{ $group: { _id: "$department", n: { $sum: 1 } } }])).map((r) => [String(r._id), r.n]));
    const manager = isManager(req.admin);
    const visible = manager || seesEverything(req.admin) ? departments : departments.filter((d) => String(d._id) === String(req.admin.coordDepartment));
    res.json({
        success: true,
        canManage: manager,
        me: { id: String(req.admin._id), name: displayName(req.admin), title: req.admin.coordTitle || "", titleLabel: TITLES[req.admin.coordTitle] || (manager ? "Manager" : ""), department: req.admin.coordDepartment ? String(req.admin.coordDepartment) : "", hasSignature: Boolean(req.admin.signatureUrl), canCreateFiles: manager || ["sectionHead", "coordinator"].includes(req.admin.coordTitle) },
        departments: visible.map((d) => ({ id: String(d._id), name: d.name, files: fileCounts.get(String(d._id)) || 0, staff: manager || seesEverything(req.admin) || String(d._id) === String(req.admin.coordDepartment) ? directory.byDepartment.get(String(d._id)) || [] : [] })),
        org: directory.org,
        unassigned: manager ? (await CoordinationFile.countDocuments({ department: null })) : 0,
    });
});

// ----- Departments (managers) -----
exports.createDepartment = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only the super admin can add departments.", 403);
    const name = text(req.body.name, 60);
    if (!name) fail("Write the department's name.");
    if (await CoordinationDepartment.findOne({ name }).collation({ locale: "en", strength: 2 })) fail(`The ${name} department already exists.`, 409);
    const count = await CoordinationDepartment.countDocuments();
    const dept = await CoordinationDepartment.create({ name, order: count });
    res.status(201).json({ success: true, department: { id: String(dept._id), name: dept.name } });
});
exports.updateDepartment = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only the super admin can rename departments.", 403);
    const dept = await CoordinationDepartment.findById(id(req.params.id));
    if (!dept) fail("Not found.", 404);
    const name = text(req.body.name, 60);
    if (!name) fail("Write the department's name.");
    const other = await CoordinationDepartment.findOne({ name, _id: { $ne: dept._id } }).collation({ locale: "en", strength: 2 });
    if (other) fail(`The ${name} department already exists.`, 409);
    dept.name = name; await dept.save();
    res.json({ success: true });
});
exports.deleteDepartment = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only the super admin can delete departments.", 403);
    const dept = await CoordinationDepartment.findById(id(req.params.id));
    if (!dept) fail("Not found.", 404);
    const files = await CoordinationFile.countDocuments({ department: dept._id });
    if (files) fail(`This department still has ${files} coordination file${files > 1 ? "s" : ""}. Delete or move them first.`, 409);
    const staff = await Admin.countDocuments({ coordDepartment: dept._id });
    if (staff) fail(`This department still has ${staff} staff member${staff > 1 ? "s" : ""}. Move or remove them first.`, 409);
    await dept.deleteOne();
    res.json({ success: true });
});

// ----- Staff (managers) -----
async function checkTitle(title, departmentId, exceptId) {
    if (!TITLES[title]) fail("Choose what this person is: teacher, subject coordinator, section head or principal.");
    if (["teacher", "coordinator"].includes(title)) {
        if (!departmentId || !(await CoordinationDepartment.exists({ _id: id(departmentId) }))) fail("Choose the person's department.");
    }
    const clash = title === "coordinator" ? { coordTitle: "coordinator", coordDepartment: departmentId }
        : title === "sectionHead" || title === "principal" ? { coordTitle: title } : null;
    if (clash) {
        const holder = await Admin.findOne({ ...clash, _id: { $ne: exceptId } }).select("name salutation").lean();
        if (holder) { const n = displayName(holder); fail(`${n} is already the ${TITLES[title]}${title === "coordinator" ? " of this department" : ""}. Change ${n} to a teacher first, or remove them.`, 409); }
    }
}
exports.createStaff = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only the super admin can add staff.", 403);
    const name = text(req.body.name, 80);
    const username = text(req.body.username, 60).toLowerCase();
    const password = String(req.body.password || "");
    const title = String(req.body.title || "");
    const departmentId = ["teacher", "coordinator"].includes(title) ? String(req.body.departmentId || "") : "";
    if (!name) fail("Write the person's name.");
    if (!USERNAME.test(username)) fail("Choose a username of 3 to 60 letters or numbers (dots, dashes and @ are allowed; no spaces).");
    if (password.length < 8) fail("The password must be at least 8 characters.");
    if (await Admin.exists({ email: username })) fail("This username is already taken. Choose another one.", 409);
    await checkTitle(title, departmentId, null);
    const salutation = SALUTATIONS.includes(req.body.salutation) ? req.body.salutation : "";
    const admin = await Admin.create({ name, salutation, email: username, password: await hashPassword(password), role: "admin", permissions: ["coordination"], status: "active", coordTitle: title, coordDepartment: departmentId || null });
    res.status(201).json({ success: true, id: String(admin._id) });
});
exports.updateStaff = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only the super admin can change staff.", 403);
    const person = await Admin.findById(id(req.params.id)).select("+currentSessionId");
    if (!person || !person.coordTitle) fail("Not found.", 404);
    if (req.body.name !== undefined) { const name = text(req.body.name, 80); if (!name) fail("Write the person's name."); person.name = name; }
    if (req.body.salutation !== undefined && SALUTATIONS.includes(req.body.salutation)) person.salutation = req.body.salutation;
    if (req.body.username !== undefined) {
        const username = text(req.body.username, 60).toLowerCase();
        if (!USERNAME.test(username)) fail("Choose a username of 3 to 60 letters or numbers (no spaces).");
        if (username !== person.email && await Admin.exists({ email: username })) fail("This username is already taken.", 409);
        person.email = username;
    }
    const title = req.body.title !== undefined ? String(req.body.title) : person.coordTitle;
    const departmentId = ["teacher", "coordinator"].includes(title) ? String(req.body.departmentId ?? person.coordDepartment ?? "") : "";
    if (req.body.title !== undefined || req.body.departmentId !== undefined) {
        await checkTitle(title, departmentId, person._id);
        person.coordTitle = title; person.coordDepartment = departmentId || null;
    }
    if (req.body.password) {
        if (String(req.body.password).length < 8) fail("The password must be at least 8 characters.");
        person.password = await hashPassword(String(req.body.password));
        person.currentSessionId = undefined; // signs them out everywhere
    }
    if (req.body.status !== undefined) { person.status = req.body.status === "disabled" ? "disabled" : "active"; if (person.status === "disabled") person.currentSessionId = undefined; }
    if (!person.permissions.includes("coordination")) person.permissions.push("coordination");
    await person.save();
    res.json({ success: true });
});
exports.removeStaff = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only the super admin can remove staff.", 403);
    const person = await Admin.findById(id(req.params.id));
    if (!person || !person.coordTitle) fail("Not found.", 404);
    if (person.role === "super_admin") fail("A super admin cannot be removed here.", 403);
    const other = person.permissions.filter((p) => p !== "coordination");
    // Accounts made only for coordination are deleted; others just lose coordination access.
    if (!other.length) await person.deleteOne();
    else { person.coordTitle = ""; person.coordDepartment = null; person.permissions = other; await person.save(); }
    res.json({ success: true, deleted: !other.length });
});

// ----- Files -----
exports.listFiles = wrap(async (req, res) => {
    const [files, directory, names] = await Promise.all([populateFile(CoordinationFile.find(fileFilter(req.admin)).sort({ session: -1, updatedAt: -1 })).lean(), staffDirectory(), departmentNames()]);
    const weeks = await CoordinationWeek.find({ file: { $in: files.map((f) => f._id) } }).select("file status dueDate").lean();
    const byFile = new Map();
    for (const w of weeks) { const key = String(w.file); if (!byFile.has(key)) byFile.set(key, []); byFile.get(key).push(w); }
    res.json({ success: true, files: files.map((f) => fileSummary(f, req.admin, byFile.get(String(f._id)) || [], directory, names)), canManage: isManager(req.admin) });
});

exports.createFile = wrap(async (req, res) => {
    const departmentId = id(req.body.departmentId);
    if (!(await CoordinationDepartment.exists({ _id: departmentId }))) fail("Choose a department.");
    if (!canCreateFile(req.admin, departmentId)) fail("You can only create files for your own department.", 403);
    const classLevel = String(req.body.classLevel || "");
    if (!CLASS_LEVELS.includes(classLevel)) fail("Choose the class: 9th or 10th.");
    const session = text(req.body.session, 9);
    if (!SESSION.test(session)) fail("Write the session like 2026-2027.");
    if (await CoordinationFile.exists({ department: departmentId, classLevel, session })) fail(`This department already has a ${classLevel}th class file for ${session}.`, 409);
    const file = await CoordinationFile.create({ department: departmentId, classLevel, session, sections: text(req.body.sections, 20), createdBy: req.admin._id });
    res.status(201).json({ success: true, id: String(file._id) });
});

exports.updateFile = wrap(async (req, res) => {
    const file = await CoordinationFile.findById(id(req.params.id));
    if (!file) fail("Not found.", 404);
    const caps = capsFor(roleIn(file, req.admin), req.admin);
    if (!caps.manage && !(caps.signCoordinator || caps.signSectionHead)) fail("Only the Subject Coordinator, the Section Head or the super admin can change this file.", 403);
    if (req.body.sections !== undefined) file.sections = text(req.body.sections, 20);
    if (req.body.showQr !== undefined) file.showQr = Boolean(req.body.showQr);
    if (req.body.departmentId !== undefined) {
        if (!caps.manage) fail("Only the super admin can move a file to another department.", 403);
        const departmentId = id(req.body.departmentId);
        if (!(await CoordinationDepartment.exists({ _id: departmentId }))) fail("Choose a department.");
        file.department = departmentId;
    }
    await file.save();
    res.json({ success: true });
});

exports.deleteFile = wrap(async (req, res) => {
    if (!isManager(req.admin)) fail("Only the super admin can delete files.", 403);
    const file = await CoordinationFile.findById(id(req.params.id));
    if (!file) fail("Not found.", 404);
    const weekIds = (await CoordinationWeek.find({ file: file._id }).select("_id").lean()).map((w) => w._id);
    await Promise.all([CoordinationVersion.deleteMany({ week: { $in: weekIds } }), CoordinationComment.deleteMany({ week: { $in: weekIds } }), CoordinationActivity.deleteMany({ week: { $in: weekIds } }), CoordinationWeek.deleteMany({ file: file._id })]);
    await file.deleteOne();
    res.json({ success: true });
});

exports.subjects = wrap(async (req, res) => {
    if (!isManager(req.admin) && !["sectionHead", "coordinator"].includes(req.admin.coordTitle)) fail("You cannot create files.", 403);
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
    const [directory, names] = await Promise.all([staffDirectory(), departmentNames()]);
    const weeks = await CoordinationWeek.find({ file: file._id }).select("week term dueDate status lastEditAt updatedBy signatures rev").populate("updatedBy", "name").sort({ week: 1 }).lean();
    const openComments = await CoordinationComment.aggregate([{ $match: { week: { $in: weeks.map((w) => w._id) }, resolved: false } }, { $group: { _id: "$week", n: { $sum: 1 } } }]);
    const commentCount = new Map(openComments.map((c) => [String(c._id), c.n]));
    res.json({
        success: true,
        file: { ...fileSummary({ ...file.toObject(), subject: file.subject }, req.admin, weeks, directory, names), role, caps },
        weeks: weeks.map((w) => ({ id: String(w._id), week: w.week, term: w.term, dueDate: w.dueDate, status: w.status, lastEditAt: w.lastEditAt, lastEditBy: w.updatedBy?.name || "", openComments: commentCount.get(String(w._id)) || 0, signed: { coordinator: Boolean(w.signatures?.coordinator?.admin), sectionHead: Boolean(w.signatures?.sectionHead?.admin) } })),
    });
});

// ----- Weeks -----
exports.createWeek = wrap(async (req, res) => {
    const { file, caps } = await svc.accessFile(id(req.params.id), req.admin);
    if (!caps.addWeeks) fail("You can view this file but not add weeks.", 403);
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
    hub.changed(file._id);
    res.status(201).json({ success: true, id: String(week._id) });
});

// Weeks from other files the person can copy (same subject earlier sessions, and this file).
// Deletes several weeks of a file at once: ?weeks=3,4,9 or ?all=1.
exports.deleteWeeks = wrap(async (req, res) => {
    const { file, caps } = await svc.accessFile(id(req.params.id), req.admin);
    if (!caps.deleteWeek) fail("Only the Subject Coordinator, the Section Head or the Principal can delete weeks.", 403);
    const picked = String(req.query.weeks || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
    if (!picked.length && req.query.all !== "1") fail("Choose the weeks to delete.");
    const weeks = await CoordinationWeek.find({ file: file._id, ...(req.query.all === "1" ? {} : { week: { $in: picked } }) }).select("_id week").lean();
    const ids = weeks.map((w) => w._id);
    await Promise.all([CoordinationVersion.deleteMany({ week: { $in: ids } }), CoordinationComment.deleteMany({ week: { $in: ids } }), CoordinationActivity.deleteMany({ week: { $in: ids } }), CoordinationWeek.deleteMany({ _id: { $in: ids } })]);
    for (const w of weeks) hub.emit(w._id, "deleted", { by: displayName(req.admin) });
    hub.changed(file._id);
    res.json({ success: true, deleted: weeks.length });
});

exports.copySources = wrap(async (req, res) => {
    const { file } = await svc.accessFile(id(req.params.id), req.admin);
    // Earlier sessions of the same department and class (or of the same site subject, for older files).
    const files = await CoordinationFile.find(file.classLevel ? { department: file.department, classLevel: file.classLevel } : { subject: file.subject?._id }).lean();
    const allowed = files.filter((f) => roleIn(f, req.admin));
    const weeks = await CoordinationWeek.find({ file: { $in: allowed.map((f) => f._id) } }).select("file week term status").sort({ week: 1 }).lean();
    const session = new Map(allowed.map((f) => [String(f._id), f.session]));
    res.json({ success: true, weeks: weeks.map((w) => ({ id: String(w._id), label: `${session.get(String(w.file))} · Week ${w.week}${w.term ? ` (${w.term})` : ""}`, session: session.get(String(w.file)), week: w.week })) });
});

exports.getWeek = wrap(async (req, res) => {
    const { week, file, role, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    const [directory, names] = await Promise.all([staffDirectory(), departmentNames()]);
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
        attendees: record.attendees,
        attendeePeople: await attendeePeople(file),
        people: await peopleFor(file),
        fonts: Object.entries(FONTS).map(([key, f]) => ({ key, label: f.label })),
        week: { id: String(week._id), font: week.font || "arial", week: week.week, term: week.term, dueDate: week.dueDate, status: week.status, rev: week.rev, cells: svc.htmlCells(week.cells), signatures: svc.publicSignatures(week), verifyCode: week.status === "approved" ? week.verifyCode : "", lastEditAt: week.lastEditAt },
        defaults: { week: `${week.week}${week.term ? ` (${week.term})` : ""}`, className: fileTitle(file, names.get(String(file.department || ""))).className, sections: file.sections, subject: fileTitle(file, names.get(String(file.department || ""))).subject },
        file: fileSummary({ ...file.toObject(), subject: file.subject }, req.admin, [], directory, names), role, caps,
        me: { id: String(req.admin._id), name: displayName(req.admin), hasSignature: Boolean(req.admin.signatureUrl), signatureUrl: req.admin.signatureUrl || "" },
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
    if (req.body.font !== undefined) {
        if (week.status !== "draft") fail("Reopen this week before changing its font.", 409);
        week.font = fontKey(String(req.body.font));
    }
    if (req.body.dueDate !== undefined) week.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : undefined;
    if (req.body.week !== undefined) {
        const number = Number(req.body.week);
        if (!Number.isInteger(number) || number < 1 || number > 60) fail("Choose a week between 1 and 60.");
        if (number !== week.week && await CoordinationWeek.exists({ file: week.file, week: number })) fail(`Week ${number} already exists.`, 409);
        week.week = number;
    }
    await week.save();
    hub.emit(week._id, "meta", { week: week.week, term: week.term, dueDate: week.dueDate, font: week.font, by: req.admin.name });
    res.json({ success: true });
});

exports.deleteWeek = wrap(async (req, res) => {
    const { week, caps } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.deleteWeek) fail("Only the Subject Coordinator, the Section Head or the Principal can delete weeks.", 403);
    await Promise.all([CoordinationVersion.deleteMany({ week: week._id }), CoordinationComment.deleteMany({ week: week._id }), CoordinationActivity.deleteMany({ week: week._id })]);
    await week.deleteOne();
    hub.emit(week._id, "deleted", { by: displayName(req.admin) });
    hub.changed(week.file);
    res.json({ success: true });
});

// Saves several cells at once (used when the live connection is not available).
exports.saveCells = wrap(async (req, res) => {
    // [{ key: "mon.methods", html }] (a list, because dotted field names are refused by the request filter)
    if (!Array.isArray(req.body.cells)) fail("Send the boxes as a list: [{ key, html }].");
    const cells = req.body.cells.filter((c) => c && typeof c.key === "string" && KEYS.has(c.key)); // unknown boxes are skipped
    let week = (await svc.accessWeek(id(req.params.id), req.admin)).week;
    for (const { key, html } of cells.slice(0, 80)) {
        const result = await svc.saveCell({ weekId: id(req.params.id), admin: req.admin, key, content: String(html ?? "") });
        week = result.week;
        if (result.changed) hub.emit(week._id, "cell", { cell: key, html: svc.htmlCells(week.cells)[key], rev: week.rev, by: req.admin.name, byId: String(req.admin._id) });
    }
    res.json({ success: true, rev: week?.rev });
});

// The Section Head (or Principal) cannot approve before the Subject Coordinator has signed. Trying to
// approve such a week asks the coordinator, by @mention on the week, to add their signature.
const reminded = new Map();
async function askCoordinatorToSign(weekId, admin) {
    const { week, file, caps } = await svc.accessWeek(weekId, admin);
    if (!(caps.signSectionHead || caps.signPrincipal) || week.signatures?.coordinator?.admin) return;
    const coordinators = file.department ? await Admin.find({ status: "active", coordTitle: "coordinator", coordDepartment: file.department }).select("name salutation").lean() : [];
    if (!coordinators.length) fail("This week needs the Subject Coordinator's signature first, but this department has no Subject Coordinator yet. Ask the super admin to add one.", 409);
    const names = coordinators.map((p) => displayName(p));
    const key = `${week._id}`;
    if (!reminded.has(key) || Date.now() - reminded.get(key) > 10 * 60 * 1000) {
        reminded.set(key, Date.now());
        const body = `${names.map((n) => `@${n}`).join(" ")} please add your signature on Week ${week.week} (Submit & sign) so it can be approved.`;
        const comment = await CoordinationComment.create({ week: week._id, cell: "", kind: "change", text: body, mentions: coordinators.map((p) => p._id), author: admin._id, authorName: displayName(admin) });
        await svc.logActivity(week, admin, "requested a change", "", body.slice(0, 120));
        hub.emit(week._id, "comment", publicComment(comment));
        hub.changed(file._id);
        await notify(coordinators.map((p) => p._id), { kind: "mention", from: admin._id, byName: displayName(admin), title: `${displayName(admin)}: please add your signature on ${weekLabel(file, week)}`, body, week: week._id, comment: comment._id });
    }
    fail(`${names.join(" and ")} must sign this week first. We've sent ${coordinators.length > 1 ? "them" : "a"} reminder on Week ${week.week}.`, 409);
}

exports.status = wrap(async (req, res) => {
    if (req.params.action === "approve") await askCoordinatorToSign(id(req.params.id), req.admin);
    const { week, file } = await svc.changeStatus({ weekId: id(req.params.id), admin: req.admin, action: req.params.action });
    hub.changed(file._id);
    // Tell the people who act next.
    const who = displayName(req.admin);
    const label = `${fileTitle(file, await departmentNameOf(file)).subject} ${fileTitle(file, "").className} · Week ${week.week}`;
    const staff = await Admin.find({ status: "active", coordTitle: { $in: ["coordinator", "sectionHead", "principal", "teacher"] } }).select("coordTitle coordDepartment").lean();
    const inDept = (p) => String(p.coordDepartment || "") === String(file.department || "");
    if (req.params.action === "submit") await notify(staff.filter((p) => ["sectionHead", "principal"].includes(p.coordTitle)).map((p) => p._id), { kind: "submitted", from: req.admin._id, byName: who, title: `${who} submitted ${label} for approval`, week: week._id });
    if (req.params.action === "approve") await notify(staff.filter((p) => inDept(p) || p.coordTitle === "principal").map((p) => p._id), { kind: "approved", from: req.admin._id, byName: who, title: `${who} approved and signed ${label}`, week: week._id });
    if (req.params.action === "reopen") await notify(staff.filter((p) => inDept(p) && p.coordTitle === "coordinator").map((p) => p._id), { kind: "reopened", from: req.admin._id, byName: who, title: `${who} reopened ${label} for changes`, week: week._id });
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

// One Word file with every week, or many Word files (one per week, or a few weeks each), in one go.
// A week's number comes from the "Week:" line in the file, else from the file name ("week_16.docx"),
// else it follows the previous week. Each file is reported on its own, so one bad file stops nothing.
const weekFromName = (name) => Number(/w(?:ee)?k[\s_.-]*0*(\d{1,2})(?!\d)/i.exec(name || "")?.[1]) || null;
exports.importIntoFile = wrap(async (req, res) => {
    const { file, caps } = await svc.accessFile(id(req.params.id), req.admin);
    if (!caps.edit) fail("You cannot add weeks to this file.", 403);
    const uploads = [...(req.files?.file || []), ...(req.files?.files || [])];
    if (!uploads.length) fail(req.skippedFiles?.length ? "These are not Word (.docx) files. In Word, use Save As > Word Document (.docx)." : "Choose one or more Word (.docx) files.");
    const replace = req.body.replace === "true";
    // Read every file first, then put the weeks in order.
    const items = [];
    const results = (req.skippedFiles || []).map((name) => ({ source: name, result: "Not a Word (.docx) file. Open it in Word and use Save As > Word Document (.docx).", error: true }));
    for (const upload of uploads) {
        const name = text(Buffer.from(upload.originalname, "latin1").toString("utf8"), 80) || "a Word file";
        try {
            const found = await readCoordinationDocx(upload.buffer);
            const fromName = found.length === 1 ? weekFromName(name) : null;
            found.forEach((item, i) => items.push({ ...item, week: item.week || (i === 0 ? fromName : null), source: name, order: items.length }));
        } catch (error) {
            results.push({ source: name, result: error.status ? error.message : "This file could not be read." , error: true });
        }
    }
    items.sort((a, b) => (a.week || Infinity) - (b.week || Infinity) || a.order - b.order);
    let fallback = Number(req.body.startWeek) || 1;
    const used = new Set();
    for (const item of items) {
        const number = item.week || fallback;
        fallback = number + 1;
        if (number < 1 || number > 60) { results.push({ week: number, source: item.source, result: "skipped (week number must be 1 to 60)" }); continue; }
        if (used.has(number)) { results.push({ week: number, source: item.source, result: "skipped (this week is in more than one file)" }); continue; }
        used.add(number);
        let week = await CoordinationWeek.findOne({ file: file._id, week: number });
        if (week && (!replace || week.status !== "draft")) { results.push({ week: number, source: item.source, result: week.status !== "draft" ? "skipped (already submitted or approved)" : "skipped (already exists)" }); continue; }
        if (!week) week = await CoordinationWeek.create({ file: file._id, week: number, cells: {}, updatedBy: req.admin._id, lastEditAt: new Date() });
        await svc.replaceCells(week, req.admin, item.cells, `Imported from ${item.source}`);
        results.push({ week: number, source: item.source, result: "imported", id: String(week._id) });
    }
    hub.changed(file._id);
    results.sort((a, b) => (a.week || 0) - (b.week || 0));
    res.json({ success: true, results, imported: results.filter((r) => r.result === "imported").length });
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
    const t = fileTitle(file, await departmentNameOf(file));
    await exportWeeks(res, file, [week], format, `${t.subject} ${t.className} Week ${week.week} Coordination`);
});

exports.exportFile = wrap(async (req, res) => {
    const { file } = await svc.accessFile(id(req.params.id), req.admin);
    const filter = { file: file._id };
    if (req.query.only === "approved") filter.status = "approved";
    const from = Number(req.query.from), to = Number(req.query.to);
    if (from || to) filter.week = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    // Any chosen weeks: ?weeks=3,4,9
    const picked = String(req.query.weeks || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
    if (picked.length) filter.week = { $in: picked };
    const weeks = await CoordinationWeek.find(filter).sort({ week: 1 }).limit(60);
    if (!weeks.length) fail("There are no weeks to download yet.", 404);
    const format = req.query.format === "pdf" ? "pdf" : "docx";
    const t = fileTitle(file, await departmentNameOf(file));
    const nums = weeks.map((w) => w.week);
    const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    const range = nums.length === 1 ? ` Week ${nums[0]}` : !nums.length ? "" : contiguous ? ` Weeks ${nums[0]}-${nums[nums.length - 1]}` : nums.length <= 6 ? ` Weeks ${nums.join(", ")}` : ` ${nums.length} weeks`;
    await exportWeeks(res, file, weeks, format, `${t.subject} ${t.className} Coordination ${file.session}${range}`);
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
const publicComment = (c) => ({ id: String(c._id), cell: c.cell, cellLabel: c.cell ? labelOf(c.cell) : "", kind: c.kind, text: c.text, mentions: (c.mentions || []).map(String), author: String(c.author), authorName: c.authorName, resolved: c.resolved, resolvedByName: c.resolvedByName || "", at: c.createdAt, replies: (c.replies || []).map((r) => ({ id: String(r._id), author: String(r.author), authorName: r.authorName, text: r.text, mentions: (r.mentions || []).map(String), at: r.at })) });
const weekLabel = (file, week) => `Week ${week.week}`;

exports.addComment = wrap(async (req, res) => {
    const { week, caps, file } = await svc.accessWeek(id(req.params.id), req.admin);
    if (!caps.comment) fail("You cannot comment here.", 403);
    const body = text(req.body.text, 1000);
    if (!body) fail("Write a comment first.");
    const mentions = await validMentions(file, req.body.mentions);
    const comment = await CoordinationComment.create({ week: week._id, cell: KEYS.has(req.body.cell) ? req.body.cell : "", kind: ["question", "change"].includes(req.body.kind) ? req.body.kind : "comment", text: body, mentions, author: req.admin._id, authorName: displayName(req.admin) });
    await svc.logActivity(week, req.admin, { question: "asked a question", change: "requested a change", comment: "commented" }[comment.kind], comment.cell, body.slice(0, 120));
    hub.emit(week._id, "comment", publicComment(comment));
    hub.changed(file._id);
    await notify(mentions, { kind: "mention", from: req.admin._id, byName: displayName(req.admin), title: `${displayName(req.admin)} mentioned you in ${weekLabel(file, week)}${comment.cell ? ` · ${labelOf(comment.cell)}` : ""}`, body, week: week._id, cell: comment.cell, comment: comment._id });
    res.status(201).json({ success: true, comment: publicComment(comment) });
});

async function commentFor(req) {
    const comment = await CoordinationComment.findById(id(req.params.commentId));
    if (!comment) fail("Not found.", 404);
    const access = await svc.accessWeek(comment.week, req.admin);
    return { comment, ...access };
}

exports.replyComment = wrap(async (req, res) => {
    const { comment, week, caps, file } = await commentFor(req);
    if (!caps.comment) fail("You cannot reply here.", 403);
    const body = text(req.body.text, 1000);
    if (!body) fail("Write a reply first.");
    if (comment.replies.length >= 100) fail("This thread is full. Start a new comment.");
    const mentions = await validMentions(file, req.body.mentions);
    comment.replies.push({ author: req.admin._id, authorName: displayName(req.admin), text: body, mentions });
    await comment.save();
    await svc.logActivity(week, req.admin, "replied", comment.cell, body.slice(0, 120));
    hub.emit(week._id, "comment", publicComment(comment));
    hub.changed(file._id);
    const who = displayName(req.admin);
    const where = `${weekLabel(file, week)}${comment.cell ? ` · ${labelOf(comment.cell)}` : ""}`;
    await notify(mentions, { kind: "mention", from: req.admin._id, byName: who, title: `${who} mentioned you in ${where}`, body, week: week._id, cell: comment.cell, comment: comment._id });
    // Everyone already in the conversation hears about the reply (unless they were just mentioned).
    const thread = [comment.author, ...comment.replies.map((r) => r.author)].map(String).filter((x) => !mentions.includes(x));
    await notify(thread, { kind: "reply", from: req.admin._id, byName: who, title: `${who} replied in ${where}`, body, week: week._id, cell: comment.cell, comment: comment._id });
    res.json({ success: true, comment: publicComment(comment) });
});

exports.updateComment = wrap(async (req, res) => {
    const { comment, week, caps } = await commentFor(req);
    if (!caps.comment) fail("You cannot change this comment.", 403);
    if (req.body.resolved !== undefined) {
        comment.resolved = Boolean(req.body.resolved);
        comment.resolvedByName = comment.resolved ? displayName(req.admin) : "";
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
exports.getSignature = wrap(async (req, res) => { res.json({ success: true, signatureUrl: req.admin.signatureUrl || "", weight: req.admin.signatureWeight || "normal" }); });
// Thickness of one's signature, used for every signature they make from now on.
exports.signatureWeight = wrap(async (req, res) => {
    const weight = String(req.body.weight || "");
    if (!["thin", "normal", "bold", "heavy"].includes(weight)) fail("Choose a line thickness.");
    await Admin.updateOne({ _id: req.admin._id }, { signatureWeight: weight });
    res.json({ success: true, weight });
});
exports.uploadSignature = wrap(async (req, res) => {
    if (!req.file) fail("Choose or draw your signature.");
    const png = cleanSignature(req.file.buffer);
    const url = await storeImage(png, "signature");
    // A new picture already has the thickness it was drawn with.
    await Admin.updateOne({ _id: req.admin._id }, { signatureUrl: url, signatureWeight: "normal" });
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
    const settings = await CoordinationSetting.findOneAndUpdate({ key: "main" }, { $set: update }, { returnDocument: "after", upsert: true });
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
                subject: fileTitle(file, await departmentNameOf(file)).subject, className: fileTitle(file, "").className, session: file?.session || "", week: week.week, term: week.term || "",
                coordinator: week.signatures?.coordinator ? { name: week.signatures.coordinator.name, at: week.signatures.coordinator.at } : null,
                sectionHead: week.signatures?.sectionHead ? { name: week.signatures.sectionHead.name, at: week.signatures.sectionHead.at } : null,
                principal: week.signatures?.principal ? { name: week.signatures.principal.name, at: week.signatures.principal.at } : null,
            },
        });
    } catch { res.status(500).json({ success: false, message: "Please try again." }); }
};

// ----- Announcements (Section Head or super admin → all staff, or Subject Coordinators only) -----
const canAnnounce = (admin) => isManager(admin) || ["sectionHead", "principal"].includes(admin?.coordTitle);
const canSeeReaders = (admin) => isManager(admin) || ["sectionHead", "principal"].includes(admin?.coordTitle);
const announcementAudience = (admin) => (canAnnounce(admin) || ["coordinator", "principal"].includes(admin?.coordTitle) ? ["all", "coordinators"] : ["all"]);
const publicAnnouncement = (a, admin) => ({ id: String(a._id), title: a.title, body: a.body, important: a.important, audience: a.audience, byName: a.byName, byTitle: a.byTitle, at: a.createdAt, read: (a.readBy || []).some((r) => String(r) === String(admin._id)), readCount: (a.readBy || []).length, mine: String(a.by) === String(admin._id) });

exports.listAnnouncements = wrap(async (req, res) => {
    const items = await CoordinationAnnouncement.find({ audience: { $in: announcementAudience(req.admin) } }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, canAnnounce: canAnnounce(req.admin), canSeeReaders: canSeeReaders(req.admin), announcements: items.map((a) => publicAnnouncement(a, req.admin)) });
});
exports.createAnnouncement = wrap(async (req, res) => {
    if (!canAnnounce(req.admin)) fail("Only the Section Head or the Principal can send announcements.", 403);
    const title = text(req.body.title, 120);
    if (!title) fail("Write a short title for the announcement.");
    const audience = req.body.audience === "coordinators" ? "coordinators" : "all";
    const item = await CoordinationAnnouncement.create({ title, body: text(req.body.body, 2000), important: Boolean(req.body.important), audience, by: req.admin._id, byName: displayName(req.admin), byTitle: TITLES[req.admin.coordTitle] || "Admin", readBy: [req.admin._id] });
    hub.emitRoom(`ann:${audience}`, "announcement", { id: String(item._id), title: item.title, important: item.important, audience, byName: item.byName });
    res.status(201).json({ success: true, announcement: publicAnnouncement(item.toObject(), req.admin) });
});
// Who has read an announcement and who has not yet, by name (Section Head, Principal, super admin, sender).
exports.announcementReaders = wrap(async (req, res) => {
    const item = await CoordinationAnnouncement.findById(id(req.params.id)).lean();
    if (!item) fail("Not found.", 404);
    if (!canSeeReaders(req.admin) && String(item.by) !== String(req.admin._id)) fail("You cannot see who read this.", 403);
    const titles = item.audience === "coordinators" ? ["coordinator", "sectionHead", "principal"] : Object.keys(TITLES);
    const recipients = await Admin.find({ coordTitle: { $in: titles }, status: "active", _id: { $ne: item.by } }).select("name salutation coordTitle coordDepartment").lean();
    const departments = await departmentNames();
    const read = new Set((item.readBy || []).map(String));
    const person = (p) => ({ id: String(p._id), name: displayName(p), title: p.coordTitle, department: departments.get(String(p.coordDepartment || "")) || "" });
    const sort = (a, b) => a.name.localeCompare(b.name);
    res.json({ success: true, read: recipients.filter((p) => read.has(String(p._id))).map(person).sort(sort), unread: recipients.filter((p) => !read.has(String(p._id))).map(person).sort(sort) });
});

exports.readAnnouncement = wrap(async (req, res) => {
    const item = await CoordinationAnnouncement.findOne({ _id: id(req.params.id), audience: { $in: announcementAudience(req.admin) } });
    if (!item) fail("Not found.", 404);
    await CoordinationAnnouncement.updateOne({ _id: item._id }, { $addToSet: { readBy: req.admin._id } });
    res.json({ success: true });
});
exports.deleteAnnouncement = wrap(async (req, res) => {
    const item = await CoordinationAnnouncement.findById(id(req.params.id));
    if (!item) fail("Not found.", 404);
    if (String(item.by) !== String(req.admin._id) && !isManager(req.admin)) fail("Only the sender can delete this announcement.", 403);
    await item.deleteOne();
    hub.emitRoom(`ann:${item.audience}`, "announcement-deleted", { id: String(item._id) });
    res.json({ success: true });
});

// ----- Personal notifications -----
exports.listNotifications = wrap(async (req, res) => {
    const items = await CoordinationNotification.find({ to: req.admin._id }).sort({ createdAt: -1 }).limit(60).lean();
    res.json({ success: true, notifications: items.map(publicNotification), unread: items.filter((n) => !n.read).length });
});
exports.readNotification = wrap(async (req, res) => {
    await CoordinationNotification.updateOne({ _id: id(req.params.id), to: req.admin._id }, { read: true });
    res.json({ success: true });
});
exports.readAllNotifications = wrap(async (req, res) => {
    await CoordinationNotification.updateMany({ to: req.admin._id, read: false }, { read: true });
    res.json({ success: true });
});

// ----- "Waiting on me" -----
const { inboxFor } = require("../services/coordInbox");
exports.inbox = wrap(async (req, res) => { res.json({ success: true, ...(await inboxFor(req.admin)) }); });
