const express = require("express");
const router = express.Router();
const { registerStudent, loginStudent, getStudentMe, requestPasswordReset, resetPassword } = require("../controllers/studentAuthController");
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/me", studentAuthMiddleware, getStudentMe);

module.exports = router;
