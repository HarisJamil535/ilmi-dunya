const mongoose = require("mongoose");

// A kind of practical question, such as "Error correction" or "HTML code". Each subject has its own list.
const pbaCategorySchema = new mongoose.Schema({
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    order: { type: Number, default: 0 },
}, { timestamps: true });

pbaCategorySchema.index({ subject: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("PbaCategory", pbaCategorySchema);
