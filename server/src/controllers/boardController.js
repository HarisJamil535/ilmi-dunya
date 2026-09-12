const Board = require("../models/Board");

const createBoard = async (req, res) => {
    try {
        // Get board name from request body
        const { name } = req.body;

        // Validate input
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Board name is required",
            });
        }

        // Check if board already exists
        const existingBoard = await Board.findOne({ name });

        if (existingBoard) {
            return res.status(400).json({
                success: false,
                message: "Board already exists",
            });
        }

        // Create new board
        const board = await Board.create({
            name,
        });

        // Success response
        return res.status(201).json({
            success: true,
            message: "Board created successfully",
            board,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getBoards = async (req, res) => {
    try {

        const boards = await Board.find();

        return res.status(200).json({
            success: true,
            count: boards.length,
            boards,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const deleteBoard = async (req, res) => {
    try {

        const { id } = req.params;

        const board = await Board.findById(id);

        if (!board) {
            return res.status(404).json({
                success: false,
                message: "Board not found",
            });
        }

        await Board.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Board deleted successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    createBoard,
    getBoards,
    deleteBoard,
};