const express = require("express");

const router = express.Router();

const {
    createBoard,
    getBoards,
    updateBoard,
    deleteBoard,
} = require("../controllers/boardController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createBoard);
router.get("/", getBoards);
router.put("/:id", authMiddleware, updateBoard);
router.delete("/:id", authMiddleware, deleteBoard);

module.exports = router;
