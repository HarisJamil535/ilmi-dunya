const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const bcrypt = require("bcryptjs");
const { hashPassword, verifyPassword } = require("../src/services/passwords");
const { withLock, pendingLocks } = require("../src/services/keyedLock");
const { microCache, clearMicroCache } = require("../src/middleware/microCache");
const limits = require("../src/middleware/rateLimits");
const Assessment = require("../src/models/Assessment");
const Attempt = require("../src/models/AssessmentAttempt");
const Question = require("../src/models/Question");
const Activity = require("../src/models/LearningActivity");
const { startAttempt } = require("../src/controllers/attemptController");
const id = n => String(n).padStart(24, "0");
afterEach(() => mock.restoreAll());

test("passwords are stored as scrypt and verified without freezing the server", async () => {
    const hash = await hashPassword("Passw0rdOK1");
    assert.match(hash, /^scrypt\$14\$8\$1\$/);
    assert.notEqual(hash, await hashPassword("Passw0rdOK1"), "every hash has its own salt");
    assert.deepEqual(await verifyPassword("Passw0rdOK1", hash), { valid: true, upgrade: false });
    assert.deepEqual(await verifyPassword("passw0rdok1", hash), { valid: false, upgrade: false });
    // Hashing and checking happen on worker threads, so timers keep firing meanwhile.
    let ticks = 0;
    const timer = setInterval(() => { ticks += 1; }, 10);
    await Promise.all(Array.from({ length: 8 }, () => verifyPassword("Passw0rdOK1", hash)));
    clearInterval(timer);
    assert.ok(ticks >= 5, `event loop stayed responsive (${ticks} ticks)`);
});

test("older bcrypt hashes still work and are flagged for upgrade; bad input never throws", async () => {
    const legacy = await bcrypt.hash("Passw0rdOK1", 4);
    assert.deepEqual(await verifyPassword("Passw0rdOK1", legacy), { valid: true, upgrade: true });
    assert.deepEqual(await verifyPassword("nope", legacy), { valid: false, upgrade: false });
    for (const stored of [undefined, null, "", "scrypt$bad", "scrypt$15$8$1$$", "$2a$garbage", "plain-text"]) {
        assert.equal((await verifyPassword("Passw0rdOK1", stored)).valid, false);
    }
    assert.equal((await verifyPassword("x".repeat(300), await hashPassword("x"))).valid, false, "oversized passwords are refused cheaply");
    assert.equal((await verifyPassword(undefined, legacy)).valid, false);
});

test("a hash made with an older cost still verifies and is upgraded to the current cost", async () => {
    const crypto = require("node:crypto");
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync("Passw0rdOK1", salt, 64, { N: 2 ** 13, r: 8, p: 1 });
    const older = `scrypt$13$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
    assert.deepEqual(await verifyPassword("Passw0rdOK1", older), { valid: true, upgrade: true });
    assert.deepEqual(await verifyPassword("wrong", older), { valid: false, upgrade: false });
});

test("jobs with the same key never overlap; different keys run together", async () => {
    const order = [];
    const job = (name, ms) => async () => { order.push(`${name}:start`); await new Promise(resolve => setTimeout(resolve, ms)); order.push(`${name}:end`); return name; };
    const results = await Promise.all([withLock("a", job("a1", 30)), withLock("a", job("a2", 5)), withLock("b", job("b1", 5))]);
    assert.deepEqual(results, ["a1", "a2", "b1"]);
    assert.ok(order.indexOf("a1:end") < order.indexOf("a2:start"), "second job waits for the first");
    assert.ok(order.indexOf("b1:start") < order.indexOf("a1:end"), "other keys are not delayed");
    await assert.rejects(withLock("c", async () => { throw new Error("boom"); }), /boom/);
    assert.equal(await withLock("c", async () => "after failure"), "after failure", "a failed job does not block the key");
    assert.equal(pendingLocks(), 0, "no locks are left behind");
});

const attemptFixtures = () => {
    const questions = Array.from({ length: 3 }, (_, index) => ({ question: id(index + 1), marks: 1, order: index + 1 }));
    const assessment = { _id: id(90), type: "subject_test", status: "published", createdBy: id(91), questions, totalMarks: 3, passingMarks: 1, durationMinutes: 10, allowResume: true };
    const query = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
    return { assessment, query };
};

test("double-clicking Start creates one attempt, even when both requests arrive together", async () => {
    const { assessment, query } = attemptFixtures();
    let created = null;
    let creates = 0;
    mock.method(Assessment, "findById", () => query(assessment));
    mock.method(Attempt, "countDocuments", async () => 0);
    // The resume check is awaited directly; the later read of the attempt is a populated query.
    mock.method(Attempt, "findOne", filter => filter._id ? query(created) : Promise.resolve(created));
    mock.method(Attempt, "create", async payload => { creates += 1; await new Promise(resolve => setTimeout(resolve, 20)); created = { ...payload, _id: id(100), status: "in_progress", expiresAt: new Date(Date.now() + 600000) }; return created; });
    mock.method(Question, "find", filter => query(filter._id.$in.map(_id => ({ _id, type: "standard_mcq", correctOption: "A", marks: 1 }))));
    mock.method(Activity, "create", async () => ({}));
    const responses = [];
    const call = () => startAttempt({ body: { assessmentId: id(90) }, student: { _id: id(93) } }, { json(value) { responses.push(value); }, status() { return this; } });
    await Promise.all([call(), call(), call()]);
    assert.equal(creates, 1);
    assert.equal(responses.length, 3);
});

const appWith = (...handlers) => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.post("/login", ...handlers, (req, res) => res.status(req.body.password === "right" ? 200 : 401).json({}));
    return app;
};
async function serve(t, app) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}`;
    return (path, { ip, body, headers } = {}) => fetch(url + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip || "10.0.0.1", ...headers }, body: body && JSON.stringify(body) }).then(response => response.status);
}

