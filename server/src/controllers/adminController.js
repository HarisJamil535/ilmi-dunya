const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Board = require("../models/Board");
const ClassModel = require("../models/Class");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Book = require("../models/Book");
const PastPaper = require("../models/PastPaper");
const Question = require("../models/Question");
const NewsArticle = require("../models/NewsArticle");
const Student = require("../models/Student");
const Testimonial = require("../models/Testimonial");
const HomeStat = require("../models/HomeStat");
const { sendIlmiDunyaEmail } = require("../utils/mailer");

const SESSION_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || "8h";

const safeAdmin = (admin) => ({
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    permissions: admin.role === "super_admin" ? Admin.permissions : admin.permissions || [],
    status: admin.status,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
});

const signAdminToken = (admin, sessionId) => jwt.sign(
    { id: admin._id, role: admin.role, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: SESSION_EXPIRES_IN }
);

const loginAdmin = async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase().trim();
        const password = req.body.password || "";
        const admin = await Admin.findOne({ email }).select("+password +currentSessionId");

        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        if (admin.status !== "active") {
            return res.status(403).json({ success: false, message: "This admin account is disabled." });
        }

        const sessionId = crypto.randomUUID();
        admin.currentSessionId = sessionId;
        admin.lastLoginAt = new Date();
        await admin.save();

        res.status(200).json({
            success: true,
            message: "Login successful",
            token: signAdminToken(admin, sessionId),
            expiresIn: SESSION_EXPIRES_IN,
            admin: safeAdmin(admin),
        });
    } catch {
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const logoutAdmin = async (req, res) => {
    if (req.admin) {
        await Admin.findByIdAndUpdate(req.admin._id, { $unset: { currentSessionId: "" } });
    }
    res.json({ success: true, message: "Logged out successfully." });
};

const getLoggedInAdmin = async (req, res) => {
    res.status(200).json({ success: true, admin: safeAdmin(req.admin) });
};

const getDashboard = async (req, res) => {
    const [
        boards,
        classes,
        groups,
        subjects,
        chapters,
        topics,
        books,
        papers,
        questions,
        publishedQuestions,
        news,
        students,
        testimonials,
        homeStats,
        recentQuestions,
    ] = await Promise.all([
        Board.countDocuments(),
        ClassModel.countDocuments(),
        Group.countDocuments(),
        Subject.countDocuments(),
        Chapter.countDocuments(),
        Topic.countDocuments(),
        Book.countDocuments(),
        PastPaper.countDocuments(),
        Question.countDocuments({ status: { $ne: "archived" } }),
        Question.countDocuments({ status: "published" }),
        NewsArticle.countDocuments(),
        Student.countDocuments(),
        Testimonial.countDocuments(),
        HomeStat.countDocuments(),
        Question.find({ status: { $ne: "archived" } })
            .populate("subject chapter topic", "name")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
    ]);

    res.json({
        success: true,
        message: `Welcome to Admin Dashboard ${req.admin.name}`,
        counts: {
            boards,
            classes,
            groups,
            subjects,
            chapters,
            topics,
            books,
            papers,
            questions,
            publishedQuestions,
            news,
            students,
            testimonials,
            homeStats,
        },
        recentQuestions,
    });
};

const listAdmins = async (req, res) => {
    const admins = await Admin.find().sort({ role: -1, createdAt: -1 }).lean();
    res.json({ success: true, admins: admins.map(safeAdmin), permissions: Admin.permissions });
};

const createAdmin = async (req, res) => {
    const { name, email, password, permissions = [], status = "active" } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!name?.trim() || !normalizedEmail || !password) {
        return res.status(400).json({ success: false, message: "Name, email and password are required." });
    }
    if (password.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }
    if (!Array.isArray(permissions) || permissions.some((item) => !Admin.permissions.includes(item))) {
        return res.status(400).json({ success: false, message: "Invalid permissions selected." });
    }

    const exists = await Admin.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ success: false, message: "An admin with this email already exists." });

    const admin = await Admin.create({
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 12),
        role: "admin",
        permissions,
        status,
    });

    sendIlmiDunyaEmail({
        to: admin.email,
        subject: "Your IlmiDunya admin account is ready",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h2 style="color:#443dd7">Welcome to IlmiDunya Admin</h2><p>Hello ${admin.name}, your admin account has been created.</p><p><strong>Email:</strong> ${admin.email}</p><p>Please log in and keep your password private.</p><p>Team IlmiDunya</p></div>`,
    }).catch(() => {});

    res.status(201).json({ success: true, admin: safeAdmin(admin) });
};

const updateAdmin = async (req, res) => {
    const admin = await Admin.findById(req.params.id).select("+currentSessionId");
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
    if (admin.role === "super_admin" && String(admin._id) !== String(req.admin._id)) {
        return res.status(400).json({ success: false, message: "Super admin accounts cannot be changed here." });
    }

    const { name, email, password, permissions, status } = req.body;
    if (name?.trim()) admin.name = name.trim();
    if (email?.trim()) admin.email = email.toLowerCase().trim();
    if (Array.isArray(permissions)) {
        if (permissions.some((item) => !Admin.permissions.includes(item))) {
            return res.status(400).json({ success: false, message: "Invalid permissions selected." });
        }
        admin.permissions = permissions;
    }
    if (["active", "disabled"].includes(status)) admin.status = status;
    if (password) {
        if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
        admin.password = await bcrypt.hash(password, 12);
        admin.currentSessionId = undefined;
    }
    if (status === "disabled") admin.currentSessionId = undefined;

    await admin.save();
    res.json({ success: true, admin: safeAdmin(admin) });
};

const deleteAdmin = async (req, res) => {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
    if (admin.role === "super_admin") {
        return res.status(400).json({ success: false, message: "Super admin cannot be deleted." });
    }
    await admin.deleteOne();
    res.json({ success: true, message: "Admin deleted successfully." });
};

const requestAdminPasswordReset = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const generic = { success: true, message: "If an admin account exists, a verification code has been sent." };
    if (!email) return res.json(generic);

    const admin = await Admin.findOne({ email }).select("+passwordResetOtpHash +passwordResetExpiresAt +passwordResetAttempts");
    if (!admin) return res.json(generic);

    const otp = String(crypto.randomInt(100000, 1000000));
    admin.passwordResetOtpHash = crypto.createHash("sha256").update(otp).digest("hex");
    admin.passwordResetExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    admin.passwordResetAttempts = 0;
    await admin.save();

    try {
        const sent = await sendIlmiDunyaEmail({
            to: admin.email,
            subject: "Your IlmiDunya admin password reset code",
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h2 style="color:#623fcd">Reset your admin password</h2><p>Use this secure verification code:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${otp}</p><p>This code expires in 10 minutes. If this was not you, contact the super admin immediately.</p><p>Team IlmiDunya</p></div>`,
        });
        if (!sent) return res.status(503).json({ success: false, message: "Email delivery is not configured on the server yet." });
    } catch (error) {
        console.error("Admin password reset email failed:", error.code || "EMAIL_DELIVERY_FAILED", error.message);
        return res.status(503).json({ success: false, message: "We could not deliver the email right now. Please try again shortly." });
    }

    res.json(generic);
};

