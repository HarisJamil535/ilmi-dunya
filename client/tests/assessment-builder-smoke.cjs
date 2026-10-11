// API fixtures only; no live database or student records are touched.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5180';
const id = n => String(n).padStart(24, '0');
const board = { _id: id(1), name: 'Federal Board' };
const grade = { _id: id(2), name: 'Class 9' };
const group = { _id: id(3), name: 'Science' };
const subject = { _id: id(4), name: 'Computer Science' };
const chapter = { _id: id(5), name: 'Computer Systems', chapterNumber: 1 };
const topic = { _id: id(6), name: 'History of Computers', topicNumber: '1.1' };
const questions = Array.from({ length: 26 }, (_, i) => ({ _id: id(100 + i), questionText: `Sample MCQ ${i + 1}`, difficulty: 'medium', marks: 2, options: [{ key: 'A', text: 'Answer' }], correctOption: 'A' }));
const assessment = { _id: id(7), title: 'Published topic batch', type: 'topic_test', status: 'published', board: board._id, class: grade._id, group: group._id, subject, chapter, topic, durationMinutes: 17, questions: questions.map((question, i) => ({ question, marks: 2, order: i + 1 })) };

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    try {
        const page = await browser.newPage();
        const errors = []; let saved; let publishedDirectoryRequested = false;
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => localStorage.setItem('adminToken', 'fixture-only'));
        await page.route(`${origin}/api/**`, async route => {
            const url = new URL(route.request().url());
            let body = { success: true, boards: [board], classes: [grade], groups: [group], subjects: [subject], chapters: [chapter], topics: [topic], assessments: [assessment], questions: [] };
            if (url.pathname === '/api/admin/me') body = { admin: { id: id(9), name: 'Fixture Admin', role: 'super_admin', status: 'active', permissions: [] } };
            if (url.pathname === `/api/assessments/${assessment._id}`) {
                if (route.request().method() === 'PUT') {
                    saved = route.request().postDataJSON();
                    body = { success: true, assessment: { ...assessment, ...saved } };
                } else body = { success: true, assessment };
            }
            if (url.pathname === '/api/questions') {
                const pageNumber = Number(url.searchParams.get('page') || 1);
                const limit = Number(url.searchParams.get('limit') || 25);
                if (url.searchParams.get('publishedOnly') === 'true') publishedDirectoryRequested = true;
                body = { success: true, questions: questions.slice((pageNumber - 1) * limit, pageNumber * limit), pagination: { total: 26, pages: Math.ceil(26 / limit) } };
            }
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
        });
        await page.goto(`${origin}/admin/assessments/builder`);
        await page.getByRole('button', { name: 'Edit', exact: true }).click();
        await page.getByRole('button', { name: 'Save & republish', exact: true }).waitFor();
        await page.getByText('Page 1 of 2', { exact: true }).waitFor();
        assert.match(await page.getByRole('heading', { name: 'Test Summary' }).locator('..').innerText(), /52/);
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByText('Sample MCQ 26', { exact: true }).waitFor();
        const directoryUrl = await page.getByRole('link', { name: "Manage this topic's published MCQs" }).getAttribute('href');
        await Promise.all([
            page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/assessments/${assessment._id}`)),
            page.getByRole('button', { name: 'Save & republish', exact: true }).click(),
        ]);
        assert.equal(saved.status, 'published');
        assert.equal(saved.questions.length, 26);
        assert.equal(saved.durationMinutes, 17);
        await page.goto(origin + directoryUrl);
        await page.getByRole('tab', { name: 'In published tests', exact: true }).waitFor();
        await page.waitForLoadState('networkidle');
        assert.equal(publishedDirectoryRequested, true);
        assert.equal(await page.getByRole('tab', { name: 'In published tests', exact: true }).getAttribute('aria-selected'), 'true');
        const artifacts = path.resolve(__dirname, '../../artifacts/admin-scroll');
        await fs.mkdir(artifacts, { recursive: true });
        for (const theme of ['light', 'dark']) {
          await page.evaluate(value => {
              localStorage.setItem('ilmidunya-admin-theme', value);
              window.dispatchEvent(new Event('ilmidunya-theme-change'));
          }, theme);
          for (const [width, height] of [[375, 667], [667, 375], [1440, 900]]) {
            await page.setViewportSize({ width, height });
            const main = page.getByRole('main', { name: 'Admin workspace' });
            await main.evaluate(element => { element.scrollTop = element.scrollHeight; });
            await page.evaluate(() => window.scrollTo(0, 10000));
            const geometry = await page.evaluate(() => {
                const shell = document.querySelector('.admin-theme-root');
                const main = document.querySelector('main');
                const sidebar = document.querySelector('#admin-navigation');
                const bounds = shell.getBoundingClientRect();
                return { overflow: document.documentElement.scrollWidth > innerWidth + 1, windowScroll: scrollY, top: bounds.top, bottom: bounds.bottom, height: innerHeight, sidebarTop: sidebar.getBoundingClientRect().top, sidebarHeight: sidebar.getBoundingClientRect().height, mainScroll: main.scrollTop, background: getComputedStyle(shell).backgroundColor };
            });
            assert.equal(geometry.overflow, false, `Overflow at ${width}px/${theme}`);
            assert.equal(geometry.windowScroll, 0, `Document scrolled at ${width}px/${theme}`);
            assert.equal(geometry.top, 0);
            assert.equal(geometry.bottom, geometry.height);
            assert.equal(geometry.sidebarTop, 0);
            assert.equal(geometry.sidebarHeight, geometry.height);
            assert.ok(geometry.mainScroll > 0, 'Main content must remain scrollable');
            if (theme === 'light') assert.equal(geometry.background, 'rgb(248, 246, 254)');
            if (width < 768) {
                await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
                const nav = page.locator('#admin-navigation nav');
                await nav.evaluate(element => { element.scrollTop = element.scrollHeight; });
                assert.ok(await nav.evaluate(element => element.scrollTop > 0));
                await page.getByRole('button', { name: 'Close navigation', exact: true }).click();
                await page.waitForFunction(() => document.querySelector('#admin-navigation').getBoundingClientRect().right <= 0);
            }
            await page.screenshot({ path: path.join(artifacts, `questions-${width}-${height}-${theme}.png`) });
          }
        }
        await page.goto(origin + '/login');
        await page.getByRole('heading').first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-admin-workspace')), false, 'Admin scroll lock must be removed on public pages');
        assert.deepEqual(errors, []);
        console.log('PASS: edit/republish, pagination, published MCQ directory, independent scrolling and viewport containment at desktop/mobile/landscape sizes in light and dark themes; public-page scroll lock cleanup.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
