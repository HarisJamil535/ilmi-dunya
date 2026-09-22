const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getAssessmentAnalytics } = require("../controllers/analyticsController");

router.get("/assessments/:assessmentId", authMiddleware, getAssessmentAnalytics);

module.exports = router;
