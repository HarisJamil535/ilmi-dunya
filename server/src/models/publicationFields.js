module.exports = {
    summary: { type: String, trim: true, maxlength: 2400, default: "" },
    slug: { type: String, trim: true, maxlength: 100, default: "" },
    sourceName: { type: String, trim: true, maxlength: 160, default: "" },
    sourceUrl: { type: String, trim: true, maxlength: 1000, default: "" },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    edition: { type: String, trim: true, maxlength: 80, default: "" },
    fileName: { type: String, trim: true, maxlength: 160, default: "" },
    imageAlt: { type: String, trim: true, maxlength: 240, default: "" },
};
