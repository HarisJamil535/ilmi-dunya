const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Chapter = require('../src/models/Chapter');
const ChapterNote = require('../src/models/ChapterNote');
const { saveChapterNote, getChapterNotes } = require('../src/controllers/resourceController');

const id = () => new Types.ObjectId();
const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('exercise notes save against the selected chapter and inherit its syllabus', async t => {
    const chapter = { _id: id(), board: id(), class: id(), group: id(), subject: id() };
    const pdfUrl = 'https://example.com/fbise-class-10-exercise.pdf';
    let filter;
    let saved;
    t.mock.method(Chapter, 'findById', async () => chapter);
    t.mock.method(ChapterNote, 'findOneAndUpdate', (query, payload) => {
        filter = query;
        saved = payload;
        return { populate: async () => ({ ...payload, _id: id() }) };
    });
    const res = response();
    await saveChapterNote({ body: { title: 'Chapter 2 Exercise Notes', noteType: 'exercise', pdfUrl, chapter: String(chapter._id) }, publication: {} }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(filter, { chapter: String(chapter._id), noteType: 'exercise' });
    assert.equal(String(saved.subject), String(chapter.subject));
    assert.equal(saved.pdfUrl, pdfUrl);
});

test('signed-out readers can see exercise-note availability but not its PDF URL', async t => {
    let projection;
    t.mock.method(ChapterNote, 'find', () => ({ select(value) { projection = value; return this; }, populate() { return this; }, sort: async () => [{ noteType: 'exercise', title: 'Exercise Notes' }] }));
    const res = response();
    await getChapterNotes({ query: {} }, res, error => { throw error; });
    assert.equal(projection, '-pdfUrl');
    assert.equal(res.body.notes[0].noteType, 'exercise');
});
