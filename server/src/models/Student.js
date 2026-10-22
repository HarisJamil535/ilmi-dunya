const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, default: null, select: false },
        tokenVersion: { type: Number, default: 0, select: false },
        phone: { type: String, required: true, trim: true },
        isPhoneVerified: { type: Boolean, default: false },
        googleSub: { type: String, select: false },
        gender: { type: String, enum: ["female", "male", "other", "prefer_not_to_say"] },
        city: { type: String, required: true, trim: true, maxlength: 80 },
        // Display name: the chosen school, the typed name of another school, or "Private Student".
        school: { type: String, required: true, trim: true, maxlength: 160 },
        // Set only when the student chose a school that an admin manages.
        schoolRef: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
        schoolClass: { type: String, trim: true, maxlength: 40 },
        schoolSection: { type: String, trim: true, maxlength: 30 },
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

studentSchema.index({ phone: 1 });
studentSchema.index({ schoolRef: 1, schoolClass: 1, schoolSection: 1 }, { sparse: true });
studentSchema.index({ googleSub: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Student", studentSchema);
