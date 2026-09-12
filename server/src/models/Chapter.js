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
            type: String,
            required: [true, "Board name is required"],
            trim: true,
        },
        class: {
            type: String,
            required: [true, "Class name is required"],
            trim: true,
        },
        group: {
            type: String,
            required: [true, "Group name is required"],
            trim: true,
        },
        subject: {
            type: String,
            required: [true, "Subject name is required"],
            trim: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Chapter", chapterSchema);