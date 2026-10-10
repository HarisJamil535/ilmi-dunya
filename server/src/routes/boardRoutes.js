const express = require("express");

const router = express.Router();

const {
    createBoard,
    getBoards,
    updateBoard,
    deleteBoard,
} = require("../controllers/boardController");
const authMiddleware = require("../middleware/authMiddleware");
const { protectDelete } = require('../middleware/academicIntegrity');

router.post("/", authMiddleware, createBoard);
router.get("/", getBoards);
router.put("/:id", authMiddleware, updateBoard);
router.delete("/:id", authMiddleware, protectDelete('Board'), deleteBoard);

module.exports = router;
