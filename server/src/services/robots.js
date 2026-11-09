const crawlerNames = ['*', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'GPTBot', 'Google-Extended'];
// Only the API is kept away from crawlers. Private pages (login, dashboard, tests, admin) are NOT listed here on
// purpose: they answer with a "noindex" tag, and a crawler can only see that tag if robots.txt lets it fetch the
// page. Blocking them here is what produced "Indexed, though blocked by robots.txt" in Search Console.
// Question pictures live under /api/media/images and may be indexed with the page that shows them.
function robotsText(origin) {
    const rules = ['Allow: /api/media/images/', 'Disallow: /api/'];
    return crawlerNames.map(name => `User-agent: ${name}\n${rules.join('\n')}\n`).join('\n') + `\nSitemap: ${origin}/sitemap.xml\n`;
}
module.exports = { robotsText };
