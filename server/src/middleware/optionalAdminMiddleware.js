const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const optionalAdminMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!['admin', 'super_admin'].includes(decoded.role) || !decoded.sid) return next();
        const admin = await Admin.findById(decoded.id).select("-password +currentSessionId");
        const permission = req.originalUrl.startsWith('/api/news') ? 'news' : 'assessments';
        req.admin = admin?.status === "active" && admin.currentSessionId === decoded.sid && (admin.role === 'super_admin' || admin.permissions.includes(permission)) ? admin : null;
    } catch {
        req.admin = null;
    }

    next();
};

module.exports = optionalAdminMiddleware;
