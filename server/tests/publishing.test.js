const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publication, validateNews, safeUrl, slugify } = require('../src/services/publishing');
const { assessmentPayload } = require('../src/services/assessmentPublishing');
const { unsafeKeys, errorHandler } = require('../src/middleware/requestSafety');
const { imageExtension } = require('../src/services/imageUpload');
const summary = 'A teacher-written guide to Class 10 Physics, covering motion definitions, worked examples and revision questions for board exam preparation.';

test('publishing normalizes tags and rejects thin or unsafe resources', () => {
    assert.deepEqual(publication({ summary, tags: 'Physics, physics, FBISE' }, { requireSummary: true }).tags, ['physics', 'fbise']);
    assert.throws(() => publication({ summary: 'Download' }, { requireSummary: true }), /useful summary/);
    assert.throws(() => publication({ sourceUrl: 'javascript:alert(1)' }), /HTTP/);
    assert.throws(() => publication({ fileName: '../secret.pdf' }), /filename/);
    assert.throws(() => publication({ slug: 'Class 10' }), /slug/);
    assert.equal(safeUrl('https://user:password@example.com'), false);
    assert.equal(safeUrl('/uploads/news/safe.webp', { localImage: true }), true);
    assert.equal(safeUrl('/uploads/news/../../x.svg', { localImage: true }), false);
    assert.equal(slugify('FBISE Class 10 Physics'), 'fbise-class-10-physics');
});

test('article editing preserves the original publication date and stable URL', () => {
    const existing = { title: 'Physics exam guide', excerpt: summary, content: summary.repeat(3), slug: 'physics-exam-guide', publishedAt: new Date('2025-01-01'), isPublished: true };
    const result = validateNews({ title: 'Updated guide', publishedAt: new Date(), createdBy: 'attacker' }, existing);
    assert.equal(result.publishedAt, existing.publishedAt);
    assert.equal(result.slug, existing.slug);
    assert.equal(result.createdBy, undefined);
    assert.throws(() => validateNews({ slug: 'changed' }, existing), /permanent/);
    assert.throws(() => validateNews({ coverImage: 'https://example.com/photo.jpg' }, existing), /Describe/);
    assert.throws(() => validateNews({ content: 'thin' }, existing), /complete article/);
});

test('test publishing rejects empty tests, invalid durations and protected fields', () => {
    const base = { board: '111111111111111111111111', class: '222222222222222222222222', subject: '333333333333333333333333', type: 'subject_test', summary, status: 'published', questions: [{ question: '444444444444444444444444' }] };
    assert.throws(() => assessmentPayload({ ...base, questions: [] }), /Add MCQs/);
    assert.throws(() => assessmentPayload({ ...base, durationMinutes: Infinity }), /duration/);
    assert.throws(() => assessmentPayload({ ...base, passingMarks: -1 }), /Passing marks/);
    const result = assessmentPayload({ ...base, createdBy: 'attacker', totalMarks: 9999, chapter: '' });
    assert.equal(result.createdBy, undefined);
    assert.equal(result.totalMarks, undefined);
    assert.equal(result.chapter, null);
});

test('request safety rejects query operators while allowing ordinary question text', () => {
    assert.equal(unsafeKeys({ email: { $ne: null } }), true);
    assert.equal(unsafeKeys({ 'profile.name': 'bad' }), true);
    assert.equal(unsafeKeys({ question: 'What does $ mean?', topicNumber: '2.3.5' }), false);
});

test('error responses hide internal errors and use actionable status codes', () => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    errorHandler(new Error('mongodb://private-host/credentials'), {}, res, () => {});
    assert.equal(res.code, 500);
    assert.doesNotMatch(res.body.message, /private-host/);
    errorHandler({ code: 11000 }, {}, res, () => {});
    assert.equal(res.code, 409);
    errorHandler({ name: 'CastError' }, {}, res, () => {});
    assert.equal(res.code, 400);
});

test('news uploads reject SVG and fake image extensions using byte signatures', () => {
    assert.throws(() => imageExtension(Buffer.from('<svg onload="alert(1)"></svg>')), /JPG, PNG or WebP/);
    assert.equal(imageExtension(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(10)])), '.png');
    assert.equal(imageExtension(Buffer.from('RIFFxxxxWEBPxxxx')), '.webp');
    assert.throws(() => imageExtension(Buffer.from('short')), /invalid/);
});
