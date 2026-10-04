const express = require("express");
const {
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
    getAnswerSheets,
    saveAnswerSheet,
    updateAnswerSheet,
    deleteAnswerSheet,
} = require("../controllers/resourceController");
const authMiddleware = require("../middleware/authMiddleware");
const publishing = require('../middleware/publishingMiddleware');

const router = express.Router();

router.get("/books", require('../middleware/resourceReader'), getBooks);
router.post("/books", authMiddleware, publishing('book'), saveBook);
router.put("/books/:id", authMiddleware, publishing('book'), updateBook);
router.delete("/books/:id", authMiddleware, deleteBook);

router.get("/past-papers", getPastPapers);
router.post("/past-papers", authMiddleware, publishing('paper'), createPastPaper);
router.put("/past-papers/:id", authMiddleware, publishing('paper'), updatePastPaper);
router.delete("/past-papers/:id", authMiddleware, deletePastPaper);

router.get("/chapter-notes", require('../middleware/resourceReader'), getChapterNotes);
router.post("/chapter-notes", authMiddleware, publishing('note'), saveChapterNote);
router.delete("/chapter-notes/:id", authMiddleware, deleteChapterNote);

router.get("/answer-sheets", require('../middleware/resourceReader'), getAnswerSheets);
router.post("/answer-sheets", authMiddleware, saveAnswerSheet);
router.put("/answer-sheets/:id", authMiddleware, updateAnswerSheet);
router.delete("/answer-sheets/:id", authMiddleware, deleteAnswerSheet);

module.exports = router;
