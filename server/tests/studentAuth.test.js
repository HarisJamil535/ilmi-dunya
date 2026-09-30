const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizePakistaniPhone, authOptions } = require("../src/controllers/studentAuthController");
const Student = require("../src/models/Student");
const StudentAuthChallenge = require("../src/models/StudentAuthChallenge");

test("student WhatsApp numbers are normalized to E.164", () => {
    assert.equal(normalizePakistaniPhone("0300 1234567"), "+923001234567");
    assert.equal(normalizePakistaniPhone("+92 300 1234567"), "+923001234567");
    assert.equal(normalizePakistaniPhone("0092-300-1234567"), "+923001234567");
    assert.equal(normalizePakistaniPhone("+1 (415) 555-0134"), "+14155550134");
    assert.equal(normalizePakistaniPhone("not a phone"), "");
    assert.equal(normalizePakistaniPhone("+1234567890123456"), "");
});

test("auth options reveal enabled methods without exposing provider secrets", () => {
    const response = {
        headers: {},
        set(name, value) { this.headers[name] = value; return this; },
        json(value) { this.body = value; return this; },
    };
    authOptions({}, response);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(typeof response.body.channels.email, "boolean");
    assert.equal(typeof response.body.channels.whatsapp, "boolean");
    assert.equal(typeof response.body.googleClientId, "string");
    assert.equal(Object.keys(response.body).some((key) => /token|secret|sid/i.test(key)), false);
});

test("student model permits Google-only accounts without a password", async () => {
    const student = new Student({
        name: "Ayesha Khan",
        email: "ayesha@example.com",
        phone: "+923001234567",
        city: "Lahore",
        school: "Private Candidate",
        googleSub: "google-subject-id",
        isEmailVerified: true,
    });
    await assert.doesNotReject(student.validate());
    assert.equal(student.password, null);
});

test("verification challenge schema has an expiry TTL index", () => {
    const ttlIndex = StudentAuthChallenge.schema.indexes().find(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0);
    assert.ok(ttlIndex, "expired OTP challenges should be removed automatically");
});
