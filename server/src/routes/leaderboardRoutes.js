const express = require("express");
const router = express.Router();
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");
const { getLeaderboard, getMyRanking } = require("../controllers/leaderboardController");

router.get("/", getLeaderboard);
router.get("/me", studentAuthMiddleware, getMyRanking);

module.exports = router;
