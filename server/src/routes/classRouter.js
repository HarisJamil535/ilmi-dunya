const express = require("express");

const router = express.Router();

const {
    createClass,
    getClass,
    updateClass,
    deleteClass
} = require("../controllers/classController");
const authMiddleware = require("../middleware/authMiddleware");
const { protectDelete } = require('../middleware/academicIntegrity');

router.post("/", authMiddleware, createClass);
router.get("/", getClass);
router.put("/:id", authMiddleware, updateClass);
router.delete('/:id', authMiddleware, protectDelete('Class'), deleteClass);

module.exports = router;
