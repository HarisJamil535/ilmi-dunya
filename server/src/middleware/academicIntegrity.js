const mongoose = require('mongoose');
const { fail } = require('../services/publishing');
const dependentModels = ['Subject', 'Chapter', 'Topic', 'Book', 'ChapterNote', 'PastPaper', 'AnswerSheet', 'Question', 'QuestionScenario', 'Assessment', 'AssessmentAttempt'];

async function assertUnused(kind, id) {
    if (!mongoose.isValidObjectId(id)) fail('Select a valid item.');
    const checks = dependentModels.flatMap(name => {
        const Model = require(`../models/${name}`);
        const fields = Object.entries(Model.schema.paths).filter(([, path]) => path.options.ref === kind).map(([field]) => ({ [field]: id }));
        return fields.length ? [Model.exists({ $or: fields })] : [];
    });
    if ((await Promise.all(checks)).some(Boolean)) {
        fail(`This ${kind.toLowerCase()} still has linked content or test history. Remove or reassign its linked content before deleting or moving it.`, 409);
    }
}

const protectDelete = kind => async (req, res, next) => {
    try { await assertUnused(kind, req.params.id); next(); }
    catch (error) { next(error); }
};

const validateWrite = kind => async (req, res, next) => {
    try {
        const body = req.body;
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) fail('Enter a name between 1 and 80 characters.');
        if (kind === 'Subject' && body.code !== undefined && (typeof body.code !== 'string' || body.code.trim().length > 24)) fail('Subject code must be 24 characters or fewer.');
        const fields = ['board', 'class', 'group', ...(kind === 'Chapter' ? ['subject'] : [])];
        if (!fields.every(field => mongoose.isValidObjectId(body[field]))) fail('Select a valid board, class, group and subject where required.');
        if (kind === 'Chapter') {
            const number = Number(body.chapterNumber);
            if (!Number.isSafeInteger(number) || number < 1) fail('Chapter number must be a whole number starting from 1.');
            const Subject = require('../models/Subject');
            if (!await Subject.exists({ _id: body.subject, board: body.board, class: body.class, group: body.group })) fail('The subject does not belong to the selected board, class and group.');
        } else {
            const parents = await Promise.all(['Board', 'Class', 'Group'].map((name, index) => require(`../models/${name}`).exists({ _id: body[fields[index]] })));
            if (parents.some(parent => !parent)) fail('A selected board, class or group no longer exists. Refresh the filters and try again.');
        }
        if (req.params.id) {
            if (!mongoose.isValidObjectId(req.params.id)) fail('Select a valid item.');
            const existing = await require(`../models/${kind}`).findById(req.params.id).lean();
            if (!existing) fail(`${kind} not found.`, 404);
            if (fields.some(field => String(existing[field]) !== String(body[field]))) await assertUnused(kind, req.params.id);
        }
        next();
    } catch (error) { next(error); }
};

module.exports = { assertUnused, protectDelete, validateWrite };
