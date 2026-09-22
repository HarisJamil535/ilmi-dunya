const jwt = require("jsonwebtoken");
const Student = require("../models/Student");

const studentAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ success: false, message: "Student login required" });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "student") {
            return res.status(403).json({ success: false, message: "Student access required" });
        }

        const student = await Student.findById(decoded.id).select("-password +tokenVersion");
        if (!student || student.status !== "active" || (decoded.ver || 0) !== (student.tokenVersion || 0)) {
            return res.status(401).json({ success: false, message: "Student account is not active" });
        }

        req.student = student;
        next();
    } catch {
        res.status(401).json({ success: false, message: "Invalid or expired student token" });
    }
};

module.exports = studentAuthMiddleware;