test("sign-in limits count failed attempts per account, so a shared school IP is not locked out", async t => {
    const post = await serve(t, appWith(...limits.studentLoginLimiters));
    const attempt = (account, password, ip) => post("/login", { ip, body: { identifier: account, password } });
    // One student mistyping 10 times from the school network is stopped on the 11th try...
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push(await attempt("Ali@Example.com", "wrong", "198.51.100.1"));
    assert.deepEqual(codes, [...Array(10).fill(401), 429]);
    // ...but classmates behind the same IP are unaffected, and correct sign-ins are never counted.
    for (let i = 0; i < 60; i++) assert.equal(await attempt(`student${i}@example.com`, "right", "198.51.100.1"), 200);
    assert.equal(await attempt("ali@example.com", "right", "203.0.113.9"), 200, "the owner can still sign in from home");
    // The same account written differently is the same account.
    assert.equal(await attempt(" ALI@example.com ", "wrong", "198.51.100.1"), 429);
});

test("password guessing spread over many networks is stopped per account", async t => {
    const post = await serve(t, appWith(...limits.studentLoginLimiters));
    const codes = [];
    for (let i = 0; i < 32; i++) codes.push(await post("/login", { ip: `192.0.2.${i + 1}`, body: { identifier: "victim@example.com", password: "wrong" } }));
    assert.deepEqual([codes.slice(0, 30).every(code => code === 401), codes.slice(30)], [true, [429, 429]]);
    assert.equal(await post("/login", { ip: "192.0.2.200", body: { identifier: "someone.else@example.com", password: "right" } }), 200);
});

test("limits identify accounts by normalised email or phone and ignore odd input", () => {
    assert.equal(limits.accountOf({ body: { identifier: " Ali@Example.COM " } }), "ali@example.com");
    assert.equal(limits.accountOf({ body: { identifier: "0300 123-4567" } }), "03001234567");
    assert.equal(limits.accountOf({ body: { email: "A@B.C" } }), "a@b.c");
    for (const body of [undefined, {}, { identifier: { $ne: "" } }, { identifier: ["a"] }, { identifier: 5 }]) assert.equal(limits.accountOf({ body }), "");
    assert.equal(limits.accountOf({ body: { identifier: "x".repeat(500) } }).length, 120);
});

test("a class of 40 students can sign up from one IP address", async t => {
    const app = express();
    app.set("trust proxy", 1);
    app.post("/register", limits.registerLimiter, (req, res) => res.sendStatus(202));
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const statuses = [];
    for (let i = 0; i < 40; i++) statuses.push((await fetch(`http://127.0.0.1:${server.address().port}/register`, { method: "POST", headers: { "X-Forwarded-For": "198.51.100.77" } })).status);
    assert.ok(statuses.every(status => status === 202), statuses.join());
});

test("the public list cache serves repeats, skips signed-in requests and clears on demand", async t => {
    let reads = 0;
    const app = express();
    app.use("/list", microCache(60000));
    app.get("/list", (req, res) => { reads += 1; res.status(req.query.fail ? 500 : 200).json({ reads }); });
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/list`;
    const json = async (path = "", headers = {}) => { const response = await fetch(url + path, { headers }); return { status: response.status, cache: response.headers.get("x-cache"), body: await response.json() }; };
    clearMicroCache();
    assert.equal((await json()).cache, null);
    const hit = await json();
    assert.deepEqual([hit.cache, hit.body.reads], ["HIT", 1]);
    assert.equal((await json("?other=1")).cache, null, "a different query is a different entry");
    const signedIn = await json("", { Authorization: "Bearer x" });
    assert.deepEqual([signedIn.cache, signedIn.body.reads], [null, 3], "signed-in requests always read live data");
    await json("?fail=1");
    assert.equal((await json("?fail=1")).body.reads, 5, "errors are never cached");
    clearMicroCache();
    assert.equal((await json()).body.reads, 6);
});

test("the API accepts the site's own host (www or not) and refuses unknown origins", async t => {
    const app = require("../server");
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const status = async origin => (await fetch(`${base}/api/not-a-route`, { headers: origin ? { Origin: origin } : {} })).status;
    assert.equal(await status(null), 404);
    assert.equal(await status(base), 404, "same host is never cross-origin");
    assert.equal(await status("https://evil.example"), 403);
    assert.equal(await status("https://evil.example:5000"), 403);
});

test("expensive jobs run a few at a time and the rest wait their turn", async () => {
    const { createConcurrencyLimit } = require("../src/services/concurrencyLimit");
    const limit = createConcurrencyLimit(2);
    let running = 0;
    let peak = 0;
    const job = async n => { running += 1; peak = Math.max(peak, running); await new Promise(resolve => setTimeout(resolve, 10)); running -= 1; return n; };
    const results = await Promise.all(Array.from({ length: 7 }, (_, n) => limit(() => job(n))));
    assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(peak, 2);
    await assert.rejects(limit(async () => { throw new Error("fails"); }), /fails/);
    assert.equal(await limit(async () => "still works"), "still works");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(limit.stats(), { active: 0, waiting: 0 });
});
