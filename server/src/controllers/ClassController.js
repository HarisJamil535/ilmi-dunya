const Board = require("../models/Board");
const Class = require("../models/Class");

const createClass = async (req, res) => {
    try {
        const { name } = req.body;

       
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Class name is required",
            });
        }

       
        const existingClass = await Class.findOne({ name });

        if (existingClass) {
            return res.status(400).json({
                success: false,
                message: "Class already exists",
            });
        }

        // Create class
        const newClass = await Class.create({
            name,
        });

        return res.status(201).json({
            success: true,
            message: "Class created successfully",
            class: newClass,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
const getClass = async (req, res) => {
    try {
        const classes = await Class.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            classes,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedClass = await Class.findByIdAndDelete(id);

    if (!deletedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
    createClass,
    getClass,
    deleteClass
};