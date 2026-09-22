const mongoose = require("mongoose");

const chapterNoteSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Note title is required"],
            trim: true,
            maxlength: 140,
        },
        noteType: {
            type: String,
            enum: ["short_questions", "long_questions", "mcqs"],
            required: [true, "Note type is required"],
        },
        pdfUrl: {
            type: String,
            required: [true, "Notes PDF URL is required"],
            trim: true,
        },
        chapter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chapter",
            required: [true, "Chapter ID is required"],
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

chapterNoteSchema.index({ chapter: 1, noteType: 1 }, { unique: true });

chapterNoteSchema.add(require("./publicationFields"));

module.exports = mongoose.model("ChapterNote", chapterNoteSchema);
