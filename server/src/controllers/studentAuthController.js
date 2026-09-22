const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const crypto = require("node:crypto");
const { sendIlmiDunyaEmail } = require("../utils/mailer");
const { escapeHtml } = require('../services/seoDocument');

const signStudentToken = (student) =>
    jwt.sign(
        { id: student._id, role: "student", ver: student.tokenVersion || 0 },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

const safeStudent = (student) => ({
    id: student._id,
    name: student.name,
    email: student.email,
    phone: student.phone,
    city: student.city,
    school: student.school,
    board: student.board,
    class: student.class,
    group: student.group,
    enrolledSubjects: student.enrolledSubjects,
});

const registerStudent = async (req, res) => {
    try {
        const { name, email, password, phone, city, school, board, class: classId, group } = req.body;

        if (![name, email, phone, city, school, password].every(value => typeof value === 'string' && value.trim())) {
            return res.status(400).json({ success: false, message: "Name, email, phone, city, school and password are required." });
        }

        if (password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
        }

        const existing = await Student.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ success: false, message: "A student with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const student = await Student.create({
            name,
            email,
            password: hashedPassword,
            phone,
            city,
            school,
            board: board || undefined,
            class: classId || undefined,
            group: group || undefined,
        });

        const token = signStudentToken(student);
        sendIlmiDunyaEmail({
            to: student.email,
            subject: "Welcome to IlmiDunya - your learning journey begins",
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h1 style="color:#443dd7">Congratulations, ${escapeHtml(student.name)}!</h1><p>Your IlmiDunya student account is ready. You can now explore board-aligned resources, practise MCQ tests and track your progress.</p><p>We are excited to be part of your learning journey.</p><p>Keep learning,<br><strong>Team IlmiDunya</strong></p></div>`,
        }).catch(() => {});
        res.status(201).json({ success: true, token, student: safeStudent(student) });
    } catch {
        res.status(500).json({ success: false, message: "Unable to register student." });
    }
};

const loginStudent = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ success: false, message: 'Email and password are required.' });
        const student = await Student.findOne({ email: email?.toLowerCase().trim() }).select('+password +tokenVersion');

        if (!student || !(await bcrypt.compare(password || "", student.password))) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        if (student.status !== "active") {
            return res.status(403).json({ success: false, message: "Your account is not active." });
        }

        student.lastLoginAt = new Date();
        await student.save();

        res.json({ success: true, token: signStudentToken(student), student: safeStudent(student) });
    } catch {
        res.status(500).json({ success: false, message: "Unable to login student." });
    }
};

const getStudentMe = async (req, res) => {
    res.json({ success: true, student: safeStudent(req.student) });
};

const requestPasswordReset = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const generic = { success: true, message: "If an account exists, a verification code has been sent to its email." };
    if (!email) return res.json(generic);
    const student = await Student.findOne({ email }).select("+passwordResetOtpHash +passwordResetExpiresAt +passwordResetAttempts");
    if (!student) return res.json(generic);
    const otp = String(crypto.randomInt(100000, 1000000));
    student.passwordResetOtpHash = crypto.createHash("sha256").update(otp).digest("hex");
    student.passwordResetExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    student.passwordResetAttempts = 0;
    await student.save();
    try {
        const sent = await sendIlmiDunyaEmail({ to: student.email, subject: "Your IlmiDunya password reset code", html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h2 style="color:#443dd7">Reset your password</h2><p>Use this verification code to continue:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${otp}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p><p>Team IlmiDunya</p></div>` });
        if (!sent) return res.status(503).json({ success: false, message: "Email delivery is not configured on the server yet. Please contact the administrator." });
    } catch (error) {
        console.error("Password reset email failed:", error.message);
        return res.status(503).json({ success: false, message: "We could not deliver the email right now. Please try again shortly." });
    }
    res.json(generic);
};

const resetPassword = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const otp = String(req.body.otp || "");
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !/^\d{6}$/.test(otp) || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ success: false, message: 'Enter your email, six-digit code and a valid password.' });
    if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    const student = await Student.findOne({ email }).select("+passwordResetOtpHash +passwordResetExpiresAt +passwordResetAttempts");
    const hash = crypto.createHash("sha256").update(otp).digest("hex");
    if (!student || !student.passwordResetOtpHash || student.passwordResetExpiresAt < new Date() || student.passwordResetAttempts >= 5 || student.passwordResetOtpHash !== hash) {
        if (student) await Student.updateOne({ _id: student._id, passwordResetOtpHash: student.passwordResetOtpHash }, { $inc: { passwordResetAttempts: 1 } });
        return res.status(400).json({ success: false, message: "The code is invalid or has expired." });
    }
    const updated = await Student.updateOne({ _id: student._id, passwordResetOtpHash: hash, passwordResetExpiresAt: { $gt: new Date() }, passwordResetAttempts: { $lt: 5 } }, {
        $set: { password: await bcrypt.hash(password, 12), passwordResetAttempts: 0 },
        $inc: { tokenVersion: 1 },
        $unset: { passwordResetOtpHash: '', passwordResetExpiresAt: '' },
    });
    if (!updated.modifiedCount) return res.status(400).json({ success: false, message: 'The code is invalid, expired or already used.' });
    res.json({ success: true, message: "Password updated. You can now log in." });
};

module.exports = { registerStudent, loginStudent, getStudentMe, requestPasswordReset, resetPassword };
