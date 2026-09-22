const mongoose = require("mongoose");

const homeStatSchema = new mongoose.Schema(
    {
        label: { type: String, required: true, trim: true, maxlength: 80 },
        value: { type: String, required: true, trim: true, maxlength: 40 },
        description: { type: String, trim: true, maxlength: 160 },
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("HomeStat", homeStatSchema);
