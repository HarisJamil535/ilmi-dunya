const NewsArticle = require("../models/NewsArticle");
const { validateNews } = require("../services/publishing");
const { pageNumber } = require("../services/publicPages");

const getNews = async (req, res) => {
    const filter = req.admin ? {} : { isPublished: true };
    if (req.query.category) filter.category = req.query.category;
    const page = pageNumber(req.query.page);
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || (req.admin ? 50 : 24)));
    const [articles, total] = await Promise.all([
        NewsArticle.find(filter).sort({ publishedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select("title slug excerpt category coverImage imageAlt author isPublished isFeatured publishedAt updatedAt").lean(),
        NewsArticle.countDocuments(filter),
    ]);
    res.json({ success: true, articles, page, limit, total, pages: Math.ceil(total / limit) });
};
const getFeaturedNews = async (req, res) => {
    const articles = await NewsArticle.find({ isPublished: true, isFeatured: true }).sort({ publishedAt: -1 }).limit(5).select("title slug excerpt category coverImage imageAlt publishedAt").lean();
    res.json({ success: true, articles });
};
const getNewsArticle = async (req, res) => {
    const filter = req.admin ? { slug: req.params.slug } : { slug: req.params.slug, isPublished: true };
    const article = await NewsArticle.findOne(filter).lean();
    if (!article) return res.status(404).json({ success: false, message: "News article not found." });
    res.json({ success: true, article });
};
const createNews = async (req, res) => {
    const payload = validateNews(req.body);
    if (await NewsArticle.exists({ slug: payload.slug })) return res.status(409).json({ success: false, message: "This news URL already exists. Edit the existing article or choose a distinct slug." });
    const article = await NewsArticle.create(payload);
    res.status(201).json({ success: true, article });
};
const updateNews = async (req, res) => {
    const existing = await NewsArticle.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "News article not found." });
    Object.assign(existing, validateNews(req.body, existing.toObject()));
    await existing.save();
    res.json({ success: true, article: existing });
};
const deleteNews = async (req, res) => {
    const article = await NewsArticle.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: "News article not found." });
    res.json({ success: true });
};
module.exports = { getNews, getFeaturedNews, getNewsArticle, createNews, updateNews, deleteNews };
