const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderDocument, sitemapXml, siteOrigin, safeJson } = require('../src/services/seoDocument');
const { pagePath, pageNumber, sitemapFilter, sitemapCriteria, resourceTitle } = require('../src/services/publicPages');
const Chapter = require('../src/models/Chapter');
const Book = require('../src/models/Book');
const PastPaper = require('../src/models/PastPaper');
const Subject = require('../src/models/Subject');
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
    assert.ok(sitemapFilter('mcqs').$or[1].description.$regex);
    assert.ok(sitemapFilter('book').summary.$regex);
    assert.equal(pagePath('book', { _id: '111111111111111111111111', title: 'Physics book' }), '/learn/book/111111111111111111111111/physics-book');
    assert.equal(pageNumber('-50'), 1);
    assert.equal(pageNumber('999999999'), 10000);
});

test('subject sitemap includes subjects with actual chapters, books or papers', async () => {
    const originals = [Chapter, Book, PastPaper].map(Model => Model.distinct);
    try {
        Chapter.distinct = async () => ['111111111111111111111111'];
        Book.distinct = async () => ['222222222222222222222222'];
        PastPaper.distinct = async () => [];
        const criteria = await sitemapCriteria('subject');
        assert.deepEqual(criteria.$or[1]._id.$in, ['111111111111111111111111', '222222222222222222222222']);
        assert.ok(criteria.$or[0].summary.$regex);
    } finally {
        [Chapter, Book, PastPaper].forEach((Model, i) => { Model.distinct = originals[i]; });
    }
});

test('invalid legacy references cannot break sitemap filters', async () => {
    const originals = [Chapter, Book, PastPaper, Subject].map(Model => Model.distinct);
    try {
        Chapter.distinct = async () => ['invalid', '111111111111111111111111'];
        Book.distinct = async () => [null];
        PastPaper.distinct = async () => [];
        Subject.distinct = async () => ['invalid', '222222222222222222222222'];
        assert.deepEqual((await sitemapCriteria('subject')).$or[1]._id.$in, ['111111111111111111111111']);
        assert.deepEqual((await sitemapCriteria('board'))._id.$in, ['222222222222222222222222']);
    } finally {
        [Chapter, Book, PastPaper, Subject].forEach((Model, i) => { Model.distinct = originals[i]; });
    }
});

test('resource titles use actual syllabus and verified publisher fields', () => {
    const context = { class: { name: 'Class 9' }, subject: { name: 'Physics' }, board: { name: 'FBISE' } };
    assert.equal(resourceTitle('book', context), 'Class 9 Physics FBISE Book');
    assert.equal(resourceTitle('book', { ...context, sourceName: 'National Book Foundation' }), 'Class 9 Physics FBISE Book - National Book Foundation');
    assert.match(resourceTitle('past-paper', { ...context, year: 2025, session: 'morning', examType: 'annual' }), /2025 morning annual Past Paper/);
});