const resetAdminPassword = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const otp = String(req.body.otp || "");
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !/^\d{6}$/.test(otp) || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ success: false, message: 'Enter your email, six-digit code and a valid password.' });
    if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

    const admin = await Admin.findOne({ email }).select("+passwordResetOtpHash +passwordResetExpiresAt +passwordResetAttempts +currentSessionId");
    const hash = crypto.createHash("sha256").update(otp).digest("hex");
    if (!admin || !admin.passwordResetOtpHash || admin.passwordResetExpiresAt < new Date() || admin.passwordResetAttempts >= 5 || admin.passwordResetOtpHash !== hash) {
        if (admin) await Admin.updateOne({ _id: admin._id, passwordResetOtpHash: admin.passwordResetOtpHash }, { $inc: { passwordResetAttempts: 1 } });
        return res.status(400).json({ success: false, message: "The code is invalid or has expired." });
    }

    const updated = await Admin.updateOne({ _id: admin._id, passwordResetOtpHash: hash, passwordResetExpiresAt: { $gt: new Date() }, passwordResetAttempts: { $lt: 5 } }, {
        $set: { password: await bcrypt.hash(password, 12), passwordResetAttempts: 0 },
        $unset: { passwordResetOtpHash: '', passwordResetExpiresAt: '', currentSessionId: '' },
    });
    if (!updated.modifiedCount) return res.status(400).json({ success: false, message: 'The code is invalid, expired or already used.' });

    res.json({ success: true, message: "Password updated. You can now log in." });
};

module.exports = {
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
};
