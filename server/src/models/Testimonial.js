const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        role: { type: String, required: true, trim: true, maxlength: 120 },
        comment: { type: String, required: true, trim: true, maxlength: 500 },
        initials: { type: String, trim: true, uppercase: true, maxlength: 4 },
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Testimonial", testimonialSchema);
