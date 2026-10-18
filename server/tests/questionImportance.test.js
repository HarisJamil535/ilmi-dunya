const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanQuestionPayload, downloadImportTemplate } = require('../src/controllers/questionBankController');
const { readSheet } = require('read-excel-file/node');

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
