require('dotenv').config(); 
const connectDB = require('./src/config/db');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const limits = require('./src/middleware/rateLimits');
const path = require('node:path');
const adminRoutes = require('./src/routes/adminRoutes');
const boardRoutes = require('./src/routes/boardRoutes');
const classRoutes = require("./src/routes/classRouter");
const groupRoutes = require("./src/routes/groupRoutes");
const subjectRoutes = require("./src/routes/subjectRoutes");
const chapterRoutes = require("./src/routes/chapterRoutes");
const topicRoutes = require("./src/routes/topicRoutes");
const resourceRoutes = require("./src/routes/resourceRoutes");
const homeContentRoutes = require("./src/routes/homeContentRoutes");
const studentAuthRoutes = require("./src/routes/studentAuthRoutes");
const questionBankRoutes = require("./src/routes/questionBankRoutes");
const assessmentRoutes = require("./src/routes/assessmentRoutes");
const attemptRoutes = require("./src/routes/attemptRoutes");
const studentDashboardRoutes = require("./src/routes/studentDashboardRoutes");
const analyticsRoutes = require("./src/routes/analyticsRoutes");
const leaderboardRoutes = require("./src/routes/leaderboardRoutes");
const newsRoutes = require("./src/routes/newsRoutes");
const schoolRoutes = require("./src/routes/schoolRoutes");
const StudentAuthChallenge = require("./src/models/StudentAuthChallenge");
const Student = require("./src/models/Student");
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const { publicRoutes, frontendRoutes, invalidatePublicPages } = require('./src/routes/publicPagesRoutes');
const { requestSafety, errorHandler } = require('./src/middleware/requestSafety');

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || false);
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: { directives: {
        "img-src": ["'self'", "data:", "https:", ...(process.env.NODE_ENV !== 'production' ? ['http:'] : [])],
        "script-src": ["'self'", "https://accounts.google.com/gsi/client"],
        "style-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "frame-src": ["'self'", "https:"],
        "connect-src": ["'self'", "https:"],
    } },
}));
app.use(compression());
// A page served by this very server is never cross-origin, so its own host (for example the www and
// non-www versions of the site) is always allowed; other origins must be listed in CLIENT_ORIGIN.
const corsOptions = (req, callback) => {
    const origin = req.get('origin');
    let sameHost = false;
    if (origin) {
        try { sameHost = new URL(origin).host === req.get('host'); } catch { sameHost = false; }
    }
    if (!origin || sameHost || allowedOrigins.includes(origin) || origin === process.env.SITE_URL) return callback(null, { origin: true, credentials: true });
    return callback(Object.assign(new Error("Not allowed by CORS"), { status: 403 }));
};
app.use('/api', cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.get('/health', (req, res) => { initializeDatabase().catch(() => {}); res.json({ success: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' }); });
app.use(async (req, res, next) => {
    if (require.main !== module && process.env.NODE_ENV !== 'production') return next();
    if (req.path === '/robots.txt' || req.path.startsWith('/assets/') || req.path === '/logo.png' || req.path === '/theme-init.js') return next();
    // While the database is unreachable, answer at once for a few seconds instead of making every visitor wait for a new connection attempt.
    if (Date.now() - lastDatabaseFailure < 3000) return res.status(503).set('Retry-After', '5').json({ success: false, message: 'Service temporarily unavailable. Please retry shortly.' });
    try {
        await initializeDatabase();
        next();
    } catch (error) {
        lastDatabaseFailure = Date.now();
        res.status(503).set('Retry-After', '10').json({ success: false, message: 'Service temporarily unavailable. Please retry shortly.' });
    }
});
app.use('/api', requestSafety);
const { microCache, clearMicroCache } = require('./src/middleware/microCache');
app.use('/api', require('./src/middleware/publicCacheInvalidation')(() => { invalidatePublicPages(); clearMicroCache(); }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
    maxAge: "7d",
    immutable: true,
}));

const visitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: false,
    legacyHeaders: false,
    // Over the limit, the visit is answered but not counted.
    handler: (req, res, next) => { req.visitNotCounted = true; next(); },
});

// Uploaded images are cached by browsers for a year, so they are served before the API rate limit.
app.get("/api/media/images/:id", require("./src/services/mediaStore").serveImage);
app.use("/api", limits.apiLimiter);
// Public lists that every visitor reads; cleared immediately when an admin changes content.
for (const route of ['/api/boards', '/api/classes', '/api/groups', '/api/subjects', '/api/chapters', '/api/topics/chapter', '/api/home-content']) app.use(route, microCache());
app.use("/api/home-content/visit", visitLimiter);
// Sign-in and password limits count failures per account, so a school sharing one IP is not locked out together.
app.post("/api/admin/login", ...limits.adminLoginLimiters);
app.post("/api/admin/forgot-password", limits.adminResetLimiter, limits.adminAccountResetLimiter);
app.post("/api/admin/reset-password", limits.adminResetLimiter);
app.post("/api/students/login", ...limits.studentLoginLimiters);
app.post("/api/students/register", limits.registerLimiter);
app.post("/api/students/register/verify", limits.verifyCodeLimiter);
app.post("/api/students/register/google-profile", limits.googleLimiter);
app.post("/api/students/forgot-password", limits.passwordResetLimiter);
app.post("/api/students/reset-password", limits.resetCodeLimiter);
app.post("/api/students/google", limits.googleLimiter);
app.post("/api/students/google/nonce", limits.googleLimiter);

app.use('/api/admin', adminRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/classes", classRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/chapters', chapterRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/home-content", homeContentRoutes);
app.use("/api/students", studentAuthRoutes);
app.use("/api/questions", questionBankRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/student-dashboard", studentDashboardRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/schools", schoolRoutes);

app.use(publicRoutes());
app.use(frontendRoutes());

app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found." });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const validateRuntimeConfig = () => {
    if (!process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' && (!process.env.SITE_URL || !process.env.CLIENT_ORIGIN || process.env.JWT_SECRET.length < 32))) {
        throw new Error('Configure JWT_SECRET (32+ characters in production), SITE_URL and CLIENT_ORIGIN before starting.');
    }
    require('./src/services/seoDocument').siteOrigin();
};

// Students cannot sign up without the code e-mail, so a broken mail setup is logged at every start.
const reportEmailSetup = () => {
    const { emailSetupReport, verifySmtpLogin } = require('./src/utils/mailer');
    const report = emailSetupReport();
    process.stdout.write(`[email] provider: ${report.provider}${report.smtp ? ` (${report.smtp.host}:${report.smtp.port}, ${report.smtp.secure ? 'SSL' : 'STARTTLS'})` : ''}, from: ${report.from || 'none'}\n`);
    report.warnings.forEach(warning => process.stderr.write(`[email] WARNING: ${warning}\n`));
    if (report.smtp) verifySmtpLogin().then(result => (result.ok ? process.stdout : process.stderr).write(`[email] ${result.ok ? '' : 'WARNING: '}${result.message}\n`));
};

let databaseReady;
let lastDatabaseFailure = 0;
mongoose.connection.on('disconnected', () => { databaseReady = undefined; });
const initializeDatabase = async () => {
    if (!databaseReady) {
        databaseReady = connectDB().then(async () => {
            await Student.collection.createIndex({ googleSub: 1 }, { unique: true, sparse: true });
            await StudentAuthChallenge.createIndexes();
        }).catch(error => { databaseReady = undefined; throw error; });
    }
    return databaseReady;
};

if (require.main === module) {
    try {
        validateRuntimeConfig();
    } catch (error) {
        process.stderr.write(`${error.message} (${error.code || 'startup'})\n`);
        process.exit(1);
    }
    const server = app.listen(PORT);
    // Longer than typical proxy idle timeouts (60 s), so a proxy never reuses a connection this server just closed.
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    // Hosts send SIGTERM on every deploy: finish requests already running (a test submission, a download) first.
    process.once('SIGTERM', () => {
        server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
        setTimeout(() => process.exit(0), 10000).unref();
    });
    initializeDatabase().catch(error => {
        process.stderr.write(`${error.message} (${error.code || 'startup'})\n`);
    });
    reportEmailSetup();
} else if (process.env.NODE_ENV === 'production') {
    try {
        validateRuntimeConfig();
        initializeDatabase().catch(error => {
            process.stderr.write(`${error.message} (${error.code || 'startup'})\n`);
        });
    } catch (error) {
        process.stderr.write(`${error.message} (${error.code || 'startup'})\n`);
    }
}
module.exports = app;
