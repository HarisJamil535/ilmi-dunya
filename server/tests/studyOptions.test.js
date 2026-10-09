const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Board = require('../src/models/Board');
const ClassModel = require('../src/models/Class');
const Group = require('../src/models/Group');
const { publicRoutes, invalidatePublicPages } = require('../src/routes/publicPagesRoutes');

test('study options load in one request and reuse public data until invalidated', async (t) => {
    let reads = 0;
    const mockFind = (Model, name) => t.mock.method(Model, 'find', () => ({
        sort() { return this; },
        async lean() { reads += 1; return [{ _id: name, name }]; },
    }));
    mockFind(Board, 'Board');
    mockFind(ClassModel, 'Class');
    mockFind(Group, 'Group');
    invalidatePublicPages();
    const app = express();
    app.use(publicRoutes());
    const server = app.listen(0);
    t.after(() => { server.close(); invalidatePublicPages(); });
    const url = `http://127.0.0.1:${server.address().port}/api/study-options`;
    const first = await fetch(url);
    assert.equal(first.status, 200);
    assert.deepEqual(Object.keys(await first.json()), ['boards', 'classes', 'groups']);
    await fetch(url);
    assert.equal(reads, 3);
    invalidatePublicPages();
    await fetch(url);
    assert.equal(reads, 6);
});
