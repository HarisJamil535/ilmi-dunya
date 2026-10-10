const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Subject = require('../src/models/Subject');
const { createSubject, updateSubject } = require('../src/controllers/subjectController');

test('subject image is optional for existing records', async () => {
    const subject = new Subject({ name: 'Physics', board: '111111111111111111111111', class: '222222222222222222222222', group: '333333333333333333333333' });
    assert.equal(subject.cardImage, '');
    await subject.validate();
});

test('subject writes validate image paths and preserve images when omitted', async () => {
    const findOne = Subject.findOne;
    const update = Subject.findByIdAndUpdate;
    Subject.findOne = async () => null;
    const body = { name: 'Physics', board: '111111111111111111111111', class: '222222222222222222222222', group: '333333333333333333333333' };
    const res = { status() { return this; }, json() {} };
    try {
        let error;
        await createSubject({ body: { ...body, cardImage: '/uploads/subjects/../../secret.svg' } }, res, e => { error = e; });
        assert.equal(error.status, 400);
        let payload;
        Subject.findByIdAndUpdate = async (id, values) => { payload = values; return { populate: async () => values }; };
        await updateSubject({ params: { id: '444444444444444444444444' }, body }, res, e => { throw e; });
        assert.equal(Object.hasOwn(payload, 'cardImage'), false);
        const image = '/uploads/subjects/12345678-abcd-1234-abcd-123456789abc.webp';
        await updateSubject({ params: { id: '444444444444444444444444' }, body: { ...body, cardImage: image } }, res, e => { throw e; });
        assert.equal(payload.cardImage, image);
        await updateSubject({ params: { id: '444444444444444444444444' }, body: { ...body, cardImage: '' } }, res, e => { throw e; });
        assert.equal(payload.cardImage, '');
    } finally { Subject.findOne = findOne; Subject.findByIdAndUpdate = update; }
});

test('subject image uploads require admin authentication', async () => {
    const app = express();
    app.use('/api/subjects', require('../src/routes/subjectRoutes'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/subjects/upload-image`, { method: 'POST' });
        assert.equal(response.status, 401);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('permitted admins upload signature-checked images with a size limit', async t => {
    const Admin = require('../src/models/Admin');
    const jwt = require('jsonwebtoken');
    const fs = require('node:fs/promises');
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-only-subject-image-upload-secret';
    t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
    t.mock.method(Admin, 'findById', () => ({ select: async () => ({ role: 'admin', status: 'active', currentSessionId: 'current', permissions: ['academic'] }) }));
    let stored;
    t.mock.method(fs, 'mkdir', async () => {});
    t.mock.method(fs, 'writeFile', async (file, bytes) => { stored = bytes; });
    const app = express();
    app.use('/api/subjects', require('../src/routes/subjectRoutes'));
    app.use(require('../src/middleware/requestSafety').errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const token = jwt.sign({ id: '111111111111111111111111', role: 'admin', sid: 'current' }, process.env.JWT_SECRET);
    const upload = bytes => {
        const form = new FormData();
        form.append('image', new Blob([bytes], { type: 'image/png' }), 'subject.png');
        return fetch(`http://127.0.0.1:${server.address().port}/api/subjects/upload-image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    };
    assert.equal((await upload(Buffer.from('<svg onload="alert(1)"></svg>'))).status, 400);
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(12)]);
    const response = await upload(png);
    assert.equal(response.status, 201);
    assert.match((await response.json()).imageUrl, /^\/uploads\/subjects\/[a-f0-9-]+\.png$/);
    assert.deepEqual(stored, png);
    assert.equal((await upload(Buffer.alloc(1024 * 1024 + 1))).status, 413);
});
