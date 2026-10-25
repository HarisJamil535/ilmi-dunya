const mongoose = require("mongoose");

// A record of every result PDF IlmiDunya issues, so anyone holding a printed copy can check it is genuine.
const cardSchema = new mongoose.Schema({
    reference: { type: String, required: true },
    name: String,
    className: String,
    sectionName: String,
    tests: Number,
    attempts: Number,
    average: Number,
    grade: String,
    position: Number,
}, { _id: false });

const issuedReportSchema = new mongoose.Schema({
    reference: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["report", "cards"], required: true },
    schoolName: String,
    className: String,
    sectionName: String,
    subjectName: String,
    period: String,
    students: Number,
    studentsAttempted: Number,
    attempts: Number,
    average: Number,
    passRate: Number,
    cards: { type: [cardSchema], default: undefined },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: true });

// Report cards are looked up by their own reference too.
issuedReportSchema.index({ "cards.reference": 1 }, { sparse: true });

module.exports = mongoose.model("IssuedReport", issuedReportSchema);
