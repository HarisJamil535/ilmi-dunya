const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Board = require('../src/models/Board');
const ClassModel = require('../src/models/Class');
const Group = require('../src/models/Group');
const Subject = require('../src/models/Subject');
const { publicRoutes, invalidatePublicPages } = require('../src/routes/publicPagesRoutes');

test('study options load in one request and reuse public data until invalidated', async (t) => {
    let reads = 0;
    const mockFind = (Model, rows) => t.mock.method(Model, 'find', () => ({
        sort() { return this; },
        select() { return this; },
        async lean() { reads += 1; return rows; },
    }));
    mockFind(Board, [{ _id: 'b1', name: 'Federal Board' }]);
    mockFind(ClassModel, [{ _id: 'c1', name: 'Class 9' }]);
    mockFind(Group, [{ _id: 'g1', name: 'Science' }]);
    mockFind(Subject, [{ _id: 's1', name: 'Physics', board: 'b1', class: 'c1', group: 'g1' }]);
    invalidatePublicPages();
    const app = express();
    app.use(publicRoutes());
    const server = app.listen(0);
    t.after(() => { server.close(); invalidatePublicPages(); });
    const url = `http://127.0.0.1:${server.address().port}/api/study-options`;
    const first = await fetch(url);
    assert.equal(first.status, 200);
    const body = await first.json();
    assert.deepEqual(Object.keys(body), ['boards', 'classes', 'groups', 'hubs']);
    assert.deepEqual(body.hubs, [{ board: 'Federal Board', boardHref: '/federal-board', class: 'Class 9', href: '/federal-board/class-9', order: 9 }], 'every board and class with subjects gets a crawlable hub link');
    // Three lists for the options, four for the class hubs.
    await fetch(url);
    assert.equal(reads, 7);
    invalidatePublicPages();
    await fetch(url);
    assert.equal(reads, 14);
});
