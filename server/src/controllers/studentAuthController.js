const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const Student = require("../models/Student");
const StudentAuthChallenge = require("../models/StudentAuthChallenge");
const { sendIlmiDunyaEmail } = require("../utils/mailer");
const { escapeHtml } = require("../services/seoDocument");
const {
    emailDeliveryConfigured,
    whatsappDeliveryConfigured,
    startWhatsAppVerification,
    checkWhatsAppVerification,
    sendEmailOtp,
} = require("../services/studentAuthProviders");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleClient = new OAuth2Client();
const otpLifetimeMs = 10 * 60 * 1000;

const signStudentToken = (student) => jwt.sign(
    { id: student._id, role: "student", ver: student.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
);

const safeStudent = (student) => ({
    id: student._id,
    name: student.name,
    email: student.email,
    phone: student.phone,
    gender: student.gender,
    city: student.city,
    school: student.school,
    board: student.board,
    class: student.class,
    group: student.group,
    enrolledSubjects: student.enrolledSubjects,
    isEmailVerified: Boolean(student.isEmailVerified),
    isPhoneVerified: Boolean(student.isPhoneVerified),
});

const normalizePakistaniPhone = (value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    let digits = raw.replace(/[^\d]/g, "");
    if (raw.startsWith("+")) return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
    else if (!digits.startsWith("92")) digits = `92${digits}`;
    return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : "";
};

const otpDigest = (challengeId, value) => crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`${challengeId}:${value}`)
    .digest("hex");

const passwordIsValid = (password) => typeof password === "string" && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) && Buffer.byteLength(password, "utf8") <= 72;

const getProfile = (body, { requirePassword = true } = {}) => {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = normalizePakistaniPhone(body.phone);
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const school = typeof body.school === "string" ? body.school.trim() : "";
    const gender = body.gender || "prefer_not_to_say";
    if (name.length < 2 || name.length > 80) throw Object.assign(new Error("Enter your full name (2 to 80 characters)."), { status: 400 });
    if (!emailPattern.test(email) || email.length > 254) throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
    if (!phone) throw Object.assign(new Error("Enter a valid WhatsApp number, including country code if it is not Pakistani."), { status: 400 });
    if (city.length < 2 || city.length > 80) throw Object.assign(new Error("Enter your city."), { status: 400 });
    if (school.length < 2 || school.length > 160) throw Object.assign(new Error('Enter your school name or write "Private Candidate".'), { status: 400 });
    if (!["female", "male", "other", "prefer_not_to_say"].includes(gender)) throw Object.assign(new Error("Choose a valid gender option."), { status: 400 });
    if (requirePassword && !passwordIsValid(body.password)) throw Object.assign(new Error("Use a password with at least 8 characters, including a letter and a number."), { status: 400 });
    return { name, email, phone, city, school, gender, password: body.password };
};

const authOptions = (req, res) => res.set("Cache-Control", "no-store").json({
    success: true,
    channels: { email: emailDeliveryConfigured(), whatsapp: whatsappDeliveryConfigured() },
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
});

const checkSendCooldown = async (purpose, destination) => {
    const latest = await StudentAuthChallenge.findOne({ purpose, destination }).sort({ createdAt: -1 }).lean();
    if (latest && Date.now() - new Date(latest.createdAt).getTime() < 60_000) {
        throw Object.assign(new Error("Please wait a minute before requesting another code."), { status: 429 });
    }
    await StudentAuthChallenge.deleteMany({ purpose, destination });
};

