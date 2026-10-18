const crawlerNames = ['*', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'GPTBot', 'Google-Extended'];
function robotsText(origin) {
    const rules = ['Allow: /', 'Disallow: /api/', 'Disallow: /admin', 'Disallow: /dashboard', 'Disallow: /login', 'Disallow: /register', 'Disallow: /forgot-password', 'Disallow: /tests/result/', 'Disallow: /tests/*/take', 'Disallow: /*?filter=*', 'Disallow: /*?*&filter=*'];
    return crawlerNames.map(name => `User-agent: ${name}\n${rules.join('\n')}\n`).join('\n') + `\nSitemap: ${origin}/sitemap.xml\n`;
}
module.exports = { robotsText };
