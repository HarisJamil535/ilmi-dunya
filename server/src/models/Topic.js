const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Topic name is required"],
            trim: true,
        },
        topicNumber: {
            type: String,
            match: /^\d+(\.\d+)*$/,
            default: "1",
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
            required: [true, "Subject ID is required"],
        },
        boardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Board",
            required: [true, "Board ID is required"],
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Class",
            required: [true, "Class ID is required"],
        },
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: [true, "Group ID is required"],
        },
    },
    { timestamps: true }
);

topicSchema.index({ chapterId: 1, topicNumber: 1 }, { unique: true });
topicSchema.index({ chapterId: 1, name: 1 }, { unique: true });
topicSchema.index({ boardId: 1, classId: 1, groupId: 1, subjectId: 1, chapterId: 1 });

topicSchema.add(require("./publicationFields"));

module.exports = mongoose.model("Topic", topicSchema);
