const mongoose = require("mongoose");
const { fail } = require("../services/publishing");
const Book = require("../models/Book");
const PastPaper = require("../models/PastPaper");
const ChapterNote = require("../models/ChapterNote");
const Chapter = require("../models/Chapter");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isValidUrl = (value) => {
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
};

const requireContext = ({ board, class: classId, group, subject }) => {
    if (![board, classId, group, subject].every(isValidObjectId)) {
        return "Please select a valid Board, Class, Group, and Subject.";
    }
    return null;
};

const contextFilter = (query) => {
    const filter = {};
    ["board", "class", "group", "subject"].forEach((field) => {
        if (query[field] && !isValidObjectId(query[field])) fail(`Invalid ${field} filter.`);
        if (query[field] && isValidObjectId(query[field])) {
            filter[field] = query[field];
        }
    });
    return filter;
};

const populateContext = ["board", "class", "group", "subject"];

const getBooks = async (req, res, next) => {
    try {
        const books = await Book.find(contextFilter(req.query))
            .select(req.admin || req.student ? '' : '-pdfUrl')
            .populate(populateContext)
            .sort({ updatedAt: -1 });

        res.status(200).json({ success: true, count: books.length, books });
    } catch (error) {
        next(error);
    }
};

const saveBook = async (req, res, next) => {
    try {
        const { title, pdfUrl, board, class: classId, group, subject } = req.body;
        const contextError = requireContext({ board, class: classId, group, subject });

        if (!title?.trim() || !pdfUrl?.trim()) {
            return res.status(400).json({ success: false, message: "Book title and PDF URL are required." });
        }
        if (contextError) return res.status(400).json({ success: false, message: contextError });
        if (!isValidUrl(pdfUrl.trim())) {
            return res.status(400).json({ success: false, message: "Please enter a valid PDF URL." });
        }

        const book = await Book.create({ ...req.publication, title: title.trim(), pdfUrl: pdfUrl.trim(), board, class: classId, group, subject });
        await book.populate(populateContext);

        res.status(200).json({ success: true, message: "Book saved successfully", book });
    } catch (error) {
        next(error);
    }
};

const updateBook = async (req, res, next) => {
    try {
        const { title, pdfUrl, board, class: classId, group, subject } = req.body;
        const contextError = requireContext({ board, class: classId, group, subject });

        if (!title?.trim() || !pdfUrl?.trim()) {
            return res.status(400).json({ success: false, message: "Book title and PDF URL are required." });
        }
        if (contextError) return res.status(400).json({ success: false, message: contextError });
        if (!isValidUrl(pdfUrl.trim())) {
            return res.status(400).json({ success: false, message: "Please enter a valid PDF URL." });
        }

        const duplicateBook = await Book.findOne({
            _id: { $ne: req.params.id },
            board,
            class: classId,
            group,
            subject,
        });

        if (duplicateBook) {
            return res.status(409).json({ success: false, message: "A book already exists for this board, class, group and subject." });
        }

        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { ...req.publication, title: title.trim(), pdfUrl: pdfUrl.trim(), board, class: classId, group, subject },
            { new: true, runValidators: true }
        ).populate(populateContext);

        if (!book) return res.status(404).json({ success: false, message: "Book not found" });
        res.status(200).json({ success: true, message: "Book updated successfully", book });
    } catch (error) {
        next(error);
    }
};

const deleteBook = async (req, res, next) => {
    try {
        const deletedBook = await Book.findByIdAndDelete(req.params.id);
        if (!deletedBook) return res.status(404).json({ success: false, message: "Book not found" });
        res.status(200).json({ success: true, message: "Book deleted successfully" });
    } catch (error) {
        next(error);
    }
};

const getPastPapers = async (req, res, next) => {
    try {
        const papers = await PastPaper.find(contextFilter(req.query))
            .populate(populateContext)
            .sort({ year: -1, session: 1, createdAt: -1 });

        res.status(200).json({ success: true, count: papers.length, papers });
    } catch (error) {
        next(error);
    }
};

