const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { fetchRemoteImage } = require("../services/remoteImage");

const router = express.Router();

// Downloads a picture from a pasted link and hands the bytes back to the admin's browser, which then
// uploads it through the same route as a file chosen from the device (so every picture field keeps its
// own checks and storage).
router.post("/fetch-image", authMiddleware, async (req, res, next) => {
    try {
        const { buffer, contentType, extension } = await fetchRemoteImage(req.body?.url);
        res.set("Content-Type", contentType).set("Cache-Control", "no-store").set("X-Image-Extension", extension).send(buffer);
    } catch (error) { next(error); }
});

module.exports = router;
