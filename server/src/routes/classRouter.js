const express = require("express");

const router = express.Router();

const {
    createClass,
    getClass,
    updateClass,
    deleteClass
} = require("../controllers/classController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createClass);
router.get("/", getClass);
router.put("/:id", authMiddleware, updateClass);
router.delete('/:id',authMiddleware, deleteClass)

module.exports = router;
