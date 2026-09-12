const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Topic name is required"],
            trim: true,
        },
        topicNumber: {
            type: Number,
            default: 1,
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        // YouTube Video Link
        videoUrl: {
            type: String,
            trim: true,
            default: "",
        },
        // Direct Parent Reference
        chapterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chapter",
            required: [true, "Chapter ID is required"],
        },
        // Denormalized Curriculum Context
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
        },
        boardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Board",
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Class",
        },
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Topic", topicSchema);