const mongoose = require('mongoose');
const { publication, fail } = require('./publishing');
const editable = ['title', 'description', 'type', 'board', 'class', 'group', 'subject', 'chapter', 'topic', 'questions', 'durationMinutes', 'passingMarks', 'instructions', 'shuffleQuestions', 'shuffleOptions', 'allowResume', 'showResultImmediately', 'showCorrectAnswers', 'maxAttempts', 'startsAt', 'endsAt', 'status'];

function assessmentPayload(body, existing = {}) {
    const payload = Object.fromEntries(editable.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
    for (const key of ['group', 'chapter', 'topic', 'startsAt', 'endsAt']) if (payload[key] === '') payload[key] = null;
    for (const key of ['allowResume', 'showResultImmediately', 'showCorrectAnswers', 'shuffleQuestions', 'shuffleOptions']) {
        if (payload[key] !== undefined && typeof payload[key] !== 'boolean') fail(`${key} must be true or false.`);
    }
    if (payload.maxAttempts !== undefined) {
        payload.maxAttempts = Number(payload.maxAttempts);
        if (!Number.isInteger(payload.maxAttempts) || payload.maxAttempts < 0 || payload.maxAttempts > 100) fail('Allowed attempts must be a whole number from 0 (unlimited) to 100.');
    }
    for (const key of ['startsAt', 'endsAt']) {
        if (payload[key] === undefined || payload[key] === null) continue;
        const date = new Date(payload[key]);
        if (typeof payload[key] !== 'string' || !Number.isFinite(date.getTime())) fail(`Choose a valid ${key === 'startsAt' ? 'opening' : 'closing'} date and time.`);
        payload[key] = date;
    }
    const merged = { ...existing, ...payload };
    Object.assign(payload, publication(body, { existing }));
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
