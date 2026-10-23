const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const optionalAdminMiddleware = require("../middleware/optionalAdminMiddleware");
const {
    getPublishing,
    setPublishing,
    getAssessments,
    getAssessment,
    createAssessment,
    updateAssessment,
    deleteAssessment,
} = require("../controllers/assessmentController");

router.get("/publishing", authMiddleware, getPublishing);
router.post("/publishing", authMiddleware, setPublishing);
router.get("/", optionalAdminMiddleware, getAssessments);
router.get("/:id", optionalAdminMiddleware, getAssessment);
router.post("/", authMiddleware, createAssessment);
router.put("/:id", authMiddleware, updateAssessment);
router.delete("/:id", authMiddleware, deleteAssessment);

module.exports = router;