const createOtpChallenge = async ({ purpose, channel, destination, student, payload, name }) => {
    if (channel !== "email" && channel !== "whatsapp") throw Object.assign(new Error("Choose email or WhatsApp for verification."), { status: 400 });
    if (channel === "email" && !emailDeliveryConfigured()) throw Object.assign(new Error("Email verification is not configured yet."), { status: 503 });
    if (channel === "whatsapp" && !whatsappDeliveryConfigured()) throw Object.assign(new Error("WhatsApp verification is not configured yet."), { status: 503 });
    await checkSendCooldown(purpose, destination);

    const code = String(crypto.randomInt(100000, 1000000));
    const challenge = new StudentAuthChallenge({
        purpose,
        channel,
        destination,
        student: student?._id,
        payload,
        expiresAt: new Date(Date.now() + otpLifetimeMs),
    });
    if (channel === "email") challenge.codeHash = otpDigest(challenge._id, code);
    await challenge.save();

    try {
        if (channel === "email") await sendEmailOtp({ to: destination, name, code, purpose });
        else await startWhatsAppVerification(destination);
    } catch (error) {
        await StudentAuthChallenge.deleteOne({ _id: challenge._id });
        throw Object.assign(new Error(error.status === 429 ? "Too many code requests. Please wait and try again." : `${channel === "email" ? "Email" : "WhatsApp"} code delivery is unavailable right now. Please try another method or try again shortly.`), { status: error.status || 503 });
    }
    return challenge;
};

const createDecoyChallenge = async ({ purpose, channel, destination }) => {
    await checkSendCooldown(purpose, destination);
    const challenge = new StudentAuthChallenge({
        purpose,
        channel,
        destination,
        expiresAt: new Date(Date.now() + otpLifetimeMs),
    });
    challenge.codeHash = otpDigest(challenge._id, crypto.randomBytes(32).toString("hex"));
    await challenge.save();
    return challenge;
};

const verifyOtpChallenge = async ({ challengeId, otp, purpose }) => {
    if (!mongoose.isValidObjectId(challengeId) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
        throw Object.assign(new Error("Enter the six-digit code we sent you."), { status: 400 });
    }
    const challenge = await StudentAuthChallenge.findOne({ _id: challengeId, purpose, expiresAt: { $gt: new Date() } })
        .select("+codeHash +payload");
    if (!challenge || challenge.attempts >= 5) throw Object.assign(new Error("The code is invalid or has expired. Request a new one."), { status: 400 });

    let valid = false;
    if (challenge.channel === "email") {
        const storedHash = Buffer.from(challenge.codeHash || "");
        const submittedHash = Buffer.from(otpDigest(challenge._id, otp));
        valid = storedHash.length === submittedHash.length && crypto.timingSafeEqual(storedHash, submittedHash);
    } else {
        try {
            valid = await checkWhatsAppVerification(challenge.destination, otp);
        } catch (error) {
            throw Object.assign(new Error(error.status === 429 ? "Too many verification attempts. Please wait and try again." : "WhatsApp code verification is temporarily unavailable."), { status: error.status || 503 });
        }
    }
    if (!valid) {
        await StudentAuthChallenge.updateOne({ _id: challenge._id, attempts: challenge.attempts }, { $inc: { attempts: 1 } });
        throw Object.assign(new Error("That code did not match. Check it and try again."), { status: 400 });
    }
    const consumed = await StudentAuthChallenge.findOneAndDelete({ _id: challenge._id, purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }).select("+codeHash +payload");
    if (!consumed) throw Object.assign(new Error("This code was already used or has expired. Request a new one."), { status: 400 });
    return consumed;
};

const issueStudentSession = async (student) => {
    student.lastLoginAt = new Date();
    await student.save();
    return { success: true, token: signStudentToken(student), student: safeStudent(student) };
};

const requestRegistrationCode = async (req, res) => {
    try {
        const profile = getProfile(req.body);
        if (await Student.findOne({ email: profile.email }).select("_id")) return res.status(409).json({ success: false, message: "An account with this email already exists. Log in or reset your password." });
        const passwordHash = await bcrypt.hash(profile.password, 12);
        const safeProfile = {
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            city: profile.city,
            school: profile.school,
            gender: profile.gender,
        };
        const challenge = await createOtpChallenge({
            purpose: "signup",
            channel: req.body.channel,
            destination: req.body.channel === "email" ? profile.email : profile.phone,
            payload: { ...safeProfile, passwordHash },
            name: profile.name,
        });
        res.status(202).json({ success: true, challengeId: challenge._id, expiresInSeconds: 600, message: `Enter the code sent to your ${challenge.channel === "email" ? "email" : "WhatsApp"}.` });
    } catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message || "Unable to send a verification code." });
    }
};

