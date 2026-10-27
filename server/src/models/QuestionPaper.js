const mongoose = require("mongoose");

// A teacher's saved question paper: the pattern (config) and the questions picked for each section (selection).
// Question text is read from the bank when the paper is printed.
const questionPaperSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    selection: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Fixes the order of shuffled versions, so reprinting gives the same paper.
    seed: { type: String, required: true },
    exports: { type: Number, default: 0 },
}, { timestamps: true });

questionPaperSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model("QuestionPaper", questionPaperSchema);
