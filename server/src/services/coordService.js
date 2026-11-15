const crypto = require("node:crypto");
const { CoordinationFile, CoordinationWeek, CoordinationVersion, CoordinationActivity, CoordinationSetting } = require("../models/Coordination");
const { KEYS, labelOf } = require("./coordTemplate");
const { fromHtml, toHtml, normalise, plainText } = require("./coordRichText");
const { roleIn, capsFor } = require("./coordAccess");
const hub = require("./coordHub");

const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Cells are stored nested ("mon.methods" -> cells.mon.methods).
const getCell = (cells, key) => key.split(".").reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), cells || {}) || [];
const cellPath = (key) => `cells.${key}`;
const flatCells = (cells) => { const out = {}; for (const key of KEYS) out[key] = getCell(cells, key); return out; };
const htmlCells = (cells) => { const out = {}; for (const key of KEYS) out[key] = toHtml(getCell(cells, key)); return out; };
const nestCells = (flat) => { const out = {}; for (const [key, value] of Object.entries(flat)) { const parts = key.split("."); let node = out; while (parts.length > 1) { const p = parts.shift(); node[p] = node[p] || {}; node = node[p]; } node[parts[0]] = value; } return out; };

async function settings() {
    return (await CoordinationSetting.findOne({ key: "main" }).lean()) || (await CoordinationSetting.create({ key: "main" })).toObject();
}

// Loads a week with its file and the caller's role, or fails with 404/403.
async function accessWeek(weekId, admin) {
    const week = await CoordinationWeek.findById(weekId).catch(() => null);
    if (!week) fail("This week was not found.", 404);
    const file = await CoordinationFile.findById(week.file).populate({ path: "subject", select: "name class board group", populate: [{ path: "class", select: "name" }, { path: "board", select: "name" }, { path: "group", select: "name" }] });
    if (!file) fail("This coordination file was not found.", 404);
    const role = roleIn(file, admin);
    if (!role) fail("You do not have access to this coordination file.", 403);
    return { week, file, role, caps: capsFor(role, admin) };
}

async function accessFile(fileId, admin) {
    const file = await CoordinationFile.findById(fileId).populate({ path: "subject", select: "name class board group", populate: [{ path: "class", select: "name" }, { path: "board", select: "name" }, { path: "group", select: "name" }] }).catch(() => null);
    if (!file) fail("This coordination file was not found.", 404);
    const role = roleIn(file, admin);
    if (!role) fail("You do not have access to this coordination file.", 403);
    return { file, role, caps: capsFor(role, admin) };
}

async function logActivity(week, admin, action, cell = "", detail = "") {
    // Typing in one cell for a while shows as one line, not hundreds.
    if (action === "edited") {
        const recent = await CoordinationActivity.findOne({ week: week._id, by: admin._id, action, cell, createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) } });
        if (recent) { recent.createdAt = new Date(); await recent.save(); hub.emit(week._id, "activity", publicActivity(recent)); return; }
    }
    const entry = await CoordinationActivity.create({ week: week._id, by: admin._id, byName: admin.name, action, cell, detail });
    hub.emit(week._id, "activity", publicActivity(entry));
}
const publicActivity = (a) => ({ id: String(a._id), by: String(a.by), byName: a.byName, action: a.action, cell: a.cell, cellLabel: a.cell ? labelOf(a.cell) : "", detail: a.detail, at: a.createdAt });

async function snapshot(week, admin, note) {
    await CoordinationVersion.create({ week: week._id, cells: week.cells || {}, status: week.status, note, by: admin?._id, byName: admin?.name || "" });
}
async function snapshotIfDue(week, admin) {
    const last = await CoordinationVersion.findOne({ week: week._id }).sort({ createdAt: -1 }).select("createdAt").lean();
    if (!last || Date.now() - new Date(last.createdAt).getTime() > SNAPSHOT_EVERY_MS) await snapshot(week, admin, "Autosaved copy");
}

function assertEditable(week, caps) {
    if (!caps.edit) fail("You can view this week but not edit it.", 403);
    if (week.status !== "draft") fail(week.status === "approved" ? "This week is approved and signed. Reopen it to make changes." : "This week has been submitted for approval. Reopen it to make changes.", 409);
}

