const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const optionalAdminMiddleware = require("../middleware/optionalAdminMiddleware");
const {
    getAssessments,
    getAssessment,
    createAssessment,
    updateAssessment,
    deleteAssessment,
    generateRandomAssessment,
} = require("../controllers/assessmentController");

router.get("/", optionalAdminMiddleware, getAssessments);
router.get("/:id", optionalAdminMiddleware, getAssessment);
router.post("/", authMiddleware, createAssessment);
router.put("/:id", authMiddleware, updateAssessment);
router.delete("/:id", authMiddleware, deleteAssessment);
router.post("/builder/random", authMiddleware, generateRandomAssessment);

module.exports = router;
