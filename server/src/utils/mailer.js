const nodemailer = require("nodemailer");

// Values pasted into hosting panels often keep quotes or spaces; both break SMTP logins silently.
const setting = (name) => String(process.env[name] ?? "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();
const emailAddressIn = (value) => (/<([^>]+)>/.exec(value)?.[1] || value || "").trim().toLowerCase();
const domainOf = (address) => emailAddressIn(address).split("@")[1] || "";

function smtpSettings() {
    const host = setting("SMTP_HOST");
    if (!host) return null;
    const port = Number(setting("SMTP_PORT") || 587);
    const secureSetting = setting("SMTP_SECURE").toLowerCase();
    return {
        host,
        port,
        // Port 465 always needs SSL from the first byte; a missing SMTP_SECURE there makes every send hang.
        secure: secureSetting ? secureSetting === "true" : port === 465,
        user: setting("SMTP_USER"),
        pass: setting("SMTP_PASS"),
    };
}

let transport;
let transportKey;
const smtpTransport = () => {
    const config = smtpSettings();
    if (!config) return null;
    const key = JSON.stringify(config);
    if (transport && transportKey === key) return transport;
    transportKey = key;
    transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user ? { user: config.user, pass: config.pass } : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
    return transport;
};

// Mail servers refuse or spam-file mail "from" an address the account does not own, so SMTP defaults to the login mailbox.
const senderFor = (provider) => {
    const configured = setting("MAIL_FROM");
    if (configured) return configured;
    if (provider === "smtp" && setting("SMTP_USER").includes("@")) return `IlmiDunya <${setting("SMTP_USER")}>`;
    return provider === "resend" ? "IlmiDunya <onboarding@resend.dev>" : "IlmiDunya <no-reply@ilmidunya.org>";
};

const plainText = (html) => String(html)
    .replace(/<\/(p|h\d|div)>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const sendWithResend = async ({ to, subject, html }) => {
    const apiKey = setting("RESEND_API_KEY");
    if (!apiKey) return false;

    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: senderFor("resend"), to: [to], subject, html, text: plainText(html) }),
            signal: AbortSignal.timeout(10000),
        });

        if (response.ok) return true;

        const message = await response.text();
        lastError = new Error(`Resend rejected email (${response.status}): ${message.slice(0, 300)}`);
        lastError.code = `RESEND_${response.status}`;
        if (response.status !== 429 && response.status < 500) throw lastError;
        if (attempt === 0) await wait(350);
    }

    throw lastError;
};

const sendWithSmtp = async ({ to, subject, html }) => {
    const mailer = smtpTransport();
    if (!mailer) return false;
    const from = senderFor("smtp");
    await mailer.sendMail({
        from,
        to,
        subject,
        html,
        text: plainText(html),
        // Replies reach the mailbox that actually exists.
        replyTo: setting("SUPPORT_EMAIL") || emailAddressIn(from),
    });
    return true;
};

const sendIlmiDunyaEmail = async (message) => {
    let resendError;
    try {
        const sent = await sendWithResend(message);
        if (sent) return true;
    } catch (error) {
        resendError = error;
    }

    try {
        const sent = await sendWithSmtp(message);
        if (sent) return true;
    } catch (smtpError) {
        if (!resendError) throw smtpError;
        resendError.message += `; SMTP fallback failed: ${smtpError.message}`;
    }

    if (resendError) throw resendError;
    return false;
};

// Settings problems that stop codes from arriving, in plain words, without revealing any secret.
function emailSetupReport() {
    const smtp = smtpSettings();
    const resend = Boolean(setting("RESEND_API_KEY"));
    const warnings = [];
    if (!smtp && !resend) warnings.push("No email service is set. Add SMTP_HOST, SMTP_USER and SMTP_PASS (or RESEND_API_KEY).");
    if (smtp) {
        if (!smtp.user || !smtp.pass) warnings.push("SMTP_USER and SMTP_PASS must both be set.");
        if (smtp.port === 465 && !smtp.secure) warnings.push("Port 465 needs SMTP_SECURE=true (or remove SMTP_SECURE).");
        if (smtp.port === 587 && smtp.secure) warnings.push("Port 587 needs SMTP_SECURE=false (or remove SMTP_SECURE).");
        const from = senderFor("smtp");
        if (smtp.user.includes("@") && domainOf(from) && domainOf(from) !== domainOf(smtp.user)) {
            warnings.push(`MAIL_FROM (${emailAddressIn(from)}) is on a different domain from the SMTP mailbox (${smtp.user}). Most mail servers reject or spam-file this; use the mailbox address in MAIL_FROM.`);
        }
    }
    if (resend && /@resend\.dev$/i.test(emailAddressIn(senderFor("resend")))) {
        warnings.push("Resend's test sender (onboarding@resend.dev) only delivers to your own Resend account address. Verify your domain in Resend and set MAIL_FROM to an address on it.");
    }
    return {
        provider: resend ? (smtp ? "Resend, then SMTP if Resend fails" : "Resend") : smtp ? "SMTP" : "none",
        smtp: smtp ? { host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, passwordSet: Boolean(smtp.pass) } : null,
        from: smtp ? senderFor("smtp") : resend ? senderFor("resend") : "",
        warnings,
    };
}

// Logs in to the SMTP server without sending anything, to catch a wrong password or blocked port early.
async function verifySmtpLogin() {
    const mailer = smtpTransport();
    if (!mailer) return { ok: false, message: "SMTP is not set." };
    try {
        await mailer.verify();
        return { ok: true, message: "Signed in to the SMTP server successfully." };
    } catch (error) {
        return { ok: false, message: describeEmailError(error) };
    }
}

// Turns provider errors into advice an admin can act on.
function describeEmailError(error) {
    const text = String(error?.message || error || "");
    const code = String(error?.code || "");
    if (code === "EAUTH" || /535|authentication|invalid login|username and password/i.test(text)) return `The mail server refused the login. Check SMTP_USER (the full mailbox address) and SMTP_PASS (the mailbox password). (${text.slice(0, 160)})`;
    if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNREFUSED"].includes(code) || /timeout|timed out|ECONNREFUSED|greeting/i.test(text)) return `Could not connect to ${smtpSettings()?.host || "the mail server"}. Check SMTP_HOST and the port (465 with SMTP_SECURE=true, or 587 with SMTP_SECURE=false); some hosts block outgoing mail ports. (${text.slice(0, 160)})`;
    if (/sender|from address|not owned|553|550 5\.7\.1|spoof/i.test(text)) return `The mail server rejected the sender address. Set MAIL_FROM to the same mailbox as SMTP_USER. (${text.slice(0, 160)})`;
    if (/RESEND_403|testing emails|verify a domain/i.test(`${code} ${text}`)) return `Resend refused: until a domain is verified, it only sends to your own Resend address. Verify your domain in Resend and set MAIL_FROM on it. (${text.slice(0, 160)})`;
    if (/RESEND_401|api key/i.test(`${code} ${text}`)) return "Resend refused the API key. Check RESEND_API_KEY.";
    return text.slice(0, 300) || "Unknown email error.";
}

module.exports = { sendIlmiDunyaEmail, emailSetupReport, verifySmtpLogin, describeEmailError };