// Saves one cell. `content` is editor HTML (string) or the stored structure (array).
async function saveCell({ weekId, admin, key, content }) {
    if (!KEYS.has(key)) fail("Unknown cell.");
    const { week, caps } = await accessWeek(weekId, admin);
    assertEditable(week, caps);
    const paragraphs = Array.isArray(content) ? normalise(content) : fromHtml(content);
    if (JSON.stringify(getCell(week.cells, key)) === JSON.stringify(paragraphs)) return { week, paragraphs, changed: false };
    await snapshotIfDue(week, admin);
    const updated = await CoordinationWeek.findOneAndUpdate(
        { _id: week._id, status: "draft" },
        { $set: { [cellPath(key)]: paragraphs, updatedBy: admin._id, lastEditAt: new Date() }, $inc: { rev: 1 } },
        { new: true },
    );
    if (!updated) fail("This week was submitted a moment ago. Reopen it to make changes.", 409);
    await logActivity(updated, admin, "edited", key);
    return { week: updated, paragraphs, changed: true };
}

// Replaces many cells at once (Word import, copying a week, restoring a version).
async function replaceCells(week, admin, flat, note) {
    const clean = {};
    for (const [key, value] of Object.entries(flat || {})) if (KEYS.has(key)) clean[key] = Array.isArray(value) ? normalise(value) : fromHtml(value);
    await snapshot(week, admin, note ? `Before: ${note}` : "Before a bulk change");
    week.cells = nestCells({ ...flatCells(week.cells), ...clean });
    week.markModified("cells");
    week.rev += 1;
    week.updatedBy = admin._id;
    week.lastEditAt = new Date();
    await week.save();
    hub.emit(week._id, "reload", { by: admin.name, note: note || "" });
    await logActivity(week, admin, "replaced", "", note || "");
    return week;
}

const fingerprintOf = (week) => crypto.createHash("sha256").update(JSON.stringify(flatCells(week.cells))).digest("hex");

function signatureOf(admin) {
    if (!admin.signatureUrl) fail("Add your e-signature first (My signature), then sign.", 409);
    return { admin: admin._id, name: admin.name, imageUrl: admin.signatureUrl, at: new Date() };
}

async function changeStatus({ weekId, admin, action }) {
    const { week, caps, file } = await accessWeek(weekId, admin);
    if (action === "submit") {
        if (!caps.signCoordinator) fail("Only the Subject Coordinator of this file can submit and sign.", 403);
        if (week.status !== "draft") fail("This week is already submitted.", 409);
        week.signatures = { ...(week.signatures?.toObject?.() || week.signatures || {}), coordinator: signatureOf(admin) };
        week.status = "submitted";
    } else if (action === "approve") {
        if (!caps.signSectionHead) fail("Only the Section Head of this file can approve and sign.", 403);
        if (week.status !== "submitted") fail("The Subject Coordinator must submit this week before it can be approved.", 409);
        week.signatures = { ...(week.signatures?.toObject?.() || week.signatures || {}), sectionHead: signatureOf(admin) };
        week.status = "approved";
        week.verifyCode = week.verifyCode || crypto.randomBytes(9).toString("base64url");
        week.fingerprint = fingerprintOf(week);
    } else if (action === "reopen") {
        if (!caps.reopen) fail("You cannot reopen this week.", 403);
        if (week.status === "draft") fail("This week is already open for editing.", 409);
        week.signatures = {};
        week.status = "draft";
        week.fingerprint = undefined;
    } else fail("Unknown action.");
    week.markModified("signatures");
    await week.save();
    await snapshot(week, admin, { submit: "Submitted and signed by the Subject Coordinator", approve: "Approved and signed by the Section Head", reopen: "Reopened for changes (signatures removed)" }[action]);
    await logActivity(week, admin, { submit: "submitted", approve: "approved", reopen: "reopened" }[action]);
    hub.emit(week._id, "status", { status: week.status, signatures: publicSignatures(week), by: admin.name });
    return { week, file };
}

const publicSignatures = (week) => {
    const s = week.signatures || {};
    const one = (x) => (x && x.admin ? { name: x.name, imageUrl: x.imageUrl, at: x.at, admin: String(x.admin) } : null);
    return { coordinator: one(s.coordinator), sectionHead: one(s.sectionHead) };
};

module.exports = { fail, getCell, flatCells, htmlCells, nestCells, settings, accessWeek, accessFile, saveCell, replaceCells, changeStatus, snapshot, logActivity, publicActivity, publicSignatures, fingerprintOf, plainText };
