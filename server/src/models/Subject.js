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
    },
    { timestamps: true }
);

subjectSchema.index({ name: 1, board: 1, class: 1, group: 1 }, { unique: true });

subjectSchema.add(require("./publicationFields"));

module.exports = mongoose.model("Subject", subjectSchema);
