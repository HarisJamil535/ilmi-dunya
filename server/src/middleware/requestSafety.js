function unsafeKeys(value, depth = 0) {
    if (!value || typeof value !== 'object') return false;
    if (depth > 20) return true;
    return Object.entries(value).some(([key, child]) => key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key) || unsafeKeys(child, depth + 1));
}
function requestSafety(req, res, next) {
    if (unsafeKeys(req.body) || unsafeKeys(req.query)) return res.status(400).json({ success: false, message: 'Unsupported request fields.' });
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cache-Control', 'private, no-store');
    next();
}
function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    const status = error.code === 11000 ? 409 : error.name === 'ValidationError' || error.name === 'CastError' ? 400 : error.code === 'LIMIT_FILE_SIZE' ? 413 : error.status || error.statusCode || 500;
    const message = error.code === 11000 ? 'This content already exists. Edit the existing item or use a unique title and scope.' : error.name === 'ValidationError' ? Object.values(error.errors).map(item => item.message).join(' ') : error.name === 'CastError' ? 'Please choose a valid item.' : error.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file is too large.' : status >= 500 ? 'Something went wrong. Please try again.' : error.message;
    res.status(status).json({ success: false, message });
}
module.exports = { unsafeKeys, requestSafety, errorHandler };
