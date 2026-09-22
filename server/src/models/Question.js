const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, trim: true },
        text: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const questionSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ["standard_mcq", "scenario_mcq"], default: "standard_mcq" },
        contentType: { type: String, enum: ["mcq", "long_question", "short_question"], default: "mcq" },
        questionText: { type: String, required: true, trim: true },
        options: {
            type: [optionSchema],
            validate: [function (value) { return ["long_question", "short_question"].includes(this.contentType) || value.length >= 2; }, "At least two options are required"],
        },
        correctOption: { type: String, required: function () { return !["long_question", "short_question"].includes(this.contentType); }, trim: true },
        explanation: { type: String, trim: true, default: "" },
        examYear: { type: Number, min: 1900, max: 2100 },
        examSession: { type: String, enum: ["morning", "evening"] },
        difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
        marks: { type: Number, default: 1, min: 0 },
        negativeMarks: { type: Number, default: 0, min: 0 },
        estimatedTimeSeconds: { type: Number, default: 60, min: 10 },
        board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
        class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
        group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
        chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
        topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
        scenario: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionScenario" },
        tags: [{ type: String, trim: true }],
        references: [{ title: String, url: String, type: String }],
        imageUrls: [{ type: String, trim: true }],
        status: { type: String, enum: ["draft", "published", "archived"], default: "published" },
        usageCount: { type: Number, default: 0 },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },
    { timestamps: true }
);

questionSchema.index({ board: 1, class: 1, group: 1, subject: 1, chapter: 1, topic: 1 });
questionSchema.index({ difficulty: 1, status: 1, type: 1 });
questionSchema.index({ topic: 1, status: 1, contentType: 1, _id: 1 });
questionSchema.index({ questionText: "text", tags: "text" });

module.exports = mongoose.model("Question", questionSchema);
