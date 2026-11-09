// One address for the whole site. A page reached through another host name (www.ilmidunya.org when the site is
// ilmidunya.org, or the other way round) or over plain http is sent, permanently, to the address in SITE_URL.
// Search engines otherwise see the same page twice and may pick the wrong copy as the main one.
function canonicalHost({ siteUrl = process.env.SITE_URL, trustProxy = false } = {}) {
    let site = null;
    try { site = siteUrl ? new URL(siteUrl) : null; } catch { site = null; }
    const local = host => !host || /^(localhost|127\.0\.0\.1|\[::1\]|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(host);
    return function redirectToCanonicalHost(req, res, next) {
        if (!site || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
        if (req.path.startsWith('/api/') || req.path === '/health') return next();
        const host = req.get('host');
        // Health checks and local tools reach the server by address, not by name; those are left alone.
        if (local(host) || local(site.host)) return next();
        const wrongHost = host.toLowerCase() !== site.host.toLowerCase();
        // The protocol is only known when the proxy in front of the server reports it (TRUST_PROXY_HOPS).
        const wrongProtocol = Boolean(trustProxy) && site.protocol === 'https:' && req.protocol !== 'https';
        if (!wrongHost && !wrongProtocol) return next();
        return res.redirect(301, `${site.origin}${req.originalUrl}`);
    };
}
module.exports = { canonicalHost };
