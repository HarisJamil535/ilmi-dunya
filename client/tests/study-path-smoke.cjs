const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { renderDocument } = require('../../server/src/services/seoDocument');

(async () => {
  const { render } = await import('../dist-server/entry-server.js');
  const options = { boards: [{ _id: '111111111111111111111111', name: 'Federal Board' }, { _id: '222222222222222222222222', name: 'BISE Lahore' }], classes: [{ _id: '333333333333333333333333', name: '9' }], groups: [{ _id: '444444444444444444444444', name: 'Science' }] };
  const meta = { title: 'Study resources for Pakistani board students', description: 'Choose your board, class and group.', path: '/learn', indexable: true };
  const study = { kind: 'directory', title: meta.title, summary: meta.description, studyOptions: options, breadcrumbs: [{ title: 'Home', href: '/' }], sections: [{ title: 'Classes', links: [{ href: '/learn/class/333333333333333333333333/9', title: 'Class 9' }] }], meta };
  const data = { type: 'study', requestPath: '/learn', study, meta, context: options };
  const html = renderDocument(fs.readFileSync(require.resolve('../dist/index.html'), 'utf8'), data, render(data));
  assert.ok(html.includes('Choose your board'));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/subjects?') ? { subjects: [{ _id: '555555555555555555555555', name: 'Computer Science' }] } : options }));
    await page.route('**/learn', route => route.fulfill({ contentType: 'text/html', body: html }));
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto('http://127.0.0.1:5182/learn');
      await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
      fs.mkdirSync('artifacts/study-path', { recursive: true });
      await page.screenshot({ path: `artifacts/study-path/learn-${width}.png`, fullPage: true });
      assert.equal(await page.getByLabel('Class', { exact: true }).isDisabled(), true);
      assert.equal(await page.getByLabel('Group', { exact: true }).isDisabled(), true);
      await page.getByLabel('Board', { exact: true }).selectOption(options.boards[0]._id);
      await page.getByLabel('Class', { exact: true }).selectOption(options.classes[0]._id);
      await page.getByLabel('Group', { exact: true }).selectOption(options.groups[0]._id);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole('button', { name: 'Start learning', exact: true }).click();
      await page.waitForURL('**/subjects?**');
      assert.equal(new URL(page.url()).searchParams.get('groupId'), options.groups[0]._id);
      await page.getByRole('heading', { name: 'Computer Science', exact: true }).waitFor();
      const subject = page.locator('a[href*="subjectId=555555555555555555555555"]').first();
      assert.ok((await subject.getAttribute('href')).includes(`groupId=${options.groups[0]._id}`));
    }
    console.log('Study path SSR, sequential selections, mobile layout and subject/resource scope passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
