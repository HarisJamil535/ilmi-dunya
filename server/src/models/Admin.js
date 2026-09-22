const mongoose = require('mongoose');

const adminPermissions = [
    "academic",
    "resources",
    "homeContent",
    "assessments",
    "news",
    "analytics",
];

const adminSchema = new mongoose.Schema(

    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
            select: false,
        },

        role: {
            type: String,
            enum: ["super_admin", "admin"],
            default: "admin",
        },
        permissions: {
            type: [String],
            enum: adminPermissions,
            default: [],
        },
        status: {
            type: String,
            enum: ["active", "disabled"],
            default: "active",
        },
        currentSessionId: { type: String, select: false },
        lastLoginAt: Date,
        passwordResetOtpHash: { type: String, select: false },
        passwordResetExpiresAt: { type: Date, select: false },
        passwordResetAttempts: { type: Number, default: 0, select: false },
    },
    {
        timestamps: true,
    }

);

adminSchema.index({ email: 1 }, { unique: true });

adminSchema.statics.permissions = adminPermissions;

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
