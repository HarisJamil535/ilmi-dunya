const express = require("express");

const router = express.Router();

const {
    createClass,
    getClass,
    deleteClass
} = require("../controllers/classController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createClass);
router.get("/", getClass);
router.delete('/:id',authMiddleware, deleteClass)

module.exports = router;
