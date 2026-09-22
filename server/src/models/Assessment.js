const mongoose = require("mongoose");

const assessmentQuestionSchema = new mongoose.Schema(
    {
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
        marks: { type: Number, default: 1 },
        order: { type: Number, default: 0 },
        required: { type: Boolean, default: true },
    },
    { _id: false }
);

const assessmentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 180 },
        description: { type: String, trim: true, default: "" },
        type: {
            type: String,
            enum: [
                "topic_test",
                "chapter_test",
                "subject_test",
                "full_syllabus_test",
                "mock_test",
                "previous_paper_practice",
                "custom_practice",
            ],
            required: true,
        },
        board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
        class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
        group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
        chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
        topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
        questions: [assessmentQuestionSchema],
        selectionMode: { type: String, enum: ["manual", "random", "mixed"], default: "manual" },
        randomConfig: {
            totalQuestions: Number,
            easy: Number,
            medium: Number,
            hard: Number,
        },
        durationMinutes: { type: Number, default: 30, min: 1 },
        totalMarks: { type: Number, default: 0 },
        passingMarks: { type: Number, default: 0 },
        instructions: [{ type: String, trim: true }],
        shuffleQuestions: { type: Boolean, default: false },
        shuffleOptions: { type: Boolean, default: false },
        allowResume: { type: Boolean, default: true },
        showResultImmediately: { type: Boolean, default: true },
        showCorrectAnswers: { type: Boolean, default: true },
        maxAttempts: { type: Number, default: 0 },
        startsAt: Date,
        endsAt: Date,
        status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },
    { timestamps: true }
);

assessmentSchema.index({ status: 1, type: 1, subject: 1, chapter: 1, topic: 1 });
assessmentSchema.index({ board: 1, class: 1, group: 1, subject: 1 });

assessmentSchema.add(require("./publicationFields"));

module.exports = mongoose.model("Assessment", assessmentSchema);
