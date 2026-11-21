const { CoordinationFile, CoordinationWeek, CoordinationComment, CoordinationActivity } = require("../models/Coordination");
const { DAYS, COLUMNS } = require("./coordTemplate");
const { roleIn, capsFor, fileFilter } = require("./coordAccess");
const { plainText } = require("./coordRichText");
const { attachNames, fileTitle } = require("./coordSubjects");
const { CoordinationDepartment } = require("../models/Coordination");

// "Waiting on me": everything a person should do next in Coordination, most urgent first.
//   fill     a draft week they can edit (with which days are still empty, so one tap opens the right box)
//   submit   a draft week the Subject Coordinator can submit and sign
//   approve  a submitted week the Section Head can approve and sign
//   reply    an open comment that mentions them
//   start    a file whose latest week is finished, so the next week can be started from a copy
const filled = (cells, key) => { const [a, b] = key.split("."); const v = b ? cells?.[a]?.[b] : cells?.[a]; return Boolean(plainText(v)); };
const dayProgress = (cells) => DAYS.map(([day, label]) => {
    const done = COLUMNS.filter(([c]) => c !== "period" && filled(cells, `${day}.${c}`)).length;
    return { day, label, done, total: COLUMNS.length - 1 };
});

async function inboxFor(admin) {
    const files = await CoordinationFile.find(fileFilter(admin)).populate({ path: "subject", select: "name class" }).lean();
    if (!files.length) return { tasks: [], counts: {} };
    await attachNames(files.map((f) => f.subject).filter(Boolean));
    const depts = new Map((await CoordinationDepartment.find({}).select("name").lean()).map((d) => [String(d._id), d.name]));
    const fileInfo = new Map(files.map((f) => {
        const caps = capsFor(roleIn(f, admin), admin);
        const t = fileTitle(f, depts.get(String(f.department)) || "");
        return [String(f._id), { caps, role: roleIn(f, admin), label: `${t.subject}${t.className ? ` · ${t.className} class` : ""}`, session: f.session }];
    }));
    const weeks = await CoordinationWeek.find({ file: { $in: files.map((f) => f._id) } }).select("file week status dueDate cells lastEditAt updatedBy").lean();
    const touched = new Set((await CoordinationActivity.distinct("week", { by: admin._id, week: { $in: weeks.map((w) => w._id) } })).map(String));
    const now = Date.now();
    const tasks = [];
    const latest = new Map();
    for (const w of weeks) {
        const info = fileInfo.get(String(w.file)); if (!info) continue;
        const key = String(w.file);
        if (!latest.has(key) || latest.get(key).week < w.week) latest.set(key, w);
        if (w.status === "approved") continue;
        const days = dayProgress(w.cells);
        const done = days.reduce((s, d) => s + d.done, 0), total = days.reduce((s, d) => s + d.total, 0);
        const due = w.dueDate ? new Date(w.dueDate).getTime() : null;
        const base = { weekId: String(w._id), fileId: key, week: w.week, file: info.label, session: info.session, dueDate: w.dueDate || null, overdue: Boolean(due && due < now), percent: Math.round((done / total) * 100), lastEditAt: w.lastEditAt };
        if (w.status === "submitted") {
            if (info.caps.signSectionHead) tasks.push({ ...base, kind: "approve" });
            continue;
        }
        if (info.caps.signCoordinator && done > 0) tasks.push({ ...base, kind: "submit", days });
        else if (info.caps.edit && ["editor", "coordinator"].includes(info.role)) {
            const nextDay = days.find((d) => d.done < d.total);
            tasks.push({ ...base, kind: "fill", days, mine: touched.has(String(w._id)), nextCell: nextDay ? `${nextDay.day}.${COLUMNS.find(([c]) => c !== "period" && !filled(w.cells, `${nextDay.day}.${c}`))[0]}` : "" });
        }
    }
    // Next week to start, for teachers and coordinators of the file.
    for (const f of files) {
        const info = fileInfo.get(String(f._id));
        if (!info.caps.addWeeks || !["editor", "coordinator"].includes(info.role)) continue;
        const last = latest.get(String(f._id));
        if (last && last.status === "draft") continue;
        const n = (last?.week || 0) + 1;
        if (n > 60) continue;
        tasks.push({ kind: "start", fileId: String(f._id), file: info.label, session: info.session, week: n, copyFrom: last ? String(last._id) : "" });
    }
    const comments = await CoordinationComment.find({ week: { $in: weeks.map((w) => w._id) }, resolved: false, $or: [{ mentions: admin._id }, { "replies.mentions": admin._id }], author: { $ne: admin._id } }).sort({ createdAt: -1 }).limit(20).populate("author", "name salutation").lean();
    const weekOf = new Map(weeks.map((w) => [String(w._id), w]));
    for (const c of comments) {
        const lastReply = c.replies?.[c.replies.length - 1];
        if (lastReply && String(lastReply.author) === String(admin._id)) continue; // already answered
        const w = weekOf.get(String(c.week)); const info = fileInfo.get(String(w.file));
        tasks.push({ kind: "reply", weekId: String(w._id), fileId: String(w.file), week: w.week, file: info.label, commentId: String(c._id), cell: c.cell || "", text: String(lastReply?.text || c.text).slice(0, 140), by: [c.author?.salutation, c.author?.name].filter(Boolean).join(" ") || "Someone", at: lastReply?.at || c.createdAt });
    }
    const rank = { approve: 0, submit: 1, reply: 2, fill: 3, start: 4 };
    tasks.sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || rank[a.kind] - rank[b.kind] || (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity) || (a.week || 0) - (b.week || 0));
    const counts = {}; for (const t of tasks) counts[t.kind] = (counts[t.kind] || 0) + 1;
    return { tasks: tasks.slice(0, 40), counts };
}

module.exports = { inboxFor, dayProgress };