const verifyRegistrationCode = async (req, res) => {
    try {
        const challenge = await verifyOtpChallenge({ ...req.body, purpose: "signup" });
        const data = challenge.payload;
        const student = await Student.create({
            name: data.name,
            email: data.email,
            password: data.passwordHash,
            phone: data.phone,
            gender: data.gender,
            city: data.city,
            school: data.school,
            isEmailVerified: challenge.channel === "email",
            isPhoneVerified: challenge.channel === "whatsapp",
        });
        sendIlmiDunyaEmail({
            to: student.email,
            subject: "Welcome to IlmiDunya - your learning journey begins",
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h1 style="color:#623fcd">Congratulations, ${escapeHtml(student.name)}!</h1><p>Your IlmiDunya account is ready. Explore board-aligned resources, practise MCQ tests and track your progress.</p><p>Keep learning,<br><strong>Team IlmiDunya</strong></p></div>`,
        }).catch(() => {});
        res.status(201).json(await issueStudentSession(student));
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "An account with this email already exists. Please log in." });
        res.status(error.status || 400).json({ success: false, message: error.message || "Unable to verify your account." });
    }
};

const registerGoogleProfile = async (req, res) => {
    try {
        const token = req.body.googleRegistrationToken;
        if (typeof token !== "string") return res.status(400).json({ success: false, message: "Restart Google sign-up to continue." });
        const identity = jwt.verify(token, process.env.JWT_SECRET, { audience: "student-google-signup" });
        const profile = getProfile({ ...req.body, email: identity.email }, { requirePassword: false });
        if (await Student.findOne({ email: profile.email }).select("_id")) return res.status(409).json({ success: false, message: "An account with this email already exists. Log in with Google." });
        const student = await Student.create({
            name: profile.name || identity.name,
            email: identity.email,
            phone: profile.phone,
            gender: profile.gender,
            city: profile.city,
            school: profile.school,
            googleSub: identity.sub,
            isEmailVerified: true,
        });
        res.status(201).json(await issueStudentSession(student));
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "An account with this email already exists. Please log in." });
        res.status(error.status || 400).json({ success: false, message: error.message || "Unable to complete Google sign-up." });
    }
};

const loginStudent = async (req, res) => {
    try {
        const identifier = typeof (req.body.identifier || req.body.email) === "string" ? (req.body.identifier || req.body.email).trim() : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";
        if (!identifier || !password) return res.status(400).json({ success: false, message: "Enter your email or WhatsApp number and password." });
        const email = identifier.toLowerCase();
        const normalizedPhone = normalizePakistaniPhone(identifier);
        const student = await Student.findOne(emailPattern.test(email) ? { email } : { phone: { $in: [identifier, normalizedPhone].filter(Boolean) } }).select("+password +tokenVersion +googleSub");
        if (!student || !student.password || !(await bcrypt.compare(password, student.password))) return res.status(401).json({ success: false, message: "Invalid email/WhatsApp number or password." });
        if (student.status !== "active") return res.status(403).json({ success: false, message: "Your account is not active." });
        res.json(await issueStudentSession(student));
    } catch {
        res.status(500).json({ success: false, message: "Unable to log in right now." });
    }
};

const requestLoginCode = async (req, res) => {
    try {
        const identifier = typeof req.body.identifier === "string" ? req.body.identifier.trim() : "";
        const channel = req.body.channel;
        if (!identifier) return res.status(400).json({ success: false, message: "Enter your email or WhatsApp number." });
        const email = identifier.toLowerCase();
        const phone = normalizePakistaniPhone(identifier);
        if (channel === "email" && !emailPattern.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address for email verification." });
        if (channel === "whatsapp" && (emailPattern.test(identifier) || !phone)) return res.status(400).json({ success: false, message: "Enter a valid WhatsApp number." });
        const destination = channel === "email" ? email : phone;
        if ((channel === "email" && !emailDeliveryConfigured()) || (channel === "whatsapp" && !whatsappDeliveryConfigured())) {
            return res.status(503).json({ success: false, message: `${channel === "email" ? "Email" : "WhatsApp"} code delivery is not configured yet.` });
        }
        const student = await Student.findOne(channel === "email" ? { email } : { phone: { $in: [identifier, phone].filter(Boolean) } });
        const challenge = !student || student.status !== "active"
            ? await createDecoyChallenge({ purpose: "login", channel, destination })
            : await createOtpChallenge({ purpose: "login", channel, destination, student });
        res.status(202).json({ success: true, challengeId: challenge._id, expiresInSeconds: 600, message: "If those details match an active account, a sign-in code will arrive shortly." });
    } catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message || "Unable to send a sign-in code." });
    }
};

const verifyLoginCode = async (req, res) => {
    try {
        const challenge = await verifyOtpChallenge({ ...req.body, purpose: "login" });
        if (!challenge.student) return res.status(400).json({ success: false, message: "The code is invalid or has expired. Request a new one." });
        const student = await Student.findOne({ _id: challenge.student, status: "active" }).select("+tokenVersion");
        if (!student) return res.status(400).json({ success: false, message: "This account is unavailable. Contact support." });
        if (challenge.channel === "email") student.isEmailVerified = true;
        if (challenge.channel === "whatsapp") student.isPhoneVerified = true;
        res.json(await issueStudentSession(student));
    } catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message || "Unable to verify the sign-in code." });
    }
};

const requestPasswordReset = async (req, res) => {
    try {
        const channel = req.body.channel;
        const raw = typeof req.body.identifier === "string" ? req.body.identifier.trim() : typeof req.body.email === "string" ? req.body.email.trim() : "";
        if (!raw) return res.status(400).json({ success: false, message: "Enter your email or WhatsApp number." });
        const email = raw.toLowerCase();
        const phone = normalizePakistaniPhone(raw);
        if (channel === "email" && !emailPattern.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
        if (channel === "whatsapp" && (emailPattern.test(raw) || !phone)) return res.status(400).json({ success: false, message: "Enter a valid WhatsApp number." });
        if (!["email", "whatsapp"].includes(channel)) return res.status(400).json({ success: false, message: "Choose email or WhatsApp for the reset code." });
        if ((channel === "email" && !emailDeliveryConfigured()) || (channel === "whatsapp" && !whatsappDeliveryConfigured())) {
            return res.status(503).json({ success: false, message: `${channel === "email" ? "Email" : "WhatsApp"} code delivery is not configured yet.` });
        }
        const student = await Student.findOne(channel === "email" ? { email } : { phone: { $in: [raw, phone].filter(Boolean) } });
        const destination = channel === "email" ? (student?.email || email) : phone;
        const account = student?.status === "active" ? student : null;
        const challenge = account
            ? await createOtpChallenge({ purpose: "password_reset", channel, destination, student: account })
            : await createDecoyChallenge({ purpose: "password_reset", channel, destination });
        res.status(202).json({ success: true, challengeId: challenge._id, expiresInSeconds: 600, message: "If those details match an active account, a reset code will arrive shortly." });
    } catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message || "Unable to send a password reset code." });
    }
};

const resetPassword = async (req, res) => {
    try {
        if (!passwordIsValid(req.body.password)) throw Object.assign(new Error("Use a password with at least 8 characters, including a letter and a number."), { status: 400 });
        const challenge = await verifyOtpChallenge({ ...req.body, purpose: "password_reset" });
        if (!challenge.student) return res.status(400).json({ success: false, message: "The code is invalid or has expired. Request a new one." });
        const updated = await Student.updateOne({ _id: challenge.student, status: "active" }, {
            $set: { password: await bcrypt.hash(req.body.password, 12) },
            $inc: { tokenVersion: 1 },
            $unset: { passwordResetOtpHash: "", passwordResetExpiresAt: "", passwordResetAttempts: "" },
        });
        if (!updated.modifiedCount) return res.status(400).json({ success: false, message: "The account is unavailable or the code has expired." });
        res.json({ success: true, message: "Password updated. You can now log in." });
    } catch (error) {
        res.status(error.status || 400).json({ success: false, message: error.message || "Unable to reset your password." });
    }
};

const createGoogleNonce = async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ success: false, message: "Google sign-in is not configured." });
    const nonce = crypto.randomBytes(32).toString("base64url");
    const challenge = new StudentAuthChallenge({ purpose: "google_nonce", channel: "google", expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    challenge.codeHash = otpDigest(challenge._id, nonce);
    await challenge.save();
    res.set("Cache-Control", "no-store").json({ success: true, nonce, challengeId: challenge._id, clientId: process.env.GOOGLE_CLIENT_ID });
};

const loginWithGoogle = async (req, res) => {
    try {
        if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ success: false, message: "Google sign-in is not configured." });
        const { credential, nonce, challengeId } = req.body;
        if (typeof credential !== "string" || credential.length > 10000 || typeof nonce !== "string" || !mongoose.isValidObjectId(challengeId)) return res.status(400).json({ success: false, message: "Google sign-in could not be verified. Please try again." });
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        const identity = ticket.getPayload();
        if (!identity?.sub || !identity.email || identity.email_verified !== true || identity.nonce !== nonce) return res.status(401).json({ success: false, message: "Google could not verify this account. Try another sign-in method." });
        const nonceHash = otpDigest(challengeId, nonce);
        const consumed = await StudentAuthChallenge.findOneAndDelete({ _id: challengeId, purpose: "google_nonce", codeHash: nonceHash, expiresAt: { $gt: new Date() } });
        if (!consumed) return res.status(401).json({ success: false, message: "This Google sign-in has expired. Please try again." });

        const email = identity.email.toLowerCase();
        let student = await Student.findOne({ googleSub: identity.sub }).select("+tokenVersion +googleSub");
        if (!student) {
            student = await Student.findOne({ email }).select("+tokenVersion +googleSub");
            const authoritativeEmail = email.endsWith("@gmail.com") || Boolean(identity.hd && identity.email_verified === true);
            if (student && !student.googleSub && !authoritativeEmail) {
                return res.status(409).json({ success: false, message: "Verify this email or WhatsApp with a code before connecting Google to your existing account." });
            }
        }
        if (!student) {
            const registrationToken = jwt.sign({ role: "student_google_signup", sub: identity.sub, email, name: identity.name || "" }, process.env.JWT_SECRET, { audience: "student-google-signup", expiresIn: "10m" });
            return res.status(200).json({ success: true, needsProfile: true, profile: { name: identity.name || "", email }, googleRegistrationToken: registrationToken });
        }
        if (student.googleSub && student.googleSub !== identity.sub) return res.status(409).json({ success: false, message: "This email is connected to a different Google account." });
        if (student.status !== "active") return res.status(403).json({ success: false, message: "Your account is not active." });
        student.googleSub = identity.sub;
        student.isEmailVerified = true;
        res.json(await issueStudentSession(student));
    } catch {
        res.status(401).json({ success: false, message: "Google sign-in failed. Please try again or use another method." });
    }
};

const getStudentMe = async (req, res) => res.json({ success: true, student: safeStudent(req.student) });

module.exports = {
    authOptions,
    requestRegistrationCode,
    verifyRegistrationCode,
    registerGoogleProfile,
    loginStudent,
    requestLoginCode,
    verifyLoginCode,
    requestPasswordReset,
    resetPassword,
    createGoogleNonce,
    loginWithGoogle,
    getStudentMe,
    normalizePakistaniPhone,
};
