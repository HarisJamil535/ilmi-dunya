const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const routePermissions = [
    { prefix: "/api/boards", permission: "academic" },
    { prefix: "/api/classes", permission: "academic" },
    { prefix: "/api/groups", permission: "academic" },
    { prefix: "/api/subjects", permission: "academic" },
    { prefix: "/api/chapters", permission: "academic" },
    { prefix: "/api/topics", permission: "academic" },
    { prefix: "/api/resources", permission: "resources" },
    { prefix: "/api/home-content", permission: "homeContent" },
    { prefix: "/api/questions", permission: "assessments" },
    { prefix: "/api/assessments", permission: "assessments" },
    { prefix: "/api/analytics", permission: "analytics" },
    { prefix: "/api/news", permission: "news" },
];

const permissionForRequest = (req) => {
    if (req.requiredPermission) return req.requiredPermission;
    const match = routePermissions.find((item) => req.originalUrl.startsWith(item.prefix));
    return match?.permission || null;
};

const authMiddleware = (requiredPermission) => async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!['admin', 'super_admin'].includes(decoded.role) || !decoded.sid) return res.status(401).json({ success: false, message: 'Admin login required.' });
        const admin = await Admin.findById(decoded.id).select("-password +currentSessionId");

        if (!admin) return res.status(401).json({ success: false, message: "Admin not found" });
        if (admin.status !== "active") return res.status(403).json({ success: false, message: "This admin account is disabled." });
        if (!decoded.sid || admin.currentSessionId !== decoded.sid) {
            return res.status(401).json({ success: false, message: "This session has expired because the account logged in on another device." });
        }

        req.admin = admin;

        const permission = requiredPermission || permissionForRequest(req);
        if (admin.role !== "super_admin" && permission && !admin.permissions.includes(permission)) {
            return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
        }

        next();
    } catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};

const defaultAuthMiddleware = (req, res, next) => authMiddleware()(req, res, next);

defaultAuthMiddleware.requirePermission = authMiddleware;
defaultAuthMiddleware.requireSuperAdmin = authMiddleware("super_admin_management");

module.exports = defaultAuthMiddleware;
