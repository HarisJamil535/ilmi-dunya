const mongoose = require("mongoose");

const siteMetricSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    total: { type: Number, default: 0, min: 0 },
    lastRecordedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("SiteMetric", siteMetricSchema);
