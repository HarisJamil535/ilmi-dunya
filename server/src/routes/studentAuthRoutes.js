const express = require("express");
const router = express.Router();
const {
    authOptions,
    requestRegistrationCode,
    verifyRegistrationCode,
    registerGoogleProfile,
    loginStudent,
    getStudentMe,
    updateStudentSchool,
    requestPasswordReset,
    resetPassword,
    createGoogleNonce,
    loginWithGoogle,
} = require("../controllers/studentAuthController");
const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");

router.get("/auth-options", authOptions);
router.post("/register", requestRegistrationCode);
router.post("/register/verify", verifyRegistrationCode);
router.post("/register/google-profile", registerGoogleProfile);
router.post("/login", loginStudent);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/google/nonce", createGoogleNonce);
router.post("/google", loginWithGoogle);
router.get("/me", studentAuthMiddleware, getStudentMe);
router.put("/me/school", studentAuthMiddleware, updateStudentSchool);

module.exports = router;
