const mongoose = require("mongoose");

const answerSheetSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Answer sheet title is required"],
            trim: true,
            maxlength: 140,
        },
        pdfUrl: {
            type: String,
            required: [true, "Answer sheet PDF URL is required"],
            trim: true,
        },
        board: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Board",
            required: [true, "Board ID is required"],
        },
        class: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Class",
            required: [true, "Class ID is required"],
        },
    },
    { timestamps: true }
);

answerSheetSchema.index({ board: 1, class: 1 }, { unique: true });

module.exports = mongoose.model("AnswerSheet", answerSheetSchema);
