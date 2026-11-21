const express = require("express");
const router = express.Router();
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");
const { getLeaderboard, getMyRanking, getLeaderboardSchools } = require("../controllers/leaderboardController");

router.get("/", getLeaderboard);
router.get("/schools", getLeaderboardSchools);
router.get("/me", studentAuthMiddleware, getMyRanking);

module.exports = router;
