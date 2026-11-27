const crypto = require("node:crypto");
const { CoordinationFile, CoordinationWeek, CoordinationVersion, CoordinationActivity, CoordinationSetting } = require("../models/Coordination");
const { KEYS, labelOf } = require("./coordTemplate");
const { fromHtml, toHtml, normalise, plainText } = require("./coordRichText");
const { roleIn, capsFor } = require("./coordAccess");
const hub = require("./coordHub");
const { displayName } = require("./coordPeople");
const { attachNames } = require("./coordSubjects");

const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Cells are stored nested ("mon.methods" -> cells.mon.methods).
const getCell = (cells, key) => key.split(".").reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), cells || {}) || [];
// Who wrote last in each box, flat ("mon.methods" -> admin id), for the editor.
const cellAuthors = (cellBy) => { const out = {}; for (const key of KEYS) { const v = key.split(".").reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), cellBy || {}); if (typeof v === "string") out[key] = v; } return out; };
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
    const file = await CoordinationFile.findById(week.file).populate({ path: "subject", select: "name class board group" });
    if (file?.subject) await attachNames([file.subject]);
    if (!file) fail("This coordination file was not found.", 404);
    const role = roleIn(file, admin);
    if (!role) fail("You do not have access to this coordination file.", 403);
    return { week, file, role, caps: capsFor(role, admin) };
}

async function accessFile(fileId, admin) {
    const file = await CoordinationFile.findById(fileId).populate({ path: "subject", select: "name class board group" }).catch(() => null);
    if (file?.subject) await attachNames([file.subject]);
    if (!file) fail("This coordination file was not found.", 404);
    const role = roleIn(file, admin);
    if (!role) fail("You do not have access to this coordination file.", 403);
    return { file, role, caps: capsFor(role, admin) };
}

// Typing in one box for a while shows as one line in the activity feed, not hundreds. The last "edited"
// entry per person and box is remembered here, so each keystroke batch costs one small update.
const recentEdits = new Map();
async function logActivity(week, admin, action, cell = "", detail = "") {
    const memo = `${week._id}:${admin._id}:${cell}`;
    if (action === "edited") {
        const recent = recentEdits.get(memo);
        if (recent && Date.now() - recent.at < 2 * 60 * 1000) {
            recent.at = Date.now();
            await CoordinationActivity.updateOne({ _id: recent.entry._id }, { createdAt: new Date() });
            hub.emit(week._id, "activity", publicActivity({ ...recent.entry, createdAt: new Date() }));
            return;
        }
    }
    const entry = await CoordinationActivity.create({ week: week._id, by: admin._id, byName: displayName(admin), action, cell, detail });
    if (action === "edited") {
        recentEdits.set(memo, { at: Date.now(), entry: entry.toObject() });
        if (recentEdits.size > 5000) recentEdits.delete(recentEdits.keys().next().value);
    }
    hub.emit(week._id, "activity", publicActivity(entry));
}
const publicActivity = (a) => ({ id: String(a._id), by: String(a.by), byName: a.byName, action: a.action, cell: a.cell, cellLabel: a.cell ? labelOf(a.cell) : "", detail: a.detail, at: a.createdAt });

async function snapshot(week, admin, note) {
    lastSnapshot.set(String(week._id), Date.now());
    await CoordinationVersion.create({ week: week._id, cells: week.cells || {}, status: week.status, note, by: admin?._id, byName: displayName(admin) });
}
// When each week was last copied into its history (looked up once, then remembered).
const lastSnapshot = new Map();
async function snapshotIfDue(week, admin) {
    const id = String(week._id);
    if (!lastSnapshot.has(id)) {
        const last = await CoordinationVersion.findOne({ week: week._id }).sort({ createdAt: -1 }).select("createdAt").lean();
        lastSnapshot.set(id, last ? new Date(last.createdAt).getTime() : 0);
    }
    if (Date.now() - lastSnapshot.get(id) > SNAPSHOT_EVERY_MS) {
        lastSnapshot.set(id, Date.now());
        const full = await CoordinationWeek.findById(week._id).lean(); // the caller may hold only part of the week
        await snapshot(full, admin, "Autosaved copy");
    }
}

