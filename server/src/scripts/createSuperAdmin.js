require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");

// Credentials come only from the environment so no default password exists in source control.
// Usage: SUPER_ADMIN_NAME="..." SUPER_ADMIN_EMAIL="..." SUPER_ADMIN_PASSWORD="..." npm --prefix server run create-super-admin
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function credentials() {
    const name = (process.env.SUPER_ADMIN_NAME || "").trim();
    const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD || "";
    const problems = [];
    if (name.length < 2) problems.push("SUPER_ADMIN_NAME must contain the administrator's name.");
    if (!emailPattern.test(email)) problems.push("SUPER_ADMIN_EMAIL must be a valid email address.");
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || Buffer.byteLength(password, "utf8") > 72) {
        problems.push("SUPER_ADMIN_PASSWORD must be 12 to 72 bytes and include letters and numbers.");
    }
    if (problems.length) throw new Error(problems.join("\n"));
    return { name, email, password };
}

async function main() {
    const { name, email, password } = credentials();
    await connectDB();
    if (await Admin.exists({ email })) {
        process.stdout.write(`An admin with ${email} already exists. No changes were made.\n`);
        return;
    }
    await Admin.create({ name, email, password: await bcrypt.hash(password, 12), role: "super_admin" });
    process.stdout.write(`Super admin ${email} created. Remove SUPER_ADMIN_PASSWORD from the environment now.\n`);
}

main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());
