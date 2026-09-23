const nodemailer = require("nodemailer");

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const sendWithResend = async ({ to, subject, html }) => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return false;

    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: process.env.MAIL_FROM?.trim() || "IlmiDunya <onboarding@resend.dev>",
                to: [to],
                subject,
                html,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (response.ok) return true;

        const message = await response.text();
        lastError = new Error(`Resend rejected email (${response.status}): ${message}`);
        lastError.code = `RESEND_${response.status}`;
        if (response.status !== 429 && response.status < 500) throw lastError;
        if (attempt === 0) await wait(350);
    }

    throw lastError;
};

const sendWithSmtp = async ({ to, subject, html }) => {
    if (!mailer) return false;
    await mailer.sendMail({
        from: process.env.MAIL_FROM?.trim() || "IlmiDunya <no-reply@ilmidunya.pk>",
        to,
        subject,
        html,
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

module.exports = { sendIlmiDunyaEmail };
