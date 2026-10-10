const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { publicPage, pagePath, meta, sitemapModels, sitemapFilter, sitemapCriteria, pageNumber, hasAcademicContext } = require("../services/publicPages");
const { renderDocument, siteOrigin, sitemapXml, escapeHtml } = require("../services/seoDocument");
const NewsArticle = require("../models/NewsArticle");
const Board = require("../models/Board");
const ClassModel = require("../models/Class");
const Group = require("../models/Group");
const Testimonial = require("../models/Testimonial");
const HomeStat = require("../models/HomeStat");
const SiteMetric = require("../models/SiteMetric");
const root = path.resolve(__dirname, "../../../client");
const cache = new Map();
let templateFile;
let renderingFiles;
async function frontendTemplate() {
    if (!templateFile) templateFile = fs.readFile(path.join(root, 'dist/index.html'), 'utf8')
        .catch(error => { templateFile = undefined; throw error; });
    return templateFile;
}
async function frontendRendering() {
    if (!renderingFiles) {
        renderingFiles = Promise.all([
            fs.readFile(path.join(root, 'dist/.vite/manifest.json'), 'utf8'),
            import(pathToFileURL(path.join(root, 'dist-server/entry-server.js')).href),
        ]).then(([manifest, entry]) => ({ manifest: JSON.parse(manifest), render: entry.render }))
            .catch(error => { renderingFiles = undefined; throw error; });
    }
    return renderingFiles;
}
async function cached(key, load, ttl = 30000) {
    const item = cache.get(key);
    if (item && item.expires > Date.now()) return item.value;
    const value = Promise.resolve().then(load);
    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + ttl });
    try { return await value; } catch (error) { if (cache.get(key)?.value === value) cache.delete(key); throw error; }
}
const invalidatePublicPages = () => cache.clear();
async function dataFor(req) {
    const requestPath = req.path + (new URL(req.originalUrl, "http://local").search);
    if (req.path.startsWith("/learn")) {
        const study = await publicPage(req.path, req.query);
        return { type: "study", requestPath, study, meta: study.meta };
    }
    if (req.path === "/news") {
        const category = typeof req.query.category === 'string' ? req.query.category : "All";
        const page = pageNumber(req.query.page);
        const filter = { isPublished: true, ...(category !== "All" ? { category } : {}) };
        const [news, total] = await Promise.all([NewsArticle.find(filter).sort({ publishedAt: -1, _id: -1 }).skip((page - 1) * 24).limit(24).select("title slug excerpt category coverImage imageAlt author isPublished isFeatured publishedAt updatedAt").lean(), NewsArticle.countDocuments(filter)]);
        const query = new URLSearchParams();
        if (category !== 'All') query.set('category', category);
        if (page > 1) query.set('page', String(page));
        return { type: "news", requestPath, news, total, page, category, meta: meta(`Education News and Study Guides${page > 1 ? ` - Page ${page}` : ''}`, "Education news, exam updates and study guidance for Pakistani board students. Read the latest published stories on IlmiDunya.", `/news${query.size ? `?${query}` : ''}`, category === 'All' && news.length > 0) };
    }
    if (req.path.startsWith("/news/")) {
        const slug = decodeURIComponent(req.path.slice(6));
        const article = await NewsArticle.findOne({ slug, isPublished: true }).lean();
        if (!article) throw Object.assign(new Error("Article not found"), { status: 404 });
        return { type: "article", requestPath, article, meta: { ...meta(article.title, article.excerpt, `/news/${encodeURIComponent(article.slug)}`, article.excerpt.length >= 60 && article.content.length >= 160), image: article.coverImage, article: true } };
    }
    const [boards, classes, groups, testimonials, stats, visitMetric, news] = await Promise.all([Board.find().sort({name:1}).lean(), ClassModel.find().sort({name:1}).lean(), Group.find().sort({name:1}).lean(), Testimonial.find({ isActive: true }).sort({ displayOrder: 1 }).limit(12).lean(), HomeStat.find({isActive:true}).sort({displayOrder:1}).limit(4).lean(), SiteMetric.findOne({ key: "site-visits" }).lean(), NewsArticle.find({isPublished:true,isFeatured:true}).sort({publishedAt:-1}).limit(5).select("title slug excerpt coverImage imageAlt category publishedAt").lean()]);
    const publicStats = [{ label: "Site visits", value: Number(visitMetric?.total || 0).toLocaleString("en-US"), description: "Learning visits to IlmiDunya", isLive: true }, ...stats].slice(0, 4);
    return { type: "home", requestPath, context: { boards, classes, groups }, home: { testimonials, stats: publicStats }, news, meta: meta("IlmiDunya - Notes, Books, Past Papers and MCQ Practice", "Prepare for Pakistani board exams with class-wise notes, textbooks, past papers, video lessons and chapter and topic MCQ practice.", "/") };
}

