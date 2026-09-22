const Board = require("../models/Board");

const createExactNameRegex = (name) => {
    const escapedName = name.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return new RegExp(`^${escapedName}$`, "i");
};

const validateBoardName = (name) => {
    const trimmedName = name?.trim();
    if (!trimmedName) return { message: "Board name is required" };
    if (trimmedName.length < 2 || trimmedName.length > 80) return { message: "Board name must be between 2 and 80 characters" };
    return { trimmedName };
};

const createBoard = async (req, res) => {
    try {
        const { trimmedName, message } = validateBoardName(req.body.name);
        if (message) return res.status(400).json({ success: false, message });
        const existingBoard = await Board.findOne({ name: createExactNameRegex(trimmedName) });
        if (existingBoard) return res.status(400).json({ success: false, message: "Board already exists" });
        const board = await Board.create({ name: trimmedName });
        return res.status(201).json({ success: true, message: "Board created successfully", board });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getBoards = async (req, res) => {
    try {
        const boards = await Board.find().sort({ name: 1 });
        return res.status(200).json({ success: true, count: boards.length, boards });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateBoard = async (req, res) => {
    try {
        const { trimmedName, message } = validateBoardName(req.body.name);
        if (message) return res.status(400).json({ success: false, message });
        const existingBoard = await Board.findOne({ _id: { $ne: req.params.id }, name: createExactNameRegex(trimmedName) });
        if (existingBoard) return res.status(400).json({ success: false, message: "Board already exists" });
        const board = await Board.findByIdAndUpdate(req.params.id, { name: trimmedName }, { new: true, runValidators: true });
        if (!board) return res.status(404).json({ success: false, message: "Board not found" });
        return res.status(200).json({ success: true, message: "Board updated successfully", board });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteBoard = async (req, res) => {
    try {
        const board = await Board.findByIdAndDelete(req.params.id);
        if (!board) return res.status(404).json({ success: false, message: "Board not found" });
        return res.status(200).json({ success: true, message: "Board deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createBoard, getBoards, updateBoard, deleteBoard };
