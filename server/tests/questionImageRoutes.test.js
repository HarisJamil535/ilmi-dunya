const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Admin = require('../src/models/Admin');

test('admin uploads a validated question diagram and students can load it', async t => {
    process.env.JWT_SECRET = 'test-only-secret-not-for-production-12345678';
    t.mock.method(Admin, 'findById', () => ({ select: async () => ({ role: 'super_admin', status: 'active', currentSessionId: 'current' }) }));
    const originalBucket = Object.getOwnPropertyDescriptor(mongoose.mongo, 'GridFSBucket');
    const fileId = new mongoose.Types.ObjectId();
    let stored;
    class MemoryBucket {
        openUploadStream() {
            const stream = new Writable({ write(chunk, encoding, done) { stored = Buffer.from(chunk); done(); } });
            stream.id = fileId;
            return stream;
        }
        find() { return { next: async () => stored ? { _id: fileId, length: stored.length, metadata: { contentType: 'image/png' } } : null }; }
        openDownloadStream() { return Readable.from([stored]); }
    }
    Object.defineProperty(mongoose.mongo, 'GridFSBucket', { value: MemoryBucket, configurable: true });
    t.after(() => Object.defineProperty(mongoose.mongo, 'GridFSBucket', originalBucket));
    const app = require('../server');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const token = jwt.sign({ id: String(new mongoose.Types.ObjectId()), role: 'super_admin', sid: 'current' }, process.env.JWT_SECRET);
    const upload = async (bytes, type) => {
        const form = new FormData();
        form.append('image', new Blob([bytes], { type }), 'diagram.png');
        return fetch(`${origin}/api/questions/images`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    };
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(12)]);
    const invalid = await upload(Buffer.from('<svg onload="alert(1)"></svg>'), 'image/png');
    assert.equal(invalid.status, 400);
    const saved = await upload(png, 'image/png');
    assert.equal(saved.status, 201);
    const { imageUrl } = await saved.json();
    assert.equal(imageUrl, `/api/questions/images/${fileId}`);
    const downloaded = await fetch(origin + imageUrl);
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
});
