const Class = require("../models/Class");

const createExactNameRegex = (name) => {
    const escapedName = name.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return new RegExp(`^${escapedName}$`, "i");
};

const validateClassName = (name) => {
    const trimmedName = name?.trim();
    if (!trimmedName) return { message: "Class name is required" };
    if (trimmedName.length < 1 || trimmedName.length > 40) return { message: "Class name must be 40 characters or fewer" };
    return { trimmedName };
};

const createClass = async (req, res) => {
    try {
        const { trimmedName, message } = validateClassName(req.body.name);
        if (message) return res.status(400).json({ success: false, message });
        const existingClass = await Class.findOne({ name: createExactNameRegex(trimmedName) });
        if (existingClass) return res.status(400).json({ success: false, message: "Class already exists" });
        const newClass = await Class.create({ name: trimmedName });
        return res.status(201).json({ success: true, message: "Class created successfully", class: newClass });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getClass = async (req, res) => {
    try {
        const classes = await Class.find().sort({ name: 1 });
        return res.status(200).json({ success: true, classes });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateClass = async (req, res) => {
    try {
        const { trimmedName, message } = validateClassName(req.body.name);
        if (message) return res.status(400).json({ success: false, message });
        const existingClass = await Class.findOne({ _id: { $ne: req.params.id }, name: createExactNameRegex(trimmedName) });
        if (existingClass) return res.status(400).json({ success: false, message: "Class already exists" });
        const updatedClass = await Class.findByIdAndUpdate(req.params.id, { name: trimmedName }, { new: true, runValidators: true });
        if (!updatedClass) return res.status(404).json({ success: false, message: "Class not found" });
        return res.status(200).json({ success: true, message: "Class updated successfully", class: updatedClass });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteClass = async (req, res) => {
    try {
        const deletedClass = await Class.findByIdAndDelete(req.params.id);
        if (!deletedClass) return res.status(404).json({ success: false, message: "Class not found" });
        return res.status(200).json({ success: true, message: "Class deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createClass, getClass, updateClass, deleteClass };
