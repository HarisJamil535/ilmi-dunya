const BlockedIdentity = require("../models/BlockedIdentity");
const Student = require("../models/Student");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const LearningActivity = require("../models/LearningActivity");
const StudentAuthChallenge = require("../models/StudentAuthChallenge");
const { normalizePakistaniPhone } = require("./phoneNumbers");

const BLOCKED_CODE = "ACCOUNT_BLOCKED";
const blockedMessage = "You are blocked from using IlmiDunya. Contact support to unblock your account.";

const supportContact = () => ({
    email: (process.env.SUPPORT_EMAIL || "").trim(),
    whatsapp: (process.env.SUPPORT_WHATSAPP || "").trim(),
});

// The response every sign-in, sign-up and session check gives a blocked student, so the site can show one message.
const sendBlocked = (res) => res.status(403).json({ success: false, code: BLOCKED_CODE, message: blockedMessage, support: supportContact() });

const identitiesOf = ({ email, phone }) => {
    const list = [];
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (cleanEmail) list.push({ kind: "email", value: cleanEmail });
    const cleanPhone = normalizePakistaniPhone(phone) || (typeof phone === "string" ? phone.trim() : "");
    if (cleanPhone) list.push({ kind: "phone", value: cleanPhone });
    return list;
};

// True when the email or phone number belongs to a blocked student, including one whose account was deleted.
async function isBlockedIdentity({ email, phone }) {
    const list = identitiesOf({ email, phone });
    if (!list.length) return false;
    return Boolean(await BlockedIdentity.exists({ $or: list }));
}

async function blockStudent(studentId, adminId) {
    const student = await Student.findById(studentId).select("name email phone status");
    if (!student) return null;
    // A new token version signs the student out of every device at once.
    await Student.updateOne({ _id: student._id }, { $set: { status: "blocked" }, $inc: { tokenVersion: 1 } });
    await Promise.all(identitiesOf(student).map(item => BlockedIdentity.updateOne(
        item,
        { $set: { student: student._id, studentName: student.name, accountDeleted: false, blockedBy: adminId } },
        { upsert: true },
    )));
    await StudentAuthChallenge.deleteMany({ $or: [{ student: student._id }, { destination: student.email }] });
    return Student.findById(student._id).lean();
}

async function unblockStudent(studentId) {
    const student = await Student.findByIdAndUpdate(studentId, { $set: { status: "active" } }, { returnDocument: "after" }).lean();
    if (!student) return null;
    await BlockedIdentity.deleteMany({ $or: [{ student: student._id }, ...identitiesOf(student)] });
    return student;
}

// Removes the account and its learning history. A blocked student's email and number stay blocked.
async function deleteStudent(studentId) {
    const student = await Student.findById(studentId).select("name email phone status").lean();
    if (!student) return null;
    const keepBlocked = student.status === "blocked";
    await Promise.all([
        AssessmentAttempt.deleteMany({ student: student._id }),
        LearningActivity.deleteMany({ student: student._id }),
        StudentAuthChallenge.deleteMany({ $or: [{ student: student._id }, { destination: student.email }] }),
    ]);
    if (keepBlocked) await BlockedIdentity.updateMany({ student: student._id }, { $set: { accountDeleted: true } });
    else await BlockedIdentity.deleteMany({ student: student._id });
    await Student.deleteOne({ _id: student._id });
    return { student, keptBlocked: keepBlocked };
}

module.exports = { BLOCKED_CODE, blockedMessage, sendBlocked, supportContact, isBlockedIdentity, blockStudent, unblockStudent, deleteStudent, identitiesOf };
