// API fixtures only; no live database or student records are touched.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5180';
const artifacts = process.env.TEST_ARTIFACTS || path.resolve(__dirname, '../../artifacts/school-features');
const id = n => String(n).padStart(24, '0');
const school = { _id: id(1), name: 'APS Boys and Girls DHA', isActive: true, studentCount: 2, classes: [
  { _id: id(11), name: 'Class 9', sections: [{ _id: id(111), name: 'Section A' }, { _id: id(112), name: 'Section B' }] },
  { _id: id(12), name: 'Class 10', sections: [] },
] };
const otherSchools = Array.from({ length: 10 }, (_, i) => ({ _id: id(20 + i), name: `Sample School ${i + 1}`, isActive: true, studentCount: 0, classes: [] }));
const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

async function choose(page, label, option) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    // ---- Signup ----
    const signup = await browser.newPage({ viewport: { width: 390, height: 844 } });
    signup.on('pageerror', error => errors.push(error.message));
    let registerBody;
    await signup.route(`${origin}/api/**`, route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/schools') return json(route, { success: true, schools: [school, ...otherSchools] });
      if (url.pathname === '/api/students/register') { registerBody = route.request().postDataJSON(); return json(route, { success: true, challengeId: id(99), message: 'Code sent.' }, 202); }
      return json(route, { success: true, boards: [], classes: [], groups: [] });
    });
    await signup.goto(`${origin}/register`);
    await signup.getByLabel('Full name').fill('Ayesha Khan');
    await signup.getByLabel('Email address').fill('ayesha@example.com');
    await signup.getByLabel('WhatsApp number').fill('0300 1234567');
    await choose(signup, 'Gender', 'Female');
    await signup.getByLabel('City').fill('Karachi');

    // Nothing chosen yet: the school is required.
    await signup.getByRole('button', { name: 'Continue' }).click();
    await signup.getByText('Select your school.').waitFor();

    // A school with classes and sections asks for both, one after the other.
    await signup.getByLabel('School', { exact: true }).click();
    await signup.getByRole('searchbox', { name: /Search School/ }).fill('aps');
    assert.equal(await signup.getByRole('option').count(), 2, 'search keeps the placeholder row and one match');
    await signup.getByRole('option', { name: 'APS Boys and Girls DHA' }).click();
    await signup.getByLabel('Class', { exact: true }).waitFor();
    assert.equal(await signup.getByLabel('Section', { exact: true }).count(), 0, 'section appears only after a class with sections is chosen');
    await signup.getByRole('button', { name: 'Continue' }).click();
    await signup.getByText('Select your class.').waitFor();
    await choose(signup, 'Class', 'Class 10');
    assert.equal(await signup.getByLabel('Section', { exact: true }).count(), 0, 'a class without sections asks for no section');
    await choose(signup, 'Class', 'Class 9');
    await signup.getByLabel('Section', { exact: true }).waitFor();
    await signup.getByRole('button', { name: 'Continue' }).click();
    await signup.getByText('Select your section.').waitFor();
    await signup.screenshot({ path: path.join(artifacts, 'signup-class-section-mobile.png') });

    // Other schools get a text box; private students get nothing extra.
    await choose(signup, 'School', 'My school is not listed');
    assert.equal(await signup.getByLabel('Class', { exact: true }).count(), 0);
    await signup.getByRole('button', { name: 'Continue' }).click();
    await signup.getByText('Enter your school name.').waitFor();
    await choose(signup, 'School', 'Private Student');
    assert.equal(await signup.getByLabel('School name').count(), 0);
    await choose(signup, 'School', 'My school is not listed');
    await signup.getByLabel('School name').fill('City Grammar School');

    // Back to a listed school and finish.
    await choose(signup, 'School', 'APS Boys and Girls DHA');
    await choose(signup, 'Class', 'Class 9');
    await choose(signup, 'Section', 'Section B');
    await signup.getByRole('button', { name: 'Continue' }).click();
    await signup.getByLabel('Create password').fill('Passw0rdOK1');
    await signup.getByRole('button', { name: 'Create account and send code' }).click();
    await signup.getByText('Verify your email').first().waitFor();
    assert.equal(registerBody.schoolId, id(1));
    assert.equal(registerBody.schoolClassId, id(11));
    assert.equal(registerBody.schoolSectionId, id(112));
    assert.equal(registerBody.school, '');

    // ---- Student dashboard ----
    const dash = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    dash.on('pageerror', error => errors.push(error.message));
    await dash.addInitScript(() => localStorage.setItem('studentToken', 'fixture-only'));
    let schoolUpdate; let cardRequested = false;
    await dash.route(`${origin}/api/**`, route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/schools') return json(route, { success: true, schools: [school] });
      if (url.pathname === '/api/student-dashboard/summary') return json(route, { success: true, summary: { testsTaken: 2, averageScore: 80, bestScore: 90, inProgressCount: 0, totalTimeSpentSeconds: 600, learningStreak: 2 }, inProgress: [], recentAttempts: [], subjectPerformance: [], weakTopics: [], strongTopics: [], activities: [], student: { name: 'Ayesha Khan', email: 'ayesha@example.com', phone: '+923001234567', city: 'Karachi', school: 'Old School', schoolId: null, schoolClass: '', schoolSection: '' } });
      if (url.pathname === '/api/students/me/school') { schoolUpdate = route.request().postDataJSON(); return json(route, { success: true, student: { school: school.name, schoolId: school._id, schoolClass: 'Class 9', schoolSection: 'Section A' } }); }
      if (url.pathname === '/api/student-dashboard/result-card') { cardRequested = true; return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="IlmiDunya-Result-Card-Ayesha-Khan-22Oct2026.pdf"' }, body: Buffer.from('%PDF-1.4\n%fixture\n') }); }
      return json(route, { success: true });
    });
    await dash.goto(`${origin}/dashboard`);
    const [download] = await Promise.all([dash.waitForEvent('download'), dash.getByRole('button', { name: 'Download result card' }).click()]);
    assert.equal(download.suggestedFilename(), 'IlmiDunya-Result-Card-Ayesha-Khan-22Oct2026.pdf');
    assert.ok(cardRequested);
    await dash.getByRole('button', { name: 'Edit school, class and section' }).click();
    assert.match(await dash.getByLabel('School', { exact: true }).textContent(), /My school is not listed|Select your school/, 'an unmanaged school starts as "other"');
    await choose(dash, 'School', 'APS Boys and Girls DHA');
    await choose(dash, 'Class', 'Class 9');
    await choose(dash, 'Section', 'Section A');
    await dash.getByRole('button', { name: 'Save', exact: true }).click();
    await dash.getByText('Section A').first().waitFor();
    assert.deepEqual([schoolUpdate.schoolId, schoolUpdate.schoolClassId, schoolUpdate.schoolSectionId], [id(1), id(11), id(111)]);
    await dash.screenshot({ path: path.join(artifacts, 'dashboard-desktop.png') });

    // ---- Admin ----
    for (const [width, height, name] of [[1440, 900, 'desktop'], [375, 800, 'mobile']]) {
      const admin = await browser.newPage({ viewport: { width, height } });
      admin.on('pageerror', error => errors.push(error.message));
      await admin.addInitScript(() => localStorage.setItem('adminToken', 'fixture-only'));
      let added; let exportUrl; let resultsUrl;
      const managed = { ...school, classes: school.classes.map(grade => ({ ...grade, sections: [...grade.sections] })) };
      await admin.route(`${origin}/api/**`, route => {
        const url = new URL(route.request().url());
        const method = route.request().method();
        if (url.pathname === '/api/admin/me') return json(route, { admin: { id: id(9), name: 'Fixture Admin', role: 'admin', status: 'active', permissions: ['schools'] } });
        if (url.pathname === '/api/schools/manage') return json(route, { success: true, schools: [managed] });
        if (url.pathname === `/api/schools/${id(1)}/classes/${id(11)}/sections` && method === 'POST') {
          added = route.request().postDataJSON();
          managed.classes[0].sections.push(...added.names.map((nameValue, i) => ({ _id: id(300 + i), name: nameValue })));
          return json(route, { success: true, school: managed }, 201);
        }
        if (url.pathname === `/api/schools/${id(1)}/results/export`) { exportUrl = url.search; return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers: { 'Content-Disposition': 'attachment; filename="results_APS_Class-9.xlsx"' }, body: Buffer.from('PK fixture') }); }
        if (url.pathname === `/api/schools/${id(1)}/results`) {
          resultsUrl = url.search;
          return json(route, { success: true, filters: { school: { _id: id(1), name: school.name }, className: 'Class 9', sectionName: 'Section A', from: null, to: null }, summary: { students: 2, studentsAttempted: 1, attempts: 1, averagePercentage: 80 }, rows: [{ _id: id(500), student: { name: 'Ayesha Khan', class: 'Class 9', section: 'Section A' }, test: { title: 'Motion Topic Test', subject: 'Physics', type: 'Topic test' }, startedAt: '2026-10-21T10:30:00.000Z', timeTakenSeconds: 612, score: 16, totalMarks: 20, percentage: 80, passStatus: 'pass', isPartialPractice: false }], pagination: { page: 1, limit: 25, total: 1, pages: 1 } });
        }
        return json(route, { success: true });
      });
      await admin.goto(`${origin}/admin/schools`);
      await admin.getByRole('heading', { name: 'Schools, Classes & Sections' }).waitFor();
      await admin.getByText('APS Boys and Girls DHA').first().click();
      await admin.getByText('Section A').first().waitFor();
      await admin.getByLabel('Add sections, e.g. Section A, Section B').first().fill('Section C, Section D');
      await admin.getByRole('button', { name: 'Add', exact: true }).first().click();
      await admin.getByText('Section D').waitFor();
      assert.deepEqual(added, { names: ['Section C', 'Section D'] });
      await admin.screenshot({ path: path.join(artifacts, `admin-schools-${name}.png`) });

      await admin.goto(`${origin}/admin/school-results`);
      await choose(admin, 'School', 'APS Boys and Girls DHA');
      await choose(admin, 'Class', 'Class 9');
      await choose(admin, 'Section', 'Section A');
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      await admin.getByLabel('From date').fill('2026-01-01');
      await admin.getByLabel('To date').fill(today);
      await admin.getByRole('button', { name: 'Show results' }).click();
      await admin.getByText('Motion Topic Test').waitFor();
      const query = new URLSearchParams(resultsUrl);
      assert.deepEqual([query.get('classId'), query.get('sectionId'), query.get('from'), query.get('to'), query.get('page')], [id(11), id(111), '2026-01-01', today, '1']);
      assert.ok(await admin.getByText('03:30 PM').first().isVisible(), 'attempt times show in Pakistan time');
      const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `no page-level horizontal scroll at ${width}px`);
      const [file] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: 'Download Excel' }).click()]);
      assert.equal(file.suggestedFilename(), 'results_APS_Class-9.xlsx');
      assert.equal(new URLSearchParams(exportUrl).get('sectionId'), id(111));
      await admin.fill('input[type=date] >> nth=1', '2025-12-01');
      await admin.getByText('The end date must not be before the start date.').waitFor();
      assert.equal(await admin.getByRole('button', { name: 'Download Excel' }).isDisabled(), true);
      await admin.screenshot({ path: path.join(artifacts, `admin-results-${name}.png`) });
      await admin.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: signup school/class/section flow, other and private options, result card download, school editing, admin school management and results report at desktop and mobile widths.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
