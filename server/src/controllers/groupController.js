const Group = require("../models/Group");

const createExactNameRegex = (name) => {
    const escapedName = name.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return new RegExp(`^${escapedName}$`, "i");
};

const validateGroupName = (name) => {
    const trimmedName = name?.trim();
    if (!trimmedName) return { message: "Group name is required" };
    if (trimmedName.length < 2 || trimmedName.length > 80) return { message: "Group name must be between 2 and 80 characters" };
    return { trimmedName };
};

const createGroup = async (req, res) => {
    try {
        const { trimmedName, message } = validateGroupName(req.body.name);
        if (message) return res.status(400).json({ success: false, message });
        const existingGroup = await Group.findOne({ name: createExactNameRegex(trimmedName) });
        if (existingGroup) return res.status(400).json({ success: false, message: "Group already exists" });
        const group = await Group.create({ name: trimmedName });
        return res.status(201).json({ success: true, message: "Group created successfully", group });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getGroup = async (req, res) => {
    try {
        const groups = await Group.find().sort({ name: 1 });
        return res.status(200).json({ success: true, groups });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateGroup = async (req, res) => {
    try {
        const { trimmedName, message } = validateGroupName(req.body.name);
        if (message) return res.status(400).json({ success: false, message });
        const existingGroup = await Group.findOne({ _id: { $ne: req.params.id }, name: createExactNameRegex(trimmedName) });
        if (existingGroup) return res.status(400).json({ success: false, message: "Group already exists" });
        const group = await Group.findByIdAndUpdate(req.params.id, { name: trimmedName }, { new: true, runValidators: true });
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });
        return res.status(200).json({ success: true, message: "Group updated successfully", group });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteGroup = async (req, res) => {
    try {
        const deletedGroup = await Group.findByIdAndDelete(req.params.id);
        if (!deletedGroup) return res.status(404).json({ success: false, message: "Group not found" });
        return res.status(200).json({ success: true, message: "Group deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createGroup, getGroup, updateGroup, deleteGroup };
