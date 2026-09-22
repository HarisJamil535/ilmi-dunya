const express = require("express");
const router = express.Router();
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");
const { getDashboardSummary } = require("../controllers/studentDashboardController");

router.get("/summary", studentAuthMiddleware, getDashboardSummary);

module.exports = router;
