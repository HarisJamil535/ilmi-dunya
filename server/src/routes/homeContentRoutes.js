const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    getPublicHomeContent,
    getTestimonials,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    getStats,
    createStat,
    updateStat,
    deleteStat,
    recordVisit,
} = require("../controllers/homeContentController");

router.get("/", getPublicHomeContent);
router.post("/visit", recordVisit);

router.get("/testimonials", authMiddleware, getTestimonials);
router.post("/testimonials", authMiddleware, createTestimonial);
router.put("/testimonials/:id", authMiddleware, updateTestimonial);
router.delete("/testimonials/:id", authMiddleware, deleteTestimonial);

router.get("/stats", authMiddleware, getStats);
router.post("/stats", authMiddleware, createStat);
router.put("/stats/:id", authMiddleware, updateStat);
router.delete("/stats/:id", authMiddleware, deleteStat);

module.exports = router;
