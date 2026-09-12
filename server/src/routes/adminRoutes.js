const express = require("express");

const router = express.Router();

const {loginAdmin} = require('../controllers/adminController');
const authMiddleware = require("../middleware/authMiddleware");
const {getLoggedInAdmin} = require('../controllers/adminController')
const {getDashboard} = require('../controllers/adminController')

router.post("/login", loginAdmin);

router.get("/me", authMiddleware, getLoggedInAdmin);

router.get("/dashboard", authMiddleware, getDashboard);



module.exports = router;