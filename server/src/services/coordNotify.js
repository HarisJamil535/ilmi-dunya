const Admin = require("../models/Admin");
const { CoordinationNotification } = require("../models/Coordination");
const { roleIn } = require("./coordAccess");
const { displayName } = require("./coordPeople");
const hub = require("./coordHub");

// Sends personal notifications (saved, and pushed live to every open tab of each person).
async function notify(adminIds, data) {
    const ids = [...new Set(adminIds.map(String))].filter((id) => id && id !== String(data.from || ""));
    if (!ids.length) return;
    const docs = await CoordinationNotification.insertMany(ids.map((to) => ({ to, kind: data.kind, title: data.title, body: (data.body || "").slice(0, 300), byName: data.byName, week: data.week, cell: data.cell || "", comment: data.comment })));
    for (const doc of docs) hub.emitUser(doc.to, "notification", publicNotification(doc));
}

const publicNotification = (n) => ({ id: String(n._id), kind: n.kind, title: n.title, body: n.body, byName: n.byName, week: n.week ? String(n.week) : "", cell: n.cell || "", comment: n.comment ? String(n.comment) : "", read: n.read, at: n.createdAt });

// Everyone who can open a file (its department's staff, the Section Head and the Principal), for @mentions.
async function peopleFor(file) {
    const staff = await Admin.find({ status: "active", coordTitle: { $in: ["teacher", "coordinator", "sectionHead", "principal"] } }).select("name salutation coordTitle coordDepartment").lean();
    return staff.filter((p) => roleIn(file, p)).map((p) => ({ id: String(p._id), name: displayName(p), title: p.coordTitle }));
}

// Keeps only mentioned people who can open the file. "all" (@all) means everyone in the file's department
// plus the Section Head (not the Principal).
async function validMentions(file, ids) {
    if (!Array.isArray(ids) || !ids.length) return [];
    const people = await peopleFor(file);
    const allowed = new Set(people.map((p) => p.id));
    const wanted = (Array.isArray(ids) ? ids : []).map(String);
    const everyone = wanted.includes("all") ? people.filter((p) => p.title !== "principal").map((p) => p.id) : [];
    return [...new Set([...wanted.filter((id) => allowed.has(id)), ...everyone])].slice(0, 60);
}

module.exports = { notify, publicNotification, peopleFor, validMentions };
