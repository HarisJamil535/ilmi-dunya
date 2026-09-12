const express = require("express");
const router = express.Router();
const {
    createSubject,
    getSubjects,
    updateSubject,
    deleteSubject,
} = require("../controllers/subjectController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createSubject);
router.get("/", getSubjects);
router.put("/:id", authMiddleware, updateSubject);
router.delete("/:id", authMiddleware, deleteSubject);

module.exports = router;
