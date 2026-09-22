const express = require("express");
const router = express.Router();
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");
const {
    startAttempt,
    getAttemptById,
    saveAnswer,
    submitAttempt,
    getResult,
    getStudentAttempts,
} = require("../controllers/attemptController");

router.use(studentAuthMiddleware);
router.get("/", getStudentAttempts);
router.post("/start", startAttempt);
router.get("/:id", getAttemptById);
router.patch("/:id/questions/:questionId", saveAnswer);
router.post("/:id/submit", submitAttempt);
router.get("/:id/result", getResult);

module.exports = router;
