const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Subject name is required"],
            trim: true,
        },
        code: {
            type: String,
            trim: true,
            default: "",
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
    },
    { timestamps: true }
);

module.exports = mongoose.model("Subject", subjectSchema);