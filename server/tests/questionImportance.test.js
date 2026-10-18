const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanQuestionPayload, downloadImportTemplate } = require('../src/controllers/questionBankController');
const { readSheet } = require('read-excel-file/node');
const Question = require('../src/models/Question');
const { updateQuestionImportance } = require('../src/controllers/questionBankController');

test('importance switch changes only importance and supports switching off', async () => {
    const original = Question.findOneAndUpdate;
    let update;
    Question.findOneAndUpdate = (filter, value) => {
        assert.deepEqual(filter.contentType.$in, ['short_question', 'long_question']);
        assert.equal(filter.status.$ne, 'archived');
        update = value;
        return { select: () => ({ lean: async () => ({ _id: 'question', isImportant: value.$set.isImportant }) }) };
    };
    try {
        for (const isImportant of [true, false]) {
            let result;
            await updateQuestionImportance({ params: { id: 'question' }, body: { isImportant, questionText: 'ignored' } }, { json(value) { result = value; } });
            assert.equal(result.question.isImportant, isImportant);
            assert.deepEqual(Object.keys(update.$set).sort(), ['isImportant', 'updatedBy']);
        }
        let status;
        await updateQuestionImportance({ body: { isImportant: 'false' } }, { status(value) { status = value; return this; }, json() {} });
        assert.equal(status, 400);
    } finally { Question.findOneAndUpdate = original; }
});

for (const contentType of ['short_question', 'long_question']) {
    test(`${contentType} importance can be enabled and cleared, including Excel values`, () => {
        const base = { contentType, questionText: 'Explain computer generations.' };
        for (const value of [true, 'true', 'yes', 1]) assert.equal(cleanQuestionPayload({ ...base, isImportant: value }).isImportant, true);
        for (const value of [false, 'false', 'no', 0, '']) assert.equal(cleanQuestionPayload({ ...base, isImportant: value }).isImportant, false);
        assert.equal(Object.hasOwn(cleanQuestionPayload(base), 'isImportant'), false);
        assert.throws(() => cleanQuestionPayload({ ...base, isImportant: 'sometimes' }), /Important must/);
    });

    test(`${contentType} Excel template has importance instead of year/session`, async () => {
        let buffer;
        await downloadImportTemplate({ query: { kind: contentType } }, { setHeader() {}, send(value) { buffer = value; } });
        const rows = await readSheet(buffer);
        assert.deepEqual(rows[0], ['questionText', 'isImportant', 'language']);
        assert.equal(rows[1][1], 'true');
        assert.equal(rows[2][1], 'false');
    });
}
