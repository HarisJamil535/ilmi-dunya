const mongoose = require("mongoose");

const leaderboardStateSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, default: "global" },
        resetAt: { type: Date, default: null },
        resetBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model("LeaderboardState", leaderboardStateSchema);
