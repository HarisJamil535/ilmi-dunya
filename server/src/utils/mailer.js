const nodemailer = require("nodemailer");

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

const sendIlmiDunyaEmail = async ({ to, subject, html }) => {
    if (process.env.RESEND_API_KEY) {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: process.env.MAIL_FROM || "IlmiDunya <onboarding@resend.dev>",
                to,
                subject,
                html,
            }),
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(`Resend email failed: ${response.status} ${message}`);
        }

        return true;
    }

    if (!mailer) return false;
    await mailer.sendMail({
        from: process.env.MAIL_FROM || "IlmiDunya <no-reply@ilmidunya.pk>",
        to,
        subject,
        html,
    });
    return true;
};

module.exports = { sendIlmiDunyaEmail };
