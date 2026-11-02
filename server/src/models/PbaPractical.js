const mongoose = require("mongoose");

// An exam-style practical task. It can belong to a topic (HTML, CSS...) and a category (Error correction, Concept map...).
const pbaPracticalSchema = new mongoose.Schema({
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: "PbaTopic", default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "PbaCategory", default: null },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // Short free text shown as a badge, for example "Section A - Q2 - 6 marks" or an SLO code.
    label: { type: String, trim: true, maxlength: 80, default: "" },
    summary: { type: String, trim: true, maxlength: 400, default: "" },
    // The question itself: formatted blocks (text, code, images, tables, labelling pictures) and its parts with marks.
    blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    parts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    marks: { type: Number, default: 0 },
    // Lets students open the model answer on the page; off until the admin decides.
    answerVisible: { type: Boolean, default: false },
    videoUrl: { type: String, trim: true, maxlength: 500, default: "" },
    notesUrl: { type: String, trim: true, maxlength: 1000, default: "" },
    order: { type: Number, default: 0 },
}, { timestamps: true });

pbaPracticalSchema.index({ subject: 1, order: 1 });

module.exports = mongoose.model("PbaPractical", pbaPracticalSchema);
