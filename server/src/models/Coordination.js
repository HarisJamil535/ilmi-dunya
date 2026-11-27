const mongoose = require("mongoose");

// A department (Computer Science, Chemistry, ...). Its teachers and its Subject Coordinator are the
// staff whose Admin.coordDepartment points here.
const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 60 },
    order: { type: Number, default: 0 },
}, { timestamps: true });
departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

// One coordination file: a subject (which already belongs to one class, e.g. Computer Science Class 9) for one
// academic session. Its members decide who may see, edit, comment on and sign its weekly records.
const CLASS_LEVELS = ["9", "10"];
const ROLES = ["viewer", "editor", "coordinator", "sectionHead"];
const memberSchema = new mongoose.Schema({
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    role: { type: String, enum: ROLES, default: "editor" },
}, { _id: false });

const fileSchema = new mongoose.Schema({
    // Files are made per department and class (9th or 10th). Older files may point at a site subject instead.
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: undefined },
    classLevel: { type: String, enum: CLASS_LEVELS, default: undefined },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinationDepartment", index: true, default: null },
    session: { type: String, required: true, trim: true, match: /^\d{4}-\d{4}$/ },
    sections: { type: String, default: "", maxlength: 20 },
    showQr: { type: Boolean, default: true },
    members: { type: [memberSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: true });
// One file per department, class and session.
fileSchema.index({ department: 1, classLevel: 1, session: 1 }, { unique: true, partialFilterExpression: { classLevel: { $exists: true } } });

const signatureSchema = new mongoose.Schema({
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    name: String,
    imageUrl: String,
    weight: String,
    at: Date,
}, { _id: false });

// One week of a file: one A4 landscape page.
const weekSchema = new mongoose.Schema({
    file: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinationFile", required: true, index: true },
    week: { type: Number, required: true, min: 1, max: 60 },
    term: { type: String, default: "", maxlength: 30 },
    dueDate: Date,
    status: { type: String, enum: ["draft", "submitted", "approved"], default: "draft" },
    cells: { type: mongoose.Schema.Types.Mixed, default: {} }, // key -> paragraphs (see coordRichText)
    cellBy: { type: mongoose.Schema.Types.Mixed, default: {} }, // key -> id of the person who last wrote in that box
    rev: { type: Number, default: 0 },
    signatures: {
        coordinator: { type: signatureSchema, default: undefined },
        sectionHead: { type: signatureSchema, default: undefined },
        principal: { type: signatureSchema, default: undefined },
        // Attendance: department members (teachers, the coordinator) sign beside their name in the attendee list.
        members: { type: [signatureSchema], default: undefined },
    },
    verifyCode: { type: String, index: true, sparse: true },
    fingerprint: String,
    fontSize: { type: Number, default: 0 },
    font: { type: String, default: "arial" }, // the page's main font (see coordFonts) // the size that fits the page, worked out when the PDF is made
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    lastEditAt: Date,
}, { timestamps: true, minimize: false });
weekSchema.index({ file: 1, week: 1 }, { unique: true });

// A saved copy of a week, for history and restore.
const versionSchema = new mongoose.Schema({
    week: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinationWeek", required: true, index: true },
    cells: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: String,
    note: { type: String, maxlength: 120 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    byName: String,
}, { timestamps: true, minimize: false });

const replySchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    authorName: String,
    text: { type: String, maxlength: 1000 },
    mentions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    at: { type: Date, default: Date.now },
}, { _id: true });
// Comments, questions and change requests, optionally pinned to one cell.
const commentSchema = new mongoose.Schema({
    week: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinationWeek", required: true, index: true },
    cell: { type: String, default: "" },
    kind: { type: String, enum: ["comment", "question", "change"], default: "comment" },
    text: { type: String, required: true, maxlength: 1000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    authorName: String,
    mentions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    resolved: { type: Boolean, default: false },
    resolvedByName: String,
    replies: { type: [replySchema], default: [] },
}, { timestamps: true });

// The live change feed ("Mr. Haris edited Tuesday › Methodologies"); old entries expire after 90 days.
const activitySchema = new mongoose.Schema({
    week: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinationWeek", required: true, index: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    byName: String,
    action: { type: String, maxlength: 40 },
    cell: String,
    detail: { type: String, maxlength: 200 },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

// Site-wide look of the record (watermark, footer), set once by a manager.
const settingSchema = new mongoose.Schema({
    key: { type: String, default: "main", unique: true },
    title: { type: String, default: "WEEKLY SUBJECT COORDINATION MEETING {session} RECORD (CLASS PRE – X)", maxlength: 140 },
    watermarkUrl: { type: String, default: "" },
    watermarkOpacity: { type: Number, default: 0.12, min: 0.03, max: 0.4 },
    footerText: { type: String, default: "Curriculum Implementation Guide for Teachers {session}", maxlength: 140 },
    caption: { type: String, default: "Fig: Weekly Subject Coordination Meeting Record", maxlength: 140 },
    quickPicks: {
        methods: { type: [String], default: ["Brainstorming", "Class Discussion", "Pair Work", "Group Work", "Think Pair Share", "Demonstration", "Board Practice", "Inquiry-Based Learning", "Question Answer Session", "Role Play"] },
        afl: { type: [String], default: ["Pose, Pause, Pounce and Bounce", "Hand Signals", "Exit Ticket", "Think Pair Share", "Thumbs Up / Down", "Quick Quiz", "Traffic Lights", "Mini Whiteboards", "Oral Questioning", "Peer Assessment"] },
        resources: { type: [String], default: ["White Board", "Board Marker", "Textbook", "Multimedia / ICT", "Video", "Worksheet", "Charts", "Computer Lab", "Flash Cards"] },
    },
}, { timestamps: true });

// Notices from the Section Head (or the super admin) to all staff or to Subject Coordinators only.
const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: "", trim: true, maxlength: 2000 },
    important: { type: Boolean, default: false },
    audience: { type: String, enum: ["all", "coordinators"], default: "all" },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    byName: String,
    byTitle: String,
    readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
}, { timestamps: true });
announcementSchema.index({ createdAt: -1 });

// Personal notifications: someone mentioned you, replied to you, or a week you work on changed status.
const notificationSchema = new mongoose.Schema({
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    kind: { type: String, enum: ["mention", "reply", "submitted", "approved", "reopened"], required: true },
    title: { type: String, maxlength: 200 },
    body: { type: String, maxlength: 300 },
    byName: String,
    week: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinationWeek" },
    cell: { type: String, default: "" },
    comment: { type: mongoose.Schema.Types.ObjectId },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 120 },
});
notificationSchema.index({ to: 1, createdAt: -1 });

module.exports = {
    ROLES,
    CoordinationNotification: mongoose.model("CoordinationNotification", notificationSchema),
    CLASS_LEVELS,
    CoordinationAnnouncement: mongoose.model("CoordinationAnnouncement", announcementSchema),
    CoordinationDepartment: mongoose.model("CoordinationDepartment", departmentSchema),
    CoordinationFile: mongoose.model("CoordinationFile", fileSchema),
    CoordinationWeek: mongoose.model("CoordinationWeek", weekSchema),
    CoordinationVersion: mongoose.model("CoordinationVersion", versionSchema),
    CoordinationComment: mongoose.model("CoordinationComment", commentSchema),
    CoordinationActivity: mongoose.model("CoordinationActivity", activitySchema),
    CoordinationSetting: mongoose.model("CoordinationSetting", settingSchema),
};
