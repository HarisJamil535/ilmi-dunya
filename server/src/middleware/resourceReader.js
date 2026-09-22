const jwt = require('jsonwebtoken');
const adminAuth = require('./authMiddleware');
const studentAuth = require('./studentAuthMiddleware');

module.exports = (req, res, next) => {
    if (!req.headers.authorization) return next();
    // Decoding only chooses a verifier; no access is granted until it validates the JWT.
    const token = req.headers.authorization.split(' ')[1];
    const role = jwt.decode(token)?.role;
    return role === 'student' ? studentAuth(req, res, next) : adminAuth(req, res, next);
};
