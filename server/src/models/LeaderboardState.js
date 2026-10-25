const mongoose = require("mongoose");

const leaderboardStateSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, default: "global" },
        resetAt: { type: Date, default: null },
        resetBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
        // When unsubmitted tests started counting once their time runs out (services/expiredAttempts.js).
        expiredAttemptsFrom: { type: Date, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model("LeaderboardState", leaderboardStateSchema);
