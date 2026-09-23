require('dotenv').config(); 
const connectDB = require('./src/config/db');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
const express = require('express');

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
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: { directives: { "img-src": ["'self'", "data:", "https:", ...(process.env.NODE_ENV !== 'production' ? ['http:'] : [])], "frame-src": ["'self'", "https:"], "connect-src": ["'self'", "https:"] } },
}));
app.use(compression());
app.use('/api', cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || origin === process.env.SITE_URL) return callback(null, true);
        return callback(Object.assign(new Error("Not allowed by CORS"), { status: 403 }));
    },
    credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use('/api', requestSafety);
app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) res.on('finish', () => { if (res.statusCode < 400) invalidatePublicPages(); });
    next();
});
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
    maxAge: "7d",
    immutable: true,
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please wait a moment and try again." },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts. Please try again later." },
});

app.use("/api", apiLimiter);
app.use("/api/admin/login", authLimiter);
app.use("/api/admin/forgot-password", authLimiter);
app.use("/api/admin/reset-password", authLimiter);
app.use("/api/students/login", authLimiter);
app.use("/api/students/register", authLimiter);
app.use("/api/students/forgot-password", authLimiter);
app.use("/api/students/reset-password", authLimiter);

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

app.use(publicRoutes());
app.get('/health', (req, res) => res.json({ success: true }));
app.use(frontendRoutes());

app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found." });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    if (!process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' && (!process.env.SITE_URL || !process.env.CLIENT_ORIGIN || process.env.JWT_SECRET.length < 32))) {
        throw new Error('Configure JWT_SECRET (32+ characters in production), SITE_URL and CLIENT_ORIGIN before starting.');
    }
    require('./src/services/seoDocument').siteOrigin();
    connectDB().then(() => app.listen(PORT)).catch(error => {
        process.stderr.write(`${error.message} (${error.code || 'startup'})\n`);
        process.exitCode = 1;
    });
}
module.exports = app;
