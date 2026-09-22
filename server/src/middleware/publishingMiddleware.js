const { publication, fail, safeUrl } = require('../services/publishing');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Book = require('../models/Book');
const PastPaper = require('../models/PastPaper');
const ChapterNote = require('../models/ChapterNote');
const mongoose = require('mongoose');

module.exports = kind => async (req, res, next) => {
    try {
        if (typeof req.body.title !== 'string' || !req.body.title.trim() || req.body.title.length > 180) fail('Enter a clear title of at most 180 characters.');
        if (typeof req.body.pdfUrl !== 'string' || !req.body.pdfUrl.trim() || !safeUrl(req.body.pdfUrl)) fail('Enter a valid HTTP or HTTPS PDF URL without embedded credentials.');
        const Model = { book: Book, paper: PastPaper, note: ChapterNote }[kind];
        let existing = null;
        if (req.params.id) {
            if (!mongoose.isValidObjectId(req.params.id)) fail('Choose a valid resource.');
            existing = await Model.findById(req.params.id).lean();
            if (!existing) fail('Resource not found.', 404);
        }
        if (kind === 'note') {
            if (!mongoose.isValidObjectId(req.body.chapter)) fail('Choose a valid chapter.');
            const chapter = await Chapter.findById(req.body.chapter).lean();
            if (!chapter) fail('The selected chapter no longer exists.');
            existing = await ChapterNote.findOne({ chapter: chapter._id, noteType: req.body.noteType }).lean();
        } else {
            const fields = ['board', 'class', 'group', 'subject'];
            if (!fields.every(key => mongoose.isValidObjectId(req.body[key]))) fail('Select a valid board, class, group and subject.');
            const subject = await Subject.findOne({ _id: req.body.subject, board: req.body.board, class: req.body.class, group: req.body.group }).lean();
            if (!subject) fail('The subject does not belong to the selected board, class and group.');
        }
        if (kind === 'paper') {
            const year = Number(req.body.year);
            if (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear()) fail('Enter the actual past paper year between 1990 and this year.');
            const duplicate = await PastPaper.exists({ ...(existing ? { _id: { $ne: existing._id } } : {}), board: req.body.board, class: req.body.class, group: req.body.group, subject: req.body.subject, year, session: req.body.session, title: String(req.body.title || '').trim() });
            if (duplicate) fail('This past paper already exists. Edit that paper or distinguish its paper/part in the title.', 409);
        }
        req.publication = publication(req.body, { existing: existing || {}, requireSummary: true });
        next();
    } catch (error) { next(error); }
};
