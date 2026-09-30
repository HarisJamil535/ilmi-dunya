const mongoose = require("mongoose");

const studentAuthChallengeSchema = new mongoose.Schema({
    purpose: { type: String, enum: ["signup", "login", "password_reset", "google_nonce"], required: true },
    channel: { type: String, enum: ["email", "whatsapp", "google"], required: true },
    destination: { type: String, default: "" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    codeHash: { type: String, default: "", select: false },
    attempts: { type: Number, default: 0 },
    payload: { type: mongoose.Schema.Types.Mixed, select: false },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

studentAuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
studentAuthChallengeSchema.index({ purpose: 1, destination: 1, createdAt: -1 });

module.exports = mongoose.model("StudentAuthChallenge", studentAuthChallengeSchema);
