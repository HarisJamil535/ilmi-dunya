const { sendIlmiDunyaEmail } = require("../utils/mailer");

const emailDeliveryConfigured = () => Boolean(
    process.env.RESEND_API_KEY?.trim() ||
    (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim())
);

const whatsappDeliveryConfigured = () => Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_VERIFY_SERVICE_SID?.trim()
);

const startWhatsAppVerification = async (phone) => {
    if (!whatsappDeliveryConfigured()) throw Object.assign(new Error("WhatsApp verification is not configured."), { status: 503 });
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID.trim();
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID.trim()}:${process.env.TWILIO_AUTH_TOKEN.trim()}`).toString("base64");
    const body = new URLSearchParams({ To: phone, Channel: "whatsapp" });
    const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        const error = new Error(`WhatsApp verification provider rejected the request (${response.status}).`);
        error.status = response.status === 429 ? 429 : 503;
        throw error;
    }
};

const checkWhatsAppVerification = async (phone, code) => {
    if (!whatsappDeliveryConfigured()) throw Object.assign(new Error("WhatsApp verification is not configured."), { status: 503 });
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID.trim();
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID.trim()}:${process.env.TWILIO_AUTH_TOKEN.trim()}`).toString("base64");
    const body = new URLSearchParams({ To: phone, Code: code });
    const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        if (response.status === 404 || response.status === 400) return false;
        throw Object.assign(new Error("WhatsApp code verification is temporarily unavailable."), { status: 503 });
    }
    const result = await response.json();
    return result.status === "approved";
};

const sendEmailOtp = async ({ to, name, code, purpose }) => {
    const subject = purpose === "signup" ? "Verify your IlmiDunya account" : purpose === "login" ? "Your IlmiDunya sign-in code" : "Your IlmiDunya password reset code";
    const heading = purpose === "signup" ? "Verify your email" : purpose === "login" ? "Sign in to IlmiDunya" : "Reset your password";
    const sent = await sendIlmiDunyaEmail({
        to,
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17202a"><h1 style="color:#5938c8">${heading}</h1><p>${name ? `Hello ${name}, ` : ""}use this one-time verification code to continue:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#24154d">${code}</p><p>This code expires in 10 minutes and can only be used once. If you did not request it, you can ignore this email.</p><p>Team IlmiDunya</p></div>`,
    });
    if (!sent) throw Object.assign(new Error("Email delivery is not configured."), { status: 503 });
};

module.exports = { emailDeliveryConfigured, whatsappDeliveryConfigured, startWhatsAppVerification, checkWhatsAppVerification, sendEmailOtp };
