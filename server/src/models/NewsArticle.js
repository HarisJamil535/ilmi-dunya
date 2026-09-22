const mongoose = require("mongoose");

const newsArticleSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    excerpt: { type: String, required: true, trim: true, maxlength: 320 },
    content: { type: String, required: true, trim: true },
    category: { type: String, enum: ["Education News", "Exam Updates", "Study Guide", "Student Stories"], default: "Education News" },
    coverImage: { type: String, trim: true, default: "" },
    imageAlt: { type: String, trim: true, maxlength: 240, default: "" },
    sourceName: { type: String, trim: true, maxlength: 160, default: "" },
    sourceUrl: { type: String, trim: true, maxlength: 1000, default: "" },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    author: { type: String, trim: true, default: "IlmiDunya Editorial" },
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date },
}, { timestamps: true });

newsArticleSchema.index({ isPublished: 1, isFeatured: 1, publishedAt: -1 });
newsArticleSchema.index({ category: 1, publishedAt: -1 });
newsArticleSchema.index({ isPublished: 1, publishedAt: -1, _id: -1 });

module.exports = mongoose.model("NewsArticle", newsArticleSchema);
