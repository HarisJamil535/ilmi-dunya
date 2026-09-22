const mongoose = require("mongoose");

const learningActivitySchema = new mongoose.Schema(
    {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
        type: { type: String, required: true },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
        chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
        topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
        metadata: { type: Object, default: {} },
    },
    { timestamps: true }
);

learningActivitySchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("LearningActivity", learningActivitySchema);
