const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();


const bcrypt = require("bcryptjs");

const connectDB = require("../config/db");
const Admin = require("../models/Admin");

const createSuperAdmin = async () => {
  try {
    // Connect Database
    await connectDB();


    // Check if admin already exists
    const adminExists = await Admin.findOne({
      email: "admin@ilmidunya.com",
    });

    if (adminExists) {
      process.exit();
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash("123456", 10);

    // Create Admin
    await Admin.create({
      name: "Haris Jamil",
      email: "admin@ilmidunya.com",
      password: hashedPassword,
      role: "super_admin",
    });

    process.exit();
  } catch {
    process.exit(1);
  }
};

createSuperAdmin();
