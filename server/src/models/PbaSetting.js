const mongoose = require("mongoose");

// The introduction box at the top of a subject's PBA page: a short text, a few facts (marks, time...) and official links.
const pbaSettingSchema = new mongoose.Schema({
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, unique: true },
    intro: { type: String, trim: true, maxlength: 1200, default: "" },
    facts: { type: [new mongoose.Schema({ label: { type: String, trim: true, maxlength: 40 }, value: { type: String, trim: true, maxlength: 80 } }, { _id: false })], default: [] },
    links: { type: [new mongoose.Schema({ title: { type: String, trim: true, maxlength: 100 }, url: { type: String, trim: true, maxlength: 1000 } }, { _id: false })], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("PbaSetting", pbaSettingSchema);
