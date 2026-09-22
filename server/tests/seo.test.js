const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderDocument, sitemapXml, siteOrigin, safeJson } = require('../src/services/seoDocument');
const { pagePath, pageNumber, sitemapFilter } = require('../src/services/publicPages');
const template = '<html><head><title>Old</title><meta name="description" content="old"><meta name="robots" content="index"><link rel="canonical" href="https://wrong.test"></head><body><div id="root"></div></body></html>';

test('rendered pages have one escaped title, canonical and meaningful HTML', () => {
    const html = renderDocument(template, { meta: { title: 'Physics & Motion', description: 'Quotes " & symbols', path: '/learn?x=1&y=2', indexable: true } }, '<h1>Physics</h1>');
    assert.equal((html.match(/<title>/g) || []).length, 1);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.match(html, /Physics &amp; Motion/);
    assert.match(html, /<h1>Physics<\/h1>/);
    assert.doesNotMatch(html, /wrong.test/);
    assert.match(html, /name="robots" content="index, follow"/);
});

test('bootstrap data and sitemap output cannot break out into markup', () => {
    assert.doesNotMatch(safeJson({ summary: '</script><script>alert(1)</script>' }), /</);
    const xml = sitemapXml([{ path: '/news?x=1&y=2', updatedAt: '2025-01-02' }], 'https://example.com');
    assert.match(xml, /x=1&amp;y=2/);
    assert.match(xml, /2025-01-02T00:00:00.000Z/);
    assert.equal(siteOrigin().startsWith('http'), true);
});

test('private pages are noindex; sitemap queries exclude drafts and thin resources', () => {
    const html = renderDocument(template, { meta: { title: 'Dashboard', description: 'Private', path: '/dashboard', indexable: false } });
    assert.match(html, /noindex, follow/);
    assert.equal(sitemapFilter('news').isPublished, true);
    assert.equal(sitemapFilter('mcqs').status, 'published');
    assert.ok(sitemapFilter('book').summary.$regex);
    assert.equal(pagePath('book', { _id: '111111111111111111111111', title: 'Physics book' }), '/learn/book/111111111111111111111111/physics-book');
    assert.equal(pageNumber('-50'), 1);
    assert.equal(pageNumber('999999999'), 10000);
});
