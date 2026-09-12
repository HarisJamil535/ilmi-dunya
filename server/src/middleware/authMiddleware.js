const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "No token provided",
        });
    }

    const token = authHeader.split(" ")[1];


    try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);


        // Find admin in database without exposing password hash
        const admin = await Admin.findById(decoded.id).select("-password");
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: "Admin not found",
            });
        }

        // Store admin in request
        req.admin = admin;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or Expired Token",
        });
    }
};

module.exports = authMiddleware;
