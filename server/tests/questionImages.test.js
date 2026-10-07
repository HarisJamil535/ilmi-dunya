const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanQuestionPayload } = require('../src/controllers/questionBankController');

test('question diagrams accept one uploaded image and require an accessible description', () => {
    const imageUrl = '/api/questions/images/1234567890abcdef12345678';
    const base = { contentType: 'mcq', questionText: 'What does the graph show?', options: [{ key: 'A', text: 'Motion' }, { key: 'B', text: 'Rest' }], correctOption: 'A' };
    const saved = cleanQuestionPayload({ ...base, imageUrls: [imageUrl], imageAlt: 'A straight distance-time graph.' }, undefined);
    assert.deepEqual(saved.imageUrls, [imageUrl]);
    assert.equal(saved.imageAlt, 'A straight distance-time graph.');
    assert.throws(() => cleanQuestionPayload({ ...base, imageUrls: [imageUrl] }), /Describe the uploaded diagram/);
    assert.throws(() => cleanQuestionPayload({ ...base, imageUrls: ['https://example.com/diagram.svg'], imageAlt: 'Diagram' }), /uploaded JPG/);
    assert.throws(() => cleanQuestionPayload({ ...base, imageUrls: [imageUrl, imageUrl], imageAlt: 'Diagram' }), /one uploaded/);
});

test('written questions cannot retain an MCQ diagram', () => {
    const saved = cleanQuestionPayload({ contentType: 'short_question', questionText: 'Explain motion.', imageUrls: ['/api/questions/images/1234567890abcdef12345678'], imageAlt: 'A graph.' }, undefined);
    assert.deepEqual(saved.imageUrls, []);
    assert.equal(saved.imageAlt, '');
});
