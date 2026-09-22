const nodemailer = require("nodemailer");

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

const sendIlmiDunyaEmail = async ({ to, subject, html }) => {
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
