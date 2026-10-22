const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 30 },
});

const classSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 40 },
    sections: [sectionSchema],
});

const normalizeName = value => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

// Schools are managed by admins; students choose from this list when they register.
const schoolSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        // Lower-cased name, so "APS Boys" and "aps  boys" cannot both exist.
        nameKey: { type: String, required: true, unique: true },
        isActive: { type: Boolean, default: true },
        classes: [classSchema],
    },
    { timestamps: true }
);

schoolSchema.pre("validate", function setNameKey() {
    this.name = String(this.name || "").replace(/\s+/g, " ").trim();
    this.nameKey = normalizeName(this.name);
});

schoolSchema.statics.normalizeName = normalizeName;

module.exports = mongoose.model("School", schoolSchema);
