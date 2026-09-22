const slugify = (value) => String(value || "").normalize("NFKC").toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/, "");

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const safeUrl = (value, { localImage = false } = {}) => {
    if (!value) return true;
    if (typeof value !== "string") return false;
    if (localImage && /^\/uploads\/news\/[a-zA-Z0-9._-]+$/.test(value)) return true;
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
};

function publication(body, { existing = {}, requireSummary = false } = {}) {
    const output = {};
    const limits = { summary: 2400, slug: 100, sourceName: 160, sourceUrl: 1000, edition: 80, fileName: 160, imageAlt: 240 };
    for (const [key, max] of Object.entries(limits)) {
        if (body[key] === undefined) continue;
        if (typeof body[key] !== "string") fail(`${key} must be text.`);
        output[key] = body[key].trim();
        if (output[key].length > max) fail(`${key} must be ${max} characters or fewer.`);
    }
    if (output.slug && slugify(output.slug) !== output.slug) fail("Use a readable lowercase slug with words separated by hyphens.");
    if (!safeUrl(output.sourceUrl)) fail("Enter an HTTP or HTTPS source URL.");
    if (output.fileName && !/^[\p{L}\p{N}._ -]+$/u.test(output.fileName)) fail("Use a descriptive filename without paths or special characters.");
    if (body.tags !== undefined) {
        const tags = typeof body.tags === "string" ? body.tags.split(",") : body.tags;
        if (!Array.isArray(tags) || tags.some(tag => typeof tag !== "string")) fail("Tags must be a list of words.");
        output.tags = [...new Set(tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))];
        if (output.tags.length > 8 || output.tags.some(tag => tag.length > 40)) fail("Use up to 8 relevant tags, each 40 characters or fewer.");
    }
    const summary = output.summary ?? existing.summary ?? "";
    if (requireSummary && summary.length < 80) fail("Add a useful summary (at least 80 characters) explaining coverage, intended students and how to use this resource.");
    return output;
}

function validateNews(body, existing = {}) {
    const payload = { ...publication(body, { existing }) };
    for (const key of ["title", "excerpt", "content", "category", "author", "coverImage"]) {
        if (body[key] !== undefined) {
            if (typeof body[key] !== "string") fail(`${key} must be text.`);
            payload[key] = body[key].trim();
        }
    }
    for (const key of ["isPublished", "isFeatured"]) {
        if (body[key] !== undefined) {
            if (typeof body[key] !== "boolean") fail(`${key} must be true or false.`);
            payload[key] = body[key];
        }
    }
    const merged = { ...existing, ...payload };
    if (!merged.title || !merged.excerpt || !merged.content) fail("Headline, summary and article content are required.");
    if (!safeUrl(merged.coverImage, { localImage: true })) fail("Use a valid image URL or upload a JPG, PNG or WebP image.");
    if (merged.isPublished && (merged.excerpt.length < 60 || merged.content.length < 160)) fail("Before publishing, add a specific summary and a complete article with useful details for students.");
    if (merged.isPublished && merged.coverImage && !merged.imageAlt) fail("Describe the cover image for students using screen readers before publishing.");
    if (existing.slug && payload.slug && payload.slug !== existing.slug) fail("The saved news URL is permanent. Keep its slug when editing this article.");
    payload.slug = existing.slug || payload.slug || slugify(merged.title);
    if (!payload.slug) fail("Enter a readable URL slug.");
    payload.publishedAt = existing.publishedAt || (merged.isPublished ? new Date() : undefined);
    return payload;
}

module.exports = { slugify, fail, safeUrl, publication, validateNews };
