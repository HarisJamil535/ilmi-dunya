const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const invalidate = require('../src/middleware/publicCacheInvalidation');
const { assertUnused, validateWrite } = require('../src/middleware/academicIntegrity');
const id = '111111111111111111111111';
const models = ['Subject', 'Chapter', 'Topic', 'Book', 'ChapterNote', 'PastPaper', 'AnswerSheet', 'Question', 'QuestionScenario', 'Assessment', 'AssessmentAttempt'];

test('student activity and failed writes do not evict public caches', () => {
    for (const [method, path, status, expected] of [
        ['PATCH', '/attempts/123/questions/456', 200, 0],
        ['POST', '/attempts/123/submit', 200, 0],
        ['POST', '/students/login', 200, 0],
        ['POST', '/home-content/visit', 200, 0],
        ['GET', '/subjects', 200, 0],
        ['PUT', '/subjects/123', 409, 0],
        ['POST', '/questions', 201, 1],
        ['DELETE', '/subjects/123', 200, 1],
        ['PUT', '/resources/books/123', 200, 1],
    ]) {
        let count = 0;
        const res = new EventEmitter();
        res.statusCode = status;
        invalidate(() => count++)({ method, path }, res, () => {});
        res.emit('finish');
        assert.equal(count, expected, `${method} ${path} ${status}`);
    }
});

test('academic deletes block linked questions, chapters and resources', async t => {
    for (const name of models) t.mock.method(require(`../src/models/${name}`), 'exists', async () => null);
    const Chapter = require('../src/models/Chapter');
    Chapter.exists = async () => ({ _id: id });
    await assert.rejects(assertUnused('Subject', id), error => error.status === 409);
    Chapter.exists = async () => null;
    const Question = require('../src/models/Question');
    Question.exists = async () => ({ _id: id });
    await assert.rejects(assertUnused('Topic', id), error => error.status === 409);
    Question.exists = async () => null;
    const Book = require('../src/models/Book');
    Book.exists = async () => ({ _id: id });
    await assert.rejects(assertUnused('Board', id), error => error.status === 409);
    Book.exists = async () => null;
    await assert.doesNotReject(assertUnused('Chapter', id));
    await assert.rejects(assertUnused('Subject', 'not-an-id'), error => error.status === 400);
});

test('academic writes reject invalid names, numbering and mismatched parents', async t => {
    const run = async (kind, body) => {
        let result;
        await validateWrite(kind)({ body, params: {} }, {}, error => { result = error || 'valid'; });
        return result;
    };
    const base = { name: 'Motion', board: id, class: id, group: id, subject: id, chapterNumber: 1 };
    for (const chapterNumber of [0, -1, 1.5, 'bad', Infinity]) {
        assert.equal((await run('Chapter', { ...base, chapterNumber })).status, 400);
    }
    assert.equal((await run('Subject', { ...base, name: ' ' })).status, 400);
    assert.equal((await run('Subject', { ...base, code: 'x'.repeat(25) })).status, 400);
    t.mock.method(require('../src/models/Subject'), 'exists', async () => null);
    assert.equal((await run('Chapter', base)).status, 400);
    for (const name of ['Board', 'Class', 'Group']) t.mock.method(require(`../src/models/${name}`), 'exists', async () => null);
    assert.equal((await run('Subject', base)).status, 400);
});

test('malformed academic filters return actionable 400 errors, not internal errors', async () => {
    for (const [file, method] of [['subjectController', 'getSubjects'], ['chapterController', 'getChapters']]) {
        let error;
        await require(`../src/controllers/${file}`)[method]({ query: { boardId: 'invalid' } }, {}, result => { error = result; });
        assert.equal(error.status, 400);
        assert.match(error.message, /Invalid board/);
    }
});