const createPastPaper = async (req, res, next) => {
    try {
        const { title, year, session, pdfUrl, board, class: classId, group, subject } = req.body;
        const contextError = requireContext({ board, class: classId, group, subject });
        const parsedYear = Number(year);

        if (!title?.trim() || !pdfUrl?.trim() || !session || !parsedYear) {
            return res.status(400).json({ success: false, message: "Title, year, session, and PDF URL are required." });
        }
        if (contextError) return res.status(400).json({ success: false, message: contextError });
        if (!["morning", "evening"].includes(session)) {
            return res.status(400).json({ success: false, message: "Session must be morning or evening." });
        }
        if (!isValidUrl(pdfUrl.trim())) {
            return res.status(400).json({ success: false, message: "Please enter a valid PDF URL." });
        }

        const paper = await PastPaper.create({
            ...req.publication,
            title: title.trim(),
            year: parsedYear,
            session,
            pdfUrl: pdfUrl.trim(),
            board,
            class: classId,
            group,
            subject,
        });

        await paper.populate(populateContext);
        res.status(201).json({ success: true, message: "Past paper saved successfully", paper });
    } catch (error) {
        next(error);
    }
};

const updatePastPaper = async (req, res, next) => {
    try {
        const { title, year, session, pdfUrl, board, class: classId, group, subject } = req.body;
        const contextError = requireContext({ board, class: classId, group, subject });
        const parsedYear = Number(year);

        if (!title?.trim() || !pdfUrl?.trim() || !session || !parsedYear) {
            return res.status(400).json({ success: false, message: "Title, year, session, and PDF URL are required." });
        }
        if (contextError) return res.status(400).json({ success: false, message: contextError });
        if (!isValidUrl(pdfUrl.trim())) {
            return res.status(400).json({ success: false, message: "Please enter a valid PDF URL." });
        }

        const paper = await PastPaper.findByIdAndUpdate(
            req.params.id,
            { ...req.publication, title: title.trim(), year: parsedYear, session, pdfUrl: pdfUrl.trim(), board, class: classId, group, subject },
            { new: true, runValidators: true }
        ).populate(populateContext);

        if (!paper) return res.status(404).json({ success: false, message: "Past paper not found" });
        res.status(200).json({ success: true, message: "Past paper updated successfully", paper });
    } catch (error) {
        next(error);
    }
};

const deletePastPaper = async (req, res, next) => {
    try {
        const deletedPaper = await PastPaper.findByIdAndDelete(req.params.id);
        if (!deletedPaper) return res.status(404).json({ success: false, message: "Past paper not found" });
        res.status(200).json({ success: true, message: "Past paper deleted successfully" });
    } catch (error) {
        next(error);
    }
};

const getChapterNotes = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.chapter && !isValidObjectId(req.query.chapter)) fail("Invalid chapter filter.");
        if (req.query.chapter && isValidObjectId(req.query.chapter)) filter.chapter = req.query.chapter;

        const notes = await ChapterNote.find(filter)
            .select(req.admin || req.student ? '' : '-pdfUrl')
            .populate(["chapter", ...populateContext])
            .sort({ noteType: 1 });

        res.status(200).json({ success: true, count: notes.length, notes });
    } catch (error) {
        next(error);
    }
};

const saveChapterNote = async (req, res, next) => {
    try {
        const { title, noteType, pdfUrl, chapter } = req.body;

        if (!title?.trim() || !noteType || !pdfUrl?.trim() || !isValidObjectId(chapter)) {
            return res.status(400).json({ success: false, message: "Title, note type, PDF URL, and chapter are required." });
        }
        if (!["short_questions", "long_questions", "mcqs"].includes(noteType)) {
            return res.status(400).json({ success: false, message: "Invalid note type." });
        }
        if (!isValidUrl(pdfUrl.trim())) {
            return res.status(400).json({ success: false, message: "Please enter a valid PDF URL." });
        }

        const parentChapter = await Chapter.findById(chapter);
        if (!parentChapter) return res.status(404).json({ success: false, message: "Chapter not found." });

        const note = await ChapterNote.findOneAndUpdate(
            { chapter, noteType },
            {
                ...req.publication,
                title: title.trim(),
                noteType,
                pdfUrl: pdfUrl.trim(),
                chapter,
                board: parentChapter.board,
                class: parentChapter.class,
                group: parentChapter.group,
                subject: parentChapter.subject,
            },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).populate(["chapter", ...populateContext]);

        res.status(200).json({ success: true, message: "Chapter note saved successfully", note });
    } catch (error) {
        next(error);
    }
};

const deleteChapterNote = async (req, res, next) => {
    try {
        const deletedNote = await ChapterNote.findByIdAndDelete(req.params.id);
        if (!deletedNote) return res.status(404).json({ success: false, message: "Chapter note not found" });
        res.status(200).json({ success: true, message: "Chapter note deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBooks,
    saveBook,
    updateBook,
    deleteBook,
    getPastPapers,
    createPastPaper,
    updatePastPaper,
    deletePastPaper,
    getChapterNotes,
    saveChapterNote,
    deleteChapterNote,
};
