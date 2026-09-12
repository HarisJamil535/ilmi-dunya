const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(

    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            default: "super_admin",
        },
    },
    {
        timestamps: true,
    }

);

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;