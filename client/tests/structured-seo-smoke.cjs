const fs = require('node:fs');
const { chromium } = require('playwright');
const { renderDocument } = require('../../server/src/services/seoDocument');

(async () => {
  const { render } = await import('../dist-server/entry-server.js');
  const { educationalSchemas } = await import('../src/seo/structuredData.mjs');
  const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5182';
  const path = '/learn/notes/507f1f77bcf86cd799439011/motion?filter=important';
  const study = { kind: 'notes', title: 'Motion Notes', summary: 'Motion notes for Class 9.', meta: { title: 'Motion Notes | IlmiDunya', description: 'Motion notes for Class 9.', path, indexable: true }, sections: [], breadcrumbs: [{ title: 'Home', href: '/' }], questions: [] };
  study.structuredData = educationalSchemas(study, origin);
  const data = { type: 'study', requestPath: path, study, meta: study.meta, context: { boards: [], classes: [], groups: [] } };
  const html = renderDocument(fs.readFileSync(require.resolve('../dist/index.html'), 'utf8'), data, render(data));
  if (!html.split('</head>')[0].includes('LearningResource')) throw Error('SSR schema missing');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => route.fulfill({ json: { boards: [], classes: [], groups: [] } }));
    await page.route('**/learn/notes/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(origin + path);
    await page.locator('head #study-resource-schema[data-seo-owned]').waitFor({ state: 'attached' }).catch(async error => {
      console.error(await page.evaluate(() => ({ ready: document.documentElement.dataset.appReady, schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => node.outerHTML), body: document.body.textContent.slice(0, 500) })), errors);
      throw error;
    });
    const result = await page.evaluate(() => ({ canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(item => item.href), schemas: document.querySelectorAll('#study-resource-schema').length, type: JSON.parse(document.querySelector('head #study-resource-schema').textContent)[0]['@type'] }));
    if (result.canonical.length !== 1 || result.canonical[0].includes('?') || result.schemas !== 1 || result.type !== 'LearningResource' || errors.length) throw Error(JSON.stringify({ result, errors }));
    console.log('Initial SSR and hydrated head: one clean canonical, one LearningResource schema; passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
