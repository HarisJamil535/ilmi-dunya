const mongoose = require("mongoose");

const pastPaperSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Past paper title is required"],
            trim: true,
            maxlength: 140,
        },
        year: {
            type: Number,
            required: [true, "Past paper year is required"],
            min: 1990,
            max: 2100,
        },
        session: {
            type: String,
            enum: ["morning", "evening"],
            required: [true, "Past paper session is required"],
        },
        pdfUrl: {
            type: String,
            required: [true, "Past paper PDF URL is required"],
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
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: [true, "Group ID is required"],
        },
        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: [true, "Subject ID is required"],
        },
    },
    { timestamps: true }
);

pastPaperSchema.index({ board: 1, class: 1, group: 1, subject: 1, year: -1, session: 1 });

pastPaperSchema.add(require("./publicationFields"));

module.exports = mongoose.model("PastPaper", pastPaperSchema);