function publicRoutes() {
    const router = express.Router();
    router.get('/api/study-options', async (req, res) => {
        const options = await cached('study-options', async () => {
            const [boards, classes, groups] = await Promise.all([
                Board.find().sort({ name: 1 }).lean(),
                ClassModel.find().sort({ name: 1 }).lean(),
                Group.find().sort({ name: 1 }).lean(),
            ]);
            return { boards, classes, groups };
        }, 60000);
        res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30').json(options);
    });
    router.get('/api/public-page', async (req, res) => {
        const resourcePath = typeof req.query.path === 'string' ? req.query.path : '';
        const study = await cached(`study:${resourcePath}:${pageNumber(req.query.page)}`, () => publicPage(resourcePath, req.query));
        res.set('Cache-Control', 'public, max-age=0, must-revalidate').json({ study });
    });
    router.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteOrigin()}/sitemap.xml\n`));
    router.get('/sitemap.xml', async (req, res) => {
        const xml = await cached('sitemap-index', async () => {
            const entries = [`${siteOrigin()}/sitemaps/core/1.xml`];
            for (const [kind, Model] of Object.entries(sitemapModels)) {
                const filter = await sitemapCriteria(kind);
                if (!filter) continue;
                const total = await Model.countDocuments(filter);
                for (let p = 1; p <= Math.ceil(total / 1000); p++) entries.push(`${siteOrigin()}/sitemaps/${kind}/${p}.xml`);
            }
            return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(url => `<sitemap><loc>${escapeHtml(url)}</loc></sitemap>`).join('')}</sitemapindex>`;
        }, 300000);
        res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(xml);
    });
    router.get('/sitemaps/:kind/:page.xml', async (req, res) => {
        const { kind } = req.params;
        const p = Number(req.params.page);
        if (!Number.isInteger(p) || p < 1 || p > 10000 || (kind !== 'core' && !sitemapModels[kind])) return res.sendStatus(404);
        const xml = await cached(`sitemap:${kind}:${p}`, async () => {
            if (kind === 'core') {
                if (p !== 1) return null;
                return sitemapXml([{path:'/'},{path:'/learn'},{path:'/news'}]);
            }
            const filter = await sitemapCriteria(kind);
            if (!filter) return null;
            const fields = kind === 'topic' ? 'boardId classId subjectId chapterId' : ['news', 'board', 'class'].includes(kind) ? '' : `board class${kind !== 'subject' ? ' subject' : ''}${kind === 'notes' ? ' chapter' : ''}`;
            let request = sitemapModels[kind].find(filter).sort({_id:1}).skip((p - 1) * 1000).limit(1000).select(`name title slug updatedAt ${fields}`);
            if (fields) request = request.populate(fields, 'name');
            const docs = (await request.lean()).filter(doc => hasAcademicContext(kind, doc));
            return sitemapXml(docs.map(doc => ({ path: kind === 'news' ? `/news/${encodeURIComponent(doc.slug)}` : pagePath(kind,doc), updatedAt: doc.updatedAt })));
        }, 300000);
        if (!xml) return res.sendStatus(404);
        res.type('application/xml').set('Cache-Control','public, max-age=300').send(xml);
    });
    return router;
}

function frontendRoutes() {
    const router = express.Router();
    router.use('/assets', express.static(path.join(root, 'dist/assets'), { immutable: true, maxAge: '1y' }));
    router.get('/logo.png', (req, res) => res.sendFile(path.join(root, 'dist/logo.png')));
    router.get('/theme-init.js', (req, res) => res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').sendFile(path.join(root, 'dist/theme-init.js')));
    router.get('/{*path}', async (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
        let template;
        try { template = await frontendTemplate(); } catch { return next(); }
        try {
            if (req.path === '/' || req.path === '/news' || req.path.startsWith('/news/') || req.path === '/learn' || req.path.startsWith('/learn/')) {
                const data = await cached(`page:${req.originalUrl}`, () => dataFor(req));
                if (req.path === '/learn' || req.path.startsWith('/learn/') || req.path === '/news' || req.path.startsWith('/news/')) {
                    const requested = new URL(req.originalUrl, siteOrigin());
                    if (requested.pathname + requested.search !== data.meta.path) return res.redirect(301, data.meta.path);
                }
                const { manifest, render } = await frontendRendering();
                const html = await cached(`html:${req.originalUrl}`, () => {
                    const styles = new Set();
                    const visited = new Set();
                    const addStyles = key => {
                        if (visited.has(key) || !manifest[key]) return;
                        visited.add(key);
                        const entry = manifest[key];
                        (entry.css || []).forEach(file => styles.add(`/${file}`));
                        (entry.imports || []).forEach(addStyles);
                    };
                    const pageName = { home: 'Home', news: 'News', article: 'NewsArticle', study: 'PublicStudyPage' }[data.type];
                    Object.keys(manifest).filter(key => manifest[key].name === pageName).forEach(addStyles);
                    return renderDocument(template, data, render(data), [...styles]);
                });
                res.set('Cache-Control','public, max-age=0, must-revalidate');
                if (!data.meta.indexable) res.set('X-Robots-Tag','noindex, follow');
                return res.send(html);
            }
            const known = /^\/(admin(?:\/.*)?|subjects|chapters|topics|videos|book|notes|past-papers|answer-sheet|topic-questions|login|register|forgot-password|dashboard|leaderboard|tests(?:\/.*)?|assessments(?:\/.*)?)$/.test(req.path);
            res.status(known ? 200 : 404).set('X-Robots-Tag','noindex, follow').set('Cache-Control','private, no-store').send(renderDocument(template, { requestPath: req.originalUrl, meta: meta(known ? 'IlmiDunya Study Tools' : 'Page not found', known ? 'Student study tools and account access.' : 'This page could not be found.', req.path, false) }));
        } catch (error) {
            const status = error.status === 404 ? 404 : 503;
            const message = status === 404 ? 'Page not found' : 'Study content is temporarily unavailable';
            res.status(status).set('X-Robots-Tag','noindex, follow').set('Cache-Control','no-store').send(renderDocument(template, { requestPath: req.originalUrl, meta: meta(message, message, req.path, false) }, `<main style="max-width:760px;margin:80px auto;padding:24px"><h1>${message}</h1><p>Please try again or <a href="/learn">browse study resources</a>.</p></main>`));
        }
    });
    return router;
}
module.exports = { publicRoutes, frontendRoutes, invalidatePublicPages, dataFor };
