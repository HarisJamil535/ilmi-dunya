const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, select: false },
        tokenVersion: { type: Number, default: 0, select: false },
        phone: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true, maxlength: 80 },
        school: { type: String, required: true, trim: true, maxlength: 160 },
        board: { type: mongoose.Schema.Types.ObjectId, ref: "Board" },
        class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
        group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
        enrolledSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
        status: { type: String, enum: ["active", "blocked"], default: "active" },
        isEmailVerified: { type: Boolean, default: false },
        lastLoginAt: Date,
        passwordResetOtpHash: { type: String, select: false },
        passwordResetExpiresAt: { type: Date, select: false },
        passwordResetAttempts: { type: Number, default: 0, select: false },
    },
    { timestamps: true }
);

studentSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
