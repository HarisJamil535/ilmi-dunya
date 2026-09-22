// Isolated publishing/rendering fixtures. This test never connects to MongoDB.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const id = number => String(number).padStart(24, '0');
const board = { _id: id(1), name: 'FBISE' };
const grade = { _id: id(2), name: 'Class 10' };
const group = { _id: id(3), name: 'Science' };
const subject = { _id: id(4), name: 'Physics', board, class: grade, group };
const summary = 'Learn how to prepare for the Class 10 Physics exam with a clear revision schedule, chapter practice and guidance on checking the official board timetable.';
const articles = Array.from({ length: 26 }, (_, i) => ({ _id: id(100 + i), title: `Physics revision guide ${i + 1}`, slug: `physics-guide-${i + 1}`, excerpt: summary, content: `${summary}\n${summary}\nCheck the official timetable before making travel arrangements.`, category: i % 2 ? 'Exam Updates' : 'Study Guide', author: 'IlmiDunya Editorial', coverImage: '/logo.png', imageAlt: 'IlmiDunya education platform', isPublished: true, isFeatured: i === 0, publishedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }));
const fixtures = { Board: [board], Class: [grade], Group: [group], Subject: [subject], NewsArticle: articles, HomeStat: [], Testimonial: [], Chapter: [], Topic: [], Book: [], ChapterNote: [], PastPaper: [], Assessment: [] };
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => value?.$regex ? value.$regex.test(row[key] || '') : String(row[key]?._id || row[key]) === String(value));
}
function query(rows, single = false) {
  let start = 0; let limit = rows.length;
  const result = { sort() { return this; }, select() { return this; }, populate() { return this; }, skip(n) { start = n; return this; }, limit(n) { limit = n; return this; }, lean() { return Promise.resolve(single ? rows[0] || null : rows.slice(start, start + limit)); }, then(resolve, reject) { return this.lean().then(resolve, reject); } };
  return result;
}
for (const [name, rows] of Object.entries(fixtures)) {
  const Model = require(`../../server/src/models/${name}`);
  Model.find = (filter = {}) => query(rows.filter(row => matches(row, filter)));
  Model.findOne = (filter = {}) => query(rows.filter(row => matches(row, filter)), true);
  Model.findById = value => query(rows.filter(row => row._id === String(value)), true);
  Model.countDocuments = async (filter = {}) => rows.filter(row => matches(row, filter)).length;
}

(async () => {
  const app = require('../../server/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.SITE_URL = origin;
  let browser;
  const results = [];
  try {
    for (const route of ['/', '/learn', '/news', '/news/physics-guide-1', `/learn/board/${board._id}/fbise`]) {
      const started = performance.now();
      const response = await fetch(origin + route);
      const html = await response.text();
      assert.equal(response.status, 200, `${route}: ${html.slice(-500)}`);
      assert.match(html, /<h1[ >]/, `${route} must have content without JavaScript`);
      assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
      results.push({ route, serverMs: Math.round(performance.now() - started), htmlBytes: Buffer.byteLength(html) });
    }
    const wrongSlug = await fetch(origin + `/learn/board/${board._id}/old-name`, { redirect: 'manual' });
    assert.equal(wrongSlug.status, 301);
    assert.equal((await fetch(origin + '/missing-page')).status, 404);
    assert.equal((await fetch(origin + '/news/not-published')).status, 404);
    assert.match(await (await fetch(origin + '/dashboard')).text(), /noindex, follow/);
    const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
    assert.match(sitemap, /sitemaps\/news\/1.xml/);
    const newsMap = await (await fetch(origin + '/sitemaps/news/1.xml')).text();
    assert.match(newsMap, /physics-guide-1/);
    assert.doesNotMatch(newsMap, /\/admin|\/dashboard/);
    assert.match(await (await fetch(origin + '/robots.txt')).text(), /Sitemap:/);

    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/admin/me') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ admin: { id: id(900), name: 'Fixture Editor', email: 'editor@example.test', role: 'super_admin', status: 'active', permissions: [] } }) });
      if (['/api/public-page', '/api/news'].includes(url.pathname) || url.pathname.startsWith('/api/news/')) {
        const response = await fetch(origin + url.pathname + url.search);
        return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
      }
      const body = { boards: [board], classes: [grade], groups: [group], subjects: [subject], chapters: [], topics: [], questions: [], assessments: [], books: [], notes: [], papers: [], stats: [], testimonials: [], leaders: [], leaderboard: [], entries: [] };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.addInitScript(() => {
      window.testVitals = { lcp: 0, cls: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.testVitals.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.testVitals.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    const artifacts = path.resolve(__dirname, '../../artifacts/seo');
    await fs.mkdir(artifacts, { recursive: true });
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/', '/learn', '/news', '/news/physics-guide-1']) {
        console.log(`Checking ${route} at ${width}px`);
        await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
        await page.locator('html[data-app-ready="true"]').waitFor({ state: 'attached' });
        await page.waitForLoadState('networkidle');
        await page.locator('h1').waitFor();
        assert.equal(await page.locator('h1').count(), 1, route);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${route} overflows at ${width}px`);
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
        await page.screenshot({ path: path.join(artifacts, `${route.replace(/\W+/g, '-') || 'home'}-${width}.png`), fullPage: true });
        results.push({ route, width, ...await page.evaluate(() => window.testVitals) });
      }
    }
    await page.goto(origin + '/news');
    await page.locator('html[data-app-ready="true"]').waitFor({ state: 'attached' }).catch(error => { console.error(errors); throw error; });
    await page.getByRole('link', { name: 'Next page', exact: true }).click();
    await page.getByText('Page 2', { exact: true }).waitFor();
    await page.locator('html[data-app-ready="true"]').waitFor();
    assert.match(await page.locator('link[rel="canonical"]').getAttribute('href'), /page=2/);
    await page.getByRole('button', { name: 'Study Guide', exact: true }).click();
    await page.locator('meta[name="robots"][content="noindex, follow"]').waitFor({ state: 'attached' }).catch(async error => {
      console.error({ url: page.url(), robots: await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.outerHTML)), errors });
      throw error;
    });
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByRole('link', { name: 'Next page', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Study Library', exact: true }).click();
    await page.getByRole('heading', { name: 'Study resources for Pakistani board students' }).waitFor();
    assert.match(await page.locator('link[rel="canonical"]').getAttribute('href'), /\/learn$/);
    await page.addInitScript(() => { localStorage.setItem('studentToken', 'fixture-only'); localStorage.setItem('adminToken', 'fixture-only'); });
    await page.goto(origin + '/');
    await page.getByRole('link', { name: 'My dashboard', exact: true }).waitFor();
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/admin/academic-structure/manage-books', '/admin/home-content/news']) {
        await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('Student summary', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Readable URL slug', { exact: true }).count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route} overflows at ${width}px`);
        await page.screenshot({ path: path.join(artifacts, `${route.replace(/\W+/g, '-')}-${width}.png`), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(artifacts, 'measurements.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: true, checks: 'SSR, canonical, 404, redirect, sitemap, noindex, responsive layouts, pagination, category return, client navigation', results }, null, 2));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
