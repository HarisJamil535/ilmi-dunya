const mongoose = require("mongoose");

const questionScenarioSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 160 },
        scenarioText: { type: String, required: true, trim: true },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
        chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
        topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
        difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
        tags: [{ type: String, trim: true }],
        references: [{ title: String, url: String, type: String }],
        status: { type: String, enum: ["draft", "published", "archived"], default: "published" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },
    { timestamps: true }
);

questionScenarioSchema.index({ subject: 1, chapter: 1, topic: 1 });
questionScenarioSchema.index({ title: "text", scenarioText: "text" });

module.exports = mongoose.model("QuestionScenario", questionScenarioSchema);
