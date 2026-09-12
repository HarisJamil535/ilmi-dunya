// const Subject = require("../models/Subject");
// const Board = require("../models/Board");
// const Class = require("../models/Class");
// const Group = require("../models/Group");

// // 1. Create Subject
// const createSubject = async (req, res) => {
//     try {
//         const { name, code, board, class: className, group } = req.body;

//         if (!name || !board || !className || !group) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Board, Class, Group, and Subject Name are required fields.",
//             });
//         }

//         const existingSubject = await Subject.findOne({
//             name: name.trim(),
//             board: board.trim(),
//             class: className.trim(),
//             group: group.trim(),
//         });

//         if (existingSubject) {
//             return res.status(400).json({
//                 success: false,
//                 message: "This subject already exists for this Board, Class, and Group combination.",
//             });
//         }

//         const newSubject = new Subject({
//             name: name.trim(),
//             code: code ? code.trim() : "",
//             board: board.trim(),
//             class: className.trim(),
//             group: group.trim(),
//         });

//         await newSubject.save();

//         res.status(201).json({
//             success: true,
//             message: "Subject saved successfully",
//             subject: newSubject,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Server Error",
//             error: error.message,
//         });
//     }
// };

// // 2. Get Subjects (Supports filtering by text names or lookup IDs)
// const getSubjects = async (req, res) => {
//     try {
//         const { board, class: className, group, boardId, classId, groupId } = req.query;
//         let filter = {};

//         if (board) filter.board = board;
//         if (className) filter.class = className;
//         if (group) filter.group = group;

//         if (boardId && !board) {
//             const b = await Board.findById(boardId);
//             if (b) filter.board = b.name;
//         }
//         if (classId && !className) {
//             const c = await Class.findById(classId);
//             if (c) filter.class = c.name;
//         }
//         if (groupId && !group) {
//             const g = await Group.findById(groupId);
//             if (g) filter.group = g.name;
//         }

//         const subjects = await Subject.find(filter).sort({ createdAt: -1 });

//         res.status(200).json({
//             success: true,
//             subjects,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Server Error",
//             error: error.message,
//         });
//     }
// };

// // 3. Update Subject
// const updateSubject = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { name, code, board, class: className, group } = req.body;

//         if (!name || !board || !className || !group) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Board, Class, Group, and Subject Name are required fields.",
//             });
//         }

//         const updatedSubject = await Subject.findByIdAndUpdate(
//             id,
//             {
//                 name: name.trim(),
//                 code: code ? code.trim() : "",
//                 board: board.trim(),
//                 class: className.trim(),
//                 group: group.trim(),
//             },
//             { new: true, runValidators: true }
//         );

//         if (!updatedSubject) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Subject not found",
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Subject updated successfully",
//             subject: updatedSubject,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Server Error",
//             error: error.message,
//         });
//     }
// };

// // 4. Delete Subject
// const deleteSubject = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const deletedSubject = await Subject.findByIdAndDelete(id);

//         if (!deletedSubject) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Subject not found",
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Subject deleted successfully",
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Server Error",
//             error: error.message,
//         });
//     }
// };

// module.exports = {
//     createSubject,
//     getSubjects,
//     updateSubject,
//     deleteSubject,
// };

const Subject = require("../models/Subject");
const Board = require("../models/Board");
const Class = require("../models/Class");
const Group = require("../models/Group");

// Helper function to escape regex characters safely
const createCaseInsensitiveRegex = (text) => {
    if (!text) return null;
    const escapedText = text.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`^${escapedText}$`, "i");
};

// 1. Create Subject
const createSubject = async (req, res) => {
    try {
        const { name, code, board, class: className, group } = req.body;

        if (!name || !board || !className || !group) {
            return res.status(400).json({
                success: false,
                message: "Board, Class, Group, and Subject Name are required fields.",
            });
        }

        const trimmedName = name.trim();
        const trimmedBoard = board.trim();
        const trimmedClass = className.trim();
        const trimmedGroup = group.trim();

        // Case-insensitive duplicate check
        const existingSubject = await Subject.findOne({
            name: createCaseInsensitiveRegex(trimmedName),
            board: createCaseInsensitiveRegex(trimmedBoard),
            class: createCaseInsensitiveRegex(trimmedClass),
            group: createCaseInsensitiveRegex(trimmedGroup),
        });

        if (existingSubject) {
            return res.status(400).json({
                success: false,
                message: "This subject already exists for this Board, Class, and Group combination.",
            });
        }

        const newSubject = new Subject({
            name: trimmedName,
            code: code ? code.trim() : "",
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
        });

        await newSubject.save();

        res.status(201).json({
            success: true,
            message: "Subject saved successfully",
            subject: newSubject,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// 2. Get Subjects (Supports case-insensitive string filtering & ID lookups)
const getSubjects = async (req, res) => {
    try {
        const { board, class: className, group, boardId, classId, groupId } = req.query;
        let filter = {};

        let searchBoard = board;
        let searchClass = className;
        let searchGroup = group;

        // ID Lookup Fallbacks
        if (boardId && !searchBoard) {
            const b = await Board.findById(boardId);
            if (b) searchBoard = b.name;
        }
        if (classId && !searchClass) {
            const c = await Class.findById(classId);
            if (c) searchClass = c.name;
        }
        if (groupId && !searchGroup) {
            const g = await Group.findById(groupId);
            if (g) searchGroup = g.name;
        }

        // Apply case-insensitive regex for string matching
        if (searchBoard) {
            filter.board = new RegExp(searchBoard.trim(), "i");
        }

        if (searchClass) {
            const cleanClass = searchClass.trim();
            // Matches "9", "Class 9", or "9th" dynamically
            filter.class = new RegExp(`(^|\\b|Class\\s*)${cleanClass}`, "i");
        }

        if (searchGroup) {
            filter.group = new RegExp(searchGroup.trim(), "i");
        }

        const subjects = await Subject.find(filter).sort({ name: 1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: subjects.length,
            subjects,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// 3. Update Subject
const updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, board, class: className, group } = req.body;

        if (!name || !board || !className || !group) {
            return res.status(400).json({
                success: false,
                message: "Board, Class, Group, and Subject Name are required fields.",
            });
        }

        const trimmedName = name.trim();
        const trimmedBoard = board.trim();
        const trimmedClass = className.trim();
        const trimmedGroup = group.trim();

        // Check for collision with another existing subject
        const duplicateSubject = await Subject.findOne({
            _id: { $ne: id },
            name: createCaseInsensitiveRegex(trimmedName),
            board: createCaseInsensitiveRegex(trimmedBoard),
            class: createCaseInsensitiveRegex(trimmedClass),
            group: createCaseInsensitiveRegex(trimmedGroup),
        });

        if (duplicateSubject) {
            return res.status(400).json({
                success: false,
                message: "Another subject with this exact configuration already exists.",
            });
        }

        const updatedSubject = await Subject.findByIdAndUpdate(
            id,
            {
                name: trimmedName,
                code: code ? code.trim() : "",
                board: trimmedBoard,
                class: trimmedClass,
                group: trimmedGroup,
            },
            { new: true, runValidators: true }
        );

        if (!updatedSubject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Subject updated successfully",
            subject: updatedSubject,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// 4. Delete Subject
const deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedSubject = await Subject.findByIdAndDelete(id);

        if (!deletedSubject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Subject deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

module.exports = {
    createSubject,
    getSubjects,
    updateSubject,
    deleteSubject,
};