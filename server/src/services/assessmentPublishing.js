const mongoose = require('mongoose');
const { publication, fail } = require('./publishing');
const editable = ['title', 'description', 'type', 'board', 'class', 'group', 'subject', 'chapter', 'topic', 'questions', 'selectionMode', 'randomConfig', 'durationMinutes', 'passingMarks', 'instructions', 'shuffleQuestions', 'shuffleOptions', 'allowResume', 'showResultImmediately', 'showCorrectAnswers', 'maxAttempts', 'startsAt', 'endsAt', 'status'];

function assessmentPayload(body, existing = {}) {
    const payload = Object.fromEntries(editable.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
    for (const key of ['group', 'chapter', 'topic']) if (payload[key] === '') payload[key] = null;
    const merged = { ...existing, ...payload };
    Object.assign(payload, publication(body, { existing, requireSummary: merged.status === 'published' }));
    for (const key of ['board', 'class', 'subject']) if (!mongoose.isValidObjectId(merged[key])) fail(`Choose a valid ${key}.`);
    for (const key of ['group', 'chapter', 'topic']) if (merged[key] && !mongoose.isValidObjectId(merged[key])) fail(`Choose a valid ${key}.`);
    if (merged.type === 'chapter_test' && !merged.chapter) fail('Choose a chapter for a chapter test.');
    if (merged.type === 'topic_test' && !merged.topic) fail('Choose a topic for a topic test.');
    if (merged.questions && (!Array.isArray(merged.questions) || merged.questions.length > 500)) fail('Select at most 500 MCQs per test.');
    if (merged.status === 'published' && !merged.questions?.length) fail('Add MCQs before publishing a test.');
    if (merged.durationMinutes !== undefined && (!Number.isFinite(Number(merged.durationMinutes)) || Number(merged.durationMinutes) < 1 || Number(merged.durationMinutes) > 1440)) fail('Use a test duration between 1 and 1440 minutes.');
    if (merged.passingMarks !== undefined && (!Number.isFinite(Number(merged.passingMarks)) || Number(merged.passingMarks) < 0)) fail('Passing marks must be a non-negative number.');
    if (merged.startsAt && merged.endsAt && new Date(merged.endsAt) <= new Date(merged.startsAt)) fail('The closing date must follow the opening date.');
    return payload;
}
module.exports = { assessmentPayload };
