const Admin = require("../models/Admin");
const jwt  = require('jsonwebtoken');
const bcrypt = require('bcryptjs')

const loginAdmin = async (req, res) => {
    try {
       
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });

        
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

      
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Wrong Password!",
            });
        }

        const token = jwt.sign(
            {
                id:admin._id,
                role:admin.role,
            },
            process.env.JWT_SECRET,
            {
                expiresIn:process.env.JWT_EXPIRES_IN,
            }
        )

        
        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getLoggedInAdmin = async (req, res) => {

    try{
        res.status(200).json({
            success:true,
            admin:req.admin
        });

    }catch(error){
        res.status(500).json({
            success:false,
            message:error.message
        })
    }
}

const getDashboard = async(req, res) => {
    try{
        res.json({
        sucess:true,
        message: `Welcome to Admin Dashboard ${req.admin.name}`,
    })
    }catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
}
}


module.exports = { loginAdmin, getLoggedInAdmin, getDashboard };