function assertEditable(week, caps) {
    if (!caps.edit) fail("You can view this week but not edit it.", 403);
    if (week.status !== "draft") fail(week.status === "approved" ? "This week is approved and signed. Reopen it to make changes." : "This week has been submitted for approval. Reopen it to make changes.", 409);
}

// Who may edit which week, remembered for 20 seconds per person so typing does not re-check every time.
// (The save itself still only succeeds while the week is a draft.)
const editAccess = new Map();
async function editCaps(weekId, admin) {
    const memo = `${admin._id}:${weekId}`;
    const hit = editAccess.get(memo);
    if (hit && Date.now() - hit.at < 20000) return hit;
    const { caps, file } = await accessWeek(weekId, admin);
    const entry = { caps, fileId: file._id, at: Date.now() };
    editAccess.set(memo, entry);
    if (editAccess.size > 5000) editAccess.delete(editAccess.keys().next().value);
    return entry;
}

// Saves one cell. `content` is editor HTML (string) or the stored structure (array).
async function saveCell({ weekId, admin, key, content }) {
    if (!KEYS.has(key)) fail("Unknown cell.");
    const { caps } = await editCaps(weekId, admin);
    const week = await CoordinationWeek.findById(weekId).select(`status file rev ${cellPath(key)} cellBy.${key}`).lean();
    if (!week) fail("This week was not found.", 404);
    if (!caps.edit && caps.fillEmpty) {
        // Fill-only: an empty box, or a box this person filled and nobody else has changed since.
        if (week.status !== "draft") assertEditable(week, { edit: true });
        const empty = !plainText(getCell(week.cells, key));
        const mine = String(getCell(week.cellBy, key) || "") === String(admin._id);
        if (!empty && !mine) fail("Someone has already filled this box. You can fill the empty boxes.", 403);
    } else assertEditable(week, caps);
    const paragraphs = Array.isArray(content) ? normalise(content) : fromHtml(content);
    if (JSON.stringify(getCell(week.cells, key)) === JSON.stringify(paragraphs)) return { week, paragraphs, changed: false };
    await snapshotIfDue(week, admin);
    const updated = await CoordinationWeek.findOneAndUpdate(
        { _id: week._id, status: "draft" },
        { $set: { [cellPath(key)]: paragraphs, [`cellBy.${key}`]: String(admin._id), updatedBy: admin._id, lastEditAt: new Date() }, $inc: { rev: 1 } },
        { returnDocument: "after" },
    );
    if (!updated) fail("This week was submitted a moment ago. Reopen it to make changes.", 409);
    await logActivity(updated, admin, "edited", key);
    hub.changed(updated.file);
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
    hub.emit(week._id, "reload", { by: displayName(admin), note: note || "" });
    hub.changed(week.file);
    await logActivity(week, admin, "replaced", "", note || "");
    return week;
}

// The stored signature shown in the signer's ink (blue for members, pink for the Section Head).
const { inkFor } = require("./signatureImage");
const inkUrl = (url, ink, weight) => { const m = /^\/api\/media\/images\/([a-f\d]{24})$/.exec(url || ""); return m ? `/api/media/signatures/${m[1]}/${ink}${weight && weight !== "normal" ? `-${weight}` : ""}.png` : url; };

const fingerprintOf = (week) => crypto.createHash("sha256").update(JSON.stringify(flatCells(week.cells))).digest("hex");

function signatureOf(admin) {
    if (!admin.signatureUrl) fail("Add your e-signature first (My signature), then sign.", 409);
    return { admin: admin._id, name: displayName(admin), imageUrl: admin.signatureUrl, weight: admin.signatureWeight || "normal", at: new Date() };
}

