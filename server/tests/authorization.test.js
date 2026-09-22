const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Admin = require('../src/models/Admin');
const Student = require('../src/models/Student');
const adminAuth = require('../src/middleware/authMiddleware');
const studentAuth = require('../src/middleware/studentAuthMiddleware');
process.env.JWT_SECRET = 'test-only-secret-not-for-production-12345678';
const response = () => ({ status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } });
const request = payload => ({ headers: { authorization: `Bearer ${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' })}` }, originalUrl: '/api/news' });

test('admin writes require an active permitted session and reject student tokens', async t => {
    const admin = { status: 'active', role: 'admin', currentSessionId: 'current', permissions: ['academic'] };
    t.mock.method(Admin, 'findById', () => ({ select: async () => admin }));
    for (const [payload, expected] of [
        [{ id: '1', role: 'student' }, 401],
        [{ id: '1', role: 'admin' }, 401],
        [{ id: '1', role: 'admin', sid: 'old' }, 401],
        [{ id: '1', role: 'admin', sid: 'current' }, 403],
    ]) {
        const res = response();
        await adminAuth(request(payload), res, () => assert.fail('Unauthorized request passed'));
        assert.equal(res.code, expected);
    }
    admin.role = 'super_admin';
    let passed = false;
    await adminAuth(request({ id: '1', role: 'super_admin', sid: 'current' }), response(), () => { passed = true; });
    assert.equal(passed, true);
});

test('student password reset versions revoke old tokens', async t => {
    t.mock.method(Student, 'findById', () => ({ select: async () => ({ status: 'active', tokenVersion: 2 }) }));
    const res = response();
    await studentAuth(request({ id: '1', role: 'student', ver: 1 }), res, () => assert.fail('Revoked token passed'));
    assert.equal(res.code, 401);
    let passed = false;
    await studentAuth(request({ id: '1', role: 'student', ver: 2 }), response(), () => { passed = true; });
    assert.equal(passed, true);
});

test('mounted private and write APIs reject missing authentication before database access', async () => {
    const app = require('../server');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
        const routes = [
            ['POST', '/api/boards'], ['POST', '/api/classes'], ['POST', '/api/groups'],
            ['POST', '/api/subjects'], ['POST', '/api/chapters'], ['POST', '/api/topics'],
            ['POST', '/api/resources/books'], ['POST', '/api/resources/past-papers'], ['POST', '/api/resources/chapter-notes'],
            ['POST', '/api/news'], ['POST', '/api/questions'], ['POST', '/api/assessments'],
            ['GET', '/api/admin/me'], ['GET', '/api/students/me'], ['POST', '/api/attempts/start'],
            ['GET', '/api/home-content/testimonials'], ['GET', '/api/home-content/stats'], ['GET', '/api/student-dashboard/summary'],
        ];
        for (const [method, path] of routes) {
            const result = await fetch(origin + path, { method });
            assert.equal(result.status, 401, `${method} ${path}`);
            assert.match(result.headers.get('x-robots-tag'), /noindex/);
        }
        const bad = await fetch(origin + '/api/students/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: { $ne: null } }) });
        assert.equal(bad.status, 400);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('public book metadata excludes download URLs until a reader authenticates', async t => {
    const Book = require('../src/models/Book');
    const { getBooks } = require('../src/controllers/resourceController');
    let projection;
    t.mock.method(Book, 'find', () => ({ select(value) { projection = value; return this; }, populate() { return this; }, sort: async () => [] }));
    await getBooks({ query: {} }, response(), error => { throw error; });
    assert.equal(projection, '-pdfUrl');
    await getBooks({ query: {}, student: { id: 'reader' } }, response(), error => { throw error; });
    assert.equal(projection, '');
});
