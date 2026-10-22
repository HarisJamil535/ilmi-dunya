const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

// scrypt runs on libuv's thread pool, so signing in never freezes the website for other visitors.
// (bcryptjs is pure JavaScript: one cost-12 check blocks the whole server for ~0.4 s.)
const COST = { N: 2 ** 14, r: 8, p: 1 };
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * 1024 * 1024;
const MAX_PASSWORD_LENGTH = 256;

const scrypt = (password, salt, cost) => new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N: cost.N, r: cost.r, p: cost.p, maxmem: MAX_MEMORY }, (error, key) => error ? reject(error) : resolve(key));
});

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, COST);
    return `scrypt$${Math.log2(COST.N)}$${COST.r}$${COST.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

// Resolves { valid, upgrade }. `upgrade` is true when the stored hash is an older bcrypt hash
// that should be replaced with a scrypt hash now that the password is known to be right.
async function verifyPassword(password, stored) {
    if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) return { valid: false, upgrade: false };
    if (typeof stored !== "string" || !stored) {
        await scrypt(password, Buffer.alloc(16), COST).catch(() => {});
        return { valid: false, upgrade: false };
    }
    if (stored.startsWith("scrypt$")) {
        const [, log, r, p, salt, key] = stored.split("$");
        const cost = { N: 2 ** Number(log), r: Number(r), p: Number(p) };
        if (![cost.N, cost.r, cost.p].every(Number.isSafeInteger) || !salt || !key) return { valid: false, upgrade: false };
        const expected = Buffer.from(key, "base64");
        const actual = await scrypt(password, Buffer.from(salt, "base64"), cost);
        const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
        return { valid, upgrade: valid && (cost.N !== COST.N || cost.r !== COST.r || cost.p !== COST.p) };
    }
    // Hashes created before scrypt was introduced.
    const valid = await bcrypt.compare(password, stored).catch(() => false);
    return { valid, upgrade: valid };
}

module.exports = { hashPassword, verifyPassword, MAX_PASSWORD_LENGTH };
