const express = require("express");
const {
    loginAdmin,
    logoutAdmin,
    getLoggedInAdmin,
    getDashboard,
    listAdmins,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    requestAdminPasswordReset,
    resetAdminPassword,
} = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/forgot-password", requestAdminPasswordReset);
router.post("/reset-password", resetAdminPassword);

router.get("/me", authMiddleware, getLoggedInAdmin);
router.post("/logout", authMiddleware, logoutAdmin);
router.get("/dashboard", authMiddleware, getDashboard);

router.get("/admins", authMiddleware.requireSuperAdmin, listAdmins);
router.post("/admins", authMiddleware.requireSuperAdmin, createAdmin);
router.put("/admins/:id", authMiddleware.requireSuperAdmin, updateAdmin);
router.delete("/admins/:id", authMiddleware.requireSuperAdmin, deleteAdmin);

module.exports = router;
