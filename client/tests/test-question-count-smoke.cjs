const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5180';
const id = '507f1f77bcf86cd799439011';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const artifacts = path.resolve(__dirname, '../../artifacts/test-question-count');
  await fs.mkdir(artifacts, { recursive: true });
  try {
    for (const [scope, width, theme] of [['topic', 375, 'light'], ['chapter', 1440, 'dark']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.addInitScript(value => {
        localStorage.setItem('studentToken', 'fixture-only');
        localStorage.setItem('ilmidunya-client-theme', value);
      }, theme);
      let startBody; let submitBody;
      await page.route(`${origin}/api/**`, async route => {
        const url = new URL(route.request().url());
        let body = { success: true, boards: [], classes: [], groups: [], subjects: [], assessments: [] };
        if (url.pathname === '/api/attempts/preview') body.test = { title: 'Computer Systems Test', questionCount: 55, availableQuestions: 55, canChooseCount: true, durationMinutes: 55, totalMarks: 55, ranked: true, instructions: [] };
        if (url.pathname === '/api/attempts/start') {
          startBody = route.request().postDataJSON();
          const count = startBody.questionCount === 'all' ? 55 : startBody.questionCount;
          body.attempt = { _id: id, status: 'in_progress', assessment: { title: 'Computer Systems Test' }, expiresAt: new Date(Date.now() + count * 60000).toISOString(), answers: Array.from({ length: count }, (_, i) => ({ question: { _id: String(i), questionText: `Practice question ${i + 1}`, options: [{ key: 'A', text: 'First answer' }, { key: 'B', text: 'Second answer' }] } })) };
          body.serverNow = new Date().toISOString();
        }
        if (url.pathname.endsWith('/submit')) { submitBody = route.request().postDataJSON(); body.attempt = { _id: id }; }
        if (url.pathname.endsWith('/result')) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture result' }) });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(origin + '/tests');
      await page.goto(`${origin}/tests/start?${scope}=${id}`);
      await page.getByRole('heading', { name: 'Computer Systems Test' }).waitFor();
      assert.equal(await page.getByRole('radio', { name: 'All 55 questions' }).isChecked(), true);
      await page.getByRole('radio', { name: 'Choose a number' }).check();
      const countInput = page.getByRole('spinbutton', { name: 'Number of MCQs' });
      await countInput.fill('4');
      assert.equal(await page.getByRole('button', { name: 'Start test', exact: true }).isDisabled(), true);
      await countInput.fill('56');
      assert.equal(await page.getByRole('button', { name: 'Start test', exact: true }).isDisabled(), true);
      await countInput.fill('25');
      const stats = page.getByRole('definition');
      assert.deepEqual(await stats.allTextContents(), ['25', '25']);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(artifacts, `${scope}-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Start test', exact: true }).click();
      await page.getByText('Question 1 of 25', { exact: true }).waitFor();
      assert.equal(startBody.questionCount, 25);
      assert.equal(startBody[scope], id);
      if (scope === 'topic') await page.evaluate(() => {
        const current = location.href;
        const state = history.state;
        history.replaceState(state, '', '/tests');
        history.pushState({ ...state, idx: (state?.idx || 0) + 1 }, '', current);
      });
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/submit')),
        scope === 'topic' ? page.goBack() : page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        }),
      ]);
      assert.equal(submitBody.autoSubmitted, true);
      await page.close();
    }
    console.log('PASS: topic/chapter count controls, all default, bounds, 25-minute display, mobile/dark layouts, browser Back and tab-hidden auto-submit.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
