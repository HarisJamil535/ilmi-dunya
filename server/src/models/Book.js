const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Book title is required"],
            trim: true,
            maxlength: 120,
        },
        pdfUrl: {
            type: String,
            required: [true, "Book PDF URL is required"],
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

bookSchema.index({ board: 1, class: 1, group: 1, subject: 1 }, { unique: true });

bookSchema.add(require("./publicationFields"));

module.exports = mongoose.model("Book", bookSchema);
