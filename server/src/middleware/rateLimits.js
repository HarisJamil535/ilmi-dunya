const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Many students share one public IP address (a school network, or a mobile carrier), so address-wide
// limits must be generous. Sign-in and password limits count failures per account instead, which
// still stops password guessing without locking a whole classroom out.
const WINDOW_MS = 15 * 60 * 1000;
const clip = value => String(value ?? "").trim().toLowerCase().slice(0, 120);
const ipOf = req => ipKeyGenerator(req.ip || "");

// The account a request is about, written the same way however the student typed it.
const accountOf = req => {
    const raw = req.body?.identifier ?? req.body?.email ?? "";
    return typeof raw === "string" ? clip(raw).replace(/[\s()-]/g, "") : "";
};

const limiter = ({ limit, message, key, failuresOnly = false }) => rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: failuresOnly,
    ...(key ? { keyGenerator: key } : {}),
    message: { success: false, message },
});

const wait = "Please wait a few minutes and try again.";

// Whole-API ceiling per address, far above what a classroom of students produces.
const apiLimiter = limiter({ limit: 30000, message: "Too many requests. Please wait a moment and try again." });

// Failed sign-ins: per account from one address, per account from anywhere, and per address overall.
const studentLoginLimiters = [
    limiter({ limit: 10, failuresOnly: true, key: req => `login:${ipOf(req)}:${accountOf(req)}`, message: `Too many failed sign-in attempts for this account. ${wait}` }),
    limiter({ limit: 30, failuresOnly: true, key: req => `login-account:${accountOf(req)}`, message: `Too many failed sign-in attempts for this account. ${wait}` }),
    limiter({ limit: 600, failuresOnly: true, key: req => `login-ip:${ipOf(req)}`, message: `Too many failed sign-in attempts from this network. ${wait}` }),
];
const adminLoginLimiters = [
    limiter({ limit: 8, failuresOnly: true, key: req => `admin:${ipOf(req)}:${accountOf(req)}`, message: `Too many failed sign-in attempts. ${wait}` }),
    limiter({ limit: 20, failuresOnly: true, key: req => `admin-account:${accountOf(req)}`, message: `Too many failed sign-in attempts. ${wait}` }),
    limiter({ limit: 100, failuresOnly: true, key: req => `admin-ip:${ipOf(req)}`, message: `Too many failed sign-in attempts. ${wait}` }),
];

// Signup sends an email, so it is limited per address; a class of students signing up together fits.
const registerLimiter = limiter({ limit: 150, key: req => `register:${ipOf(req)}`, message: `Too many sign-up attempts from this network. ${wait}` });
const verifyCodeLimiter = limiter({ limit: 600, failuresOnly: true, key: req => `verify:${ipOf(req)}`, message: `Too many incorrect codes. ${wait}` });
const passwordResetLimiter = limiter({ limit: 60, key: req => `reset:${ipOf(req)}`, message: `Too many password reset requests from this network. ${wait}` });
const resetCodeLimiter = limiter({ limit: 120, failuresOnly: true, key: req => `reset-code:${ipOf(req)}`, message: `Too many incorrect codes. ${wait}` });
const adminResetLimiter = limiter({ limit: 20, key: req => `admin-reset:${ipOf(req)}`, message: `Too many password reset requests. ${wait}` });
// Each admin account can only be sent a few reset codes per window, wherever the requests come from.
const adminAccountResetLimiter = limiter({ limit: 5, key: req => `admin-reset-account:${accountOf(req)}`, message: `Too many password reset requests. ${wait}` });
const googleLimiter = limiter({ limit: 300, key: req => `google:${ipOf(req)}`, message: `Too many sign-in attempts. ${wait}` });

module.exports = { apiLimiter, studentLoginLimiters, adminLoginLimiters, registerLimiter, verifyCodeLimiter, passwordResetLimiter, resetCodeLimiter, adminResetLimiter, adminAccountResetLimiter, googleLimiter, accountOf };
