const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const schools = require("../controllers/schoolController");
const results = require("../controllers/schoolResultsController");

// Students read the list while registering; everything else needs the "schools" permission.
router.get("/", schools.getPublicSchools);
router.get("/manage", authMiddleware, schools.getManagedSchools);
router.post("/", authMiddleware, schools.createSchool);
router.put("/:id", authMiddleware, schools.updateSchool);
router.delete("/:id", authMiddleware, schools.deleteSchool);

router.post("/:id/classes", authMiddleware, schools.addClasses);
router.put("/:id/classes/:classId", authMiddleware, schools.updateClass);
router.delete("/:id/classes/:classId", authMiddleware, schools.deleteClass);

router.post("/:id/classes/:classId/sections", authMiddleware, schools.addSections);
router.put("/:id/classes/:classId/sections/:sectionId", authMiddleware, schools.updateSection);
router.delete("/:id/classes/:classId/sections/:sectionId", authMiddleware, schools.deleteSection);

router.get("/:id/results", authMiddleware, results.getSchoolResults);
router.get("/:id/results/export", authMiddleware, results.exportSchoolResults);
router.get("/:id/results/subjects", authMiddleware, results.getResultSubjects);
router.get("/:id/results/pdf", authMiddleware, results.exportSchoolResultsPdf);

module.exports = router;