async function changeStatus({ weekId, admin, action }) {
    const { week, caps, file } = await accessWeek(weekId, admin);
    if (action === "submit") {
        if (!caps.signCoordinator) fail("Only the Subject Coordinator of this file can submit and sign.", 403);
        if (week.status !== "draft") fail("This week is already submitted.", 409);
        week.signatures = { ...(week.signatures?.toObject?.() || week.signatures || {}), coordinator: signatureOf(admin) };
        week.status = "submitted";
    } else if (action === "approve") {
        // The Section Head approves (with or without the coordinator's submission). The Principal can also
        // approve, or add their signature to a week that is already approved.
        if (!caps.signSectionHead && !caps.signPrincipal) fail("Only the Section Head or the Principal can approve and sign.", 403);
        const slot = caps.signPrincipal ? "principal" : "sectionHead";
        if (!week.signatures?.coordinator?.admin) fail("The Subject Coordinator must sign this week first.", 409);
        if (week.signatures?.[slot]?.admin) fail("You have already signed this week.", 409);
        if (week.status === "approved" && slot === "sectionHead") fail("This week is already approved.", 409);
        week.signatures = { ...(week.signatures?.toObject?.() || week.signatures || {}), [slot]: signatureOf(admin) };
        week.status = "approved";
        week.verifyCode = week.verifyCode || crypto.randomBytes(9).toString("base64url");
        week.fingerprint = fingerprintOf(week);
    } else if (action === "attend" || action === "unattend") {
        // A department member signs (or removes their signature) beside their name in the attendee list.
        if (!caps.signMember) fail("Only members of this department can sign the attendance.", 403);
        if (week.status === "approved") fail("This week is approved. Reopen it to change signatures.", 409);
        const current = week.signatures?.toObject?.() || week.signatures || {};
        const members = (current.members || []).filter((m) => String(m.admin) !== String(admin._id));
        if (action === "attend") members.push(signatureOf(admin));
        week.signatures = { ...current, members };
    } else if (action === "resign") {
        // Replaces the person's own signature on this week with their current e-signature (for a signature
        // that came out wrong). The week's status and the other signatures stay as they are.
        const mine = ["coordinator", "sectionHead", "principal"].filter((slot) => String(week.signatures?.[slot]?.admin || "") === String(admin._id));
        const current = week.signatures?.toObject?.() || week.signatures || {};
        const memberAt = (current.members || []).findIndex((m) => String(m.admin) === String(admin._id));
        if (!mine.length && memberAt < 0) fail("You have not signed this week yet.", 409);
        const fresh = signatureOf(admin);
        const members = (current.members || []).map((m, i) => (i === memberAt ? { ...fresh, at: m.at || fresh.at } : m));
        week.signatures = { ...current, ...Object.fromEntries(mine.map((slot) => [slot, { ...fresh, at: current[slot]?.at || fresh.at }])), ...(memberAt >= 0 ? { members } : {}) };
    } else if (action === "reopen") {
        if (!caps.reopen) fail("You cannot reopen this week.", 403);
        if (week.status === "draft") fail("This week is already open for editing.", 409);
        week.signatures = {};
        week.status = "draft";
        week.fingerprint = undefined;
    } else fail("Unknown action.");
    week.markModified("signatures");
    await week.save();
    await snapshot(week, admin, { attend: "Signed the attendance", unattend: "Removed their attendance signature", resign: "Signature updated", submit: "Submitted and signed by the Subject Coordinator", approve: caps.signPrincipal ? "Approved and signed by the Principal" : "Approved and signed by the Section Head", reopen: "Reopened for changes (signatures removed)" }[action]);
    await logActivity(week, admin, { submit: "submitted", approve: "approved", reopen: "reopened", resign: "updated their signature", attend: "signed the attendance", unattend: "removed their attendance signature" }[action]);
    hub.emit(week._id, "status", { status: week.status, signatures: publicSignatures(week), by: displayName(admin) });
    return { week, file };
}

const publicSignatures = (week) => {
    const s = week.signatures || {};
    const one = (x, slot) => (x && x.admin ? { name: x.name, imageUrl: inkUrl(x.imageUrl, inkFor(slot), x.weight), at: x.at, admin: String(x.admin), ink: inkFor(slot) } : null);
    return { coordinator: one(s.coordinator, "coordinator"), sectionHead: one(s.sectionHead, "sectionHead"), principal: one(s.principal, "principal"), members: (s.members || []).map((m) => one(m, "member")).filter(Boolean) };
};

module.exports = { cellAuthors, fail, getCell, flatCells, htmlCells, nestCells, settings, accessWeek, accessFile, saveCell, replaceCells, changeStatus, snapshot, logActivity, publicActivity, publicSignatures, fingerprintOf, plainText };
