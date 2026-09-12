const express = require("express");
const router = express.Router();
const {
    createSubject,
    getSubjects,
    updateSubject,
    deleteSubject,
} = require("../controllers/subjectController");

router.post("/", createSubject);
router.get("/", getSubjects);
router.put("/:id", updateSubject);
router.delete("/:id", deleteSubject);

module.exports = router;