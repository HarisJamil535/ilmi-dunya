const mongoose = require("mongoose");

// An email address or phone number that may not sign in or sign up, kept even after its account is deleted.
const blockedIdentitySchema = new mongoose.Schema(
    {
        kind: { type: String, enum: ["email", "phone"], required: true },
        value: { type: String, required: true, trim: true },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
        studentName: { type: String, trim: true, maxlength: 80, default: "" },
        accountDeleted: { type: Boolean, default: false },
        blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },
    { timestamps: true }
);

blockedIdentitySchema.index({ kind: 1, value: 1 }, { unique: true });
blockedIdentitySchema.index({ student: 1 });

module.exports = mongoose.model("BlockedIdentity", blockedIdentitySchema);
