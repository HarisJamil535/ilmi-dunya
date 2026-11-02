const mongoose = require("mongoose");

// A lesson for practical-based assessment (for example HTML or Flowcharts). Its subtopics carry the lecture videos and notes.
const subtopicSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 140 },
    summary: { type: String, trim: true, maxlength: 240, default: "" },
    videoUrl: { type: String, trim: true, maxlength: 500, default: "" },
    notesUrl: { type: String, trim: true, maxlength: 1000, default: "" },
}, { _id: true });

const pbaTopicSchema = new mongoose.Schema({
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    summary: { type: String, trim: true, maxlength: 400, default: "" },
    // The topic itself may also have a video and notes (optional).
    videoUrl: { type: String, trim: true, maxlength: 500, default: "" },
    notesUrl: { type: String, trim: true, maxlength: 1000, default: "" },
    subtopics: { type: [subtopicSchema], default: [] },
    order: { type: Number, default: 0 },
}, { timestamps: true });

pbaTopicSchema.index({ subject: 1, order: 1 });

module.exports = mongoose.model("PbaTopic", pbaTopicSchema);
