const mongoose = require("mongoose");

const chapterSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Chapter name is required"],
            trim: true,
        },
        chapterNumber: {
            type: Number,
            default: 1,
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

chapterSchema.index({ subject: 1, chapterNumber: 1 }, { unique: true });
chapterSchema.index({ subject: 1, name: 1 }, { unique: true });
chapterSchema.index({ board: 1, class: 1, group: 1, subject: 1 });

chapterSchema.add(require("./publicationFields"));

module.exports = mongoose.model("Chapter", chapterSchema);
