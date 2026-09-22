const mongoose = require("mongoose");

const attemptAnswerSchema = new mongoose.Schema(
    {
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
        selectedOption: { type: String, trim: true, default: "" },
        isCorrect: { type: Boolean, default: false },
        marksAwarded: { type: Number, default: 0 },
        timeSpentSeconds: { type: Number, default: 0 },
        skipped: { type: Boolean, default: false },
        flaggedForReview: { type: Boolean, default: false },
        answeredAt: Date,
    },
    { _id: false }
);

const assessmentAttemptSchema = new mongoose.Schema(
    {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
        assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true },
        status: { type: String, enum: ["in_progress", "submitted", "timed_out", "abandoned"], default: "in_progress" },
        startedAt: { type: Date, default: Date.now },
        submittedAt: Date,
        expiresAt: Date,
        timeTakenSeconds: { type: Number, default: 0 },
        answers: [attemptAnswerSchema],
        score: { type: Number, default: 0 },
        totalMarks: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        passStatus: { type: String, enum: ["pending", "pass", "fail"], default: "pending" },
        autoSubmitted: { type: Boolean, default: false },
        passingMarksSnapshot: Number,
        gradingSnapshot: {
            type: [{ question: mongoose.Schema.Types.ObjectId, correctOption: String, marks: Number, _id: false }],
            select: false,
            default: undefined,
        },
    },
    { timestamps: true }
);

assessmentAttemptSchema.index({ student: 1, assessment: 1, status: 1 });
assessmentAttemptSchema.index({ assessment: 1, submittedAt: -1 });
assessmentAttemptSchema.index({ status: 1, score: -1, timeTakenSeconds: 1, submittedAt: -1 });

module.exports = mongoose.model("AssessmentAttempt", assessmentAttemptSchema);
