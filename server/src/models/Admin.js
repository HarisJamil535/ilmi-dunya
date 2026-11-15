const mongoose = require('mongoose');

const adminPermissions = [
    "academic",
    "resources",
    "homeContent",
    "assessments",
    "news",
    "analytics",
    "schools",
    "papers",
    "pba",
    "coordination",        // can open the Coordination area and the files they are a member of
    "coordinationManage",  // can create files, choose members and change the record's look
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
        signatureUrl: { type: String, default: "" }, // e-signature picture for coordination records
        // Coordination staff: a teacher or subject coordinator belongs to one department; the Section Head and
        // the Principal see every department.
        salutation: { type: String, enum: ["", "Mr.", "Ms.", "Mrs.", "Miss", "Dr.", "Sir", "Madam"], default: "" }, // shown before the name
        coordTitle: { type: String, enum: ["", "teacher", "coordinator", "sectionHead", "principal"], default: "" },
        coordDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinationDepartment", default: null },
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

adminSchema.statics.permissions = adminPermissions;

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
