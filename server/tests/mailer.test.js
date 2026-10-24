const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "RESEND_API_KEY"];
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterEach(() => keys.forEach(key => { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }));
const withEnv = (values) => { keys.forEach(key => delete process.env[key]); Object.assign(process.env, values); return require("../src/utils/mailer"); };

test("port 465 uses SSL unless told otherwise, and pasted quotes are ignored", () => {
    const { emailSetupReport } = withEnv({ SMTP_HOST: "smtp.hostinger.com", SMTP_PORT: "465", SMTP_USER: "info@ilmidunya.org", SMTP_PASS: "\"secret\"" });
    const report = emailSetupReport();
    assert.equal(report.smtp.secure, true);
    assert.equal(report.from, "IlmiDunya <info@ilmidunya.org>", "the sender defaults to the mailbox that logs in");
    assert.deepEqual(report.warnings, []);
    assert.equal(withEnv({ SMTP_HOST: "smtp.hostinger.com", SMTP_PORT: "587", SMTP_USER: "a@b.org", SMTP_PASS: "x" }).emailSetupReport().smtp.secure, false);
});

test("setup problems that stop codes from arriving are named", () => {
    const warnings = (env) => withEnv(env).emailSetupReport().warnings.join(" | ");
    assert.match(warnings({}), /No email service/);
    assert.match(warnings({ SMTP_HOST: "h", SMTP_PORT: "465", SMTP_SECURE: "false", SMTP_USER: "a@x.org", SMTP_PASS: "p" }), /Port 465 needs SMTP_SECURE=true/);
    assert.match(warnings({ SMTP_HOST: "h", SMTP_USER: "info@ilmidunya.org", SMTP_PASS: "p", MAIL_FROM: "IlmiDunya <no-reply@ilmidunya.pk>" }), /different domain/);
    assert.match(warnings({ SMTP_HOST: "h", SMTP_USER: "info@ilmidunya.org" }), /SMTP_USER and SMTP_PASS/);
    assert.match(warnings({ RESEND_API_KEY: "re_x" }), /onboarding@resend\.dev/);
    assert.doesNotMatch(warnings({ RESEND_API_KEY: "re_x", MAIL_FROM: "IlmiDunya <codes@ilmidunya.org>" }), /resend\.dev/);
});

test("provider errors are explained in words an admin can act on", () => {
    const { describeEmailError } = withEnv({ SMTP_HOST: "smtp.hostinger.com" });
    assert.match(describeEmailError(Object.assign(new Error("Invalid login: 535 authentication failed"), { code: "EAUTH" })), /refused the login/);
    assert.match(describeEmailError(Object.assign(new Error("Greeting never received"), { code: "ETIMEDOUT" })), /Could not connect to smtp\.hostinger\.com/);
    assert.match(describeEmailError(new Error("553 5.7.1 Sender address rejected: not owned by user")), /sender address/);
    assert.match(describeEmailError(Object.assign(new Error("You can only send testing emails to your own email address"), { code: "RESEND_403" })), /verified/);
});
