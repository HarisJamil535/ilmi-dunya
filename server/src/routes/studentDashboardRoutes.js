const express = require("express");
const router = express.Router();
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");
const { getDashboardSummary, downloadResultCard } = require("../controllers/studentDashboardController");

router.get("/summary", studentAuthMiddleware, getDashboardSummary);
router.get("/result-card", studentAuthMiddleware, downloadResultCard);

module.exports = router;
