const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
function siteOrigin() {
    const url = new URL(process.env.SITE_URL || "http://localhost:5000");
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) throw new Error("SITE_URL must be an HTTP(S) origin without a path.");
    return url.origin;
}
function renderDocument(template, data, body = "", styles = []) {
    const { meta } = data;
    const origin = siteOrigin();
    const canonical = new URL(meta.path, origin).href;
    const image = new URL(meta.image || "/logo.png", origin).href;
    let html = template.replace(/<title>[\s\S]*?<\/title>/gi, "")
        .replace(/<meta\s+[^>]*(?:name=["'](?:description|robots|keywords|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, "")
        .replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi, "")
        .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
    const tags = `<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
<meta name="robots" content="${meta.indexable ? 'index, follow' : 'noindex, follow'}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:title" content="${escapeHtml(meta.title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:type" content="${meta.article ? 'article' : 'website'}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">`;
    const schemas = [];
    if (data.study?.breadcrumbs?.length) schemas.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [...data.study.breadcrumbs, { title: data.study.title, href: meta.path }].map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.title, item: new URL(item.href, origin).href })) });
    if (data.article && meta.indexable) schemas.push({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: data.article.title, description: data.article.excerpt, datePublished: data.article.publishedAt, dateModified: data.article.updatedAt, author: { '@type': 'Organization', name: data.article.author || 'IlmiDunya Editorial' }, image: data.article.coverImage ? [image] : undefined, mainEntityOfPage: canonical });
    const schemaTag = schemas.length ? `<script id="${data.article ? 'news-article-schema' : 'public-page-schema'}" type="application/ld+json">${safeJson(schemas)}</script>` : '';
    html = html.replace('</head>', `${tags}${schemaTag}${styles.map(href => `<link rel="stylesheet" href="${escapeHtml(href)}">`).join('')}</head>`);
    return html.replace('<div id="root"></div>', `<div id="root">${body}</div><script id="public-page-data" type="application/json">${safeJson(data)}</script>`);
}
const sitemapXml = (entries, origin = siteOrigin()) => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(item => `<url><loc>${escapeHtml(new URL(item.path, origin).href)}</loc>${item.updatedAt ? `<lastmod>${new Date(item.updatedAt).toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`;
module.exports = { escapeHtml, safeJson, siteOrigin, renderDocument, sitemapXml };
