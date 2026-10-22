// A few public lists (subjects, chapters, boards...) are read by every visitor and change rarely, so
// identical requests are answered from memory for a short time. Any content write clears the cache at once.
const entries = new Map();
const MAX_ENTRIES = 500;

const clearMicroCache = () => entries.clear();

const microCache = (ttlMs = 20000) => (req, res, next) => {
    // Signed-in requests (the admin screens) always see live data.
    if (req.method !== "GET" || req.headers.authorization) return next();
    const key = req.originalUrl;
    const hit = entries.get(key);
    if (hit && hit.expires > Date.now()) return res.status(hit.status).set("X-Cache", "HIT").json(hit.body);

    const send = res.json.bind(res);
    res.json = body => {
        if (res.statusCode === 200) {
            if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value);
            entries.set(key, { status: 200, body, expires: Date.now() + ttlMs });
        }
        return send(body);
    };
    next();
};

module.exports = { microCache, clearMicroCache };
