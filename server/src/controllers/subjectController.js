const { publication, safeUrl, fail } = require("../services/publishing");
// const Subject = require("../models/Subject");
// const Board = require("../models/Board");
// const Class = require("../models/Class");
// const Group = require("../models/Group");

// // 1. Create Subject
// const createSubject = async (req, res, next) => {
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
// const getSubjects = async (req, res, next) => {
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
// const updateSubject = async (req, res, next) => {
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
// const deleteSubject = async (req, res, next) => {
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
const mongoose = require("mongoose");

// Helper function to escape regex characters safely
const createCaseInsensitiveRegex = (text) => {
    if (!text) return null;
    const escapedText = text.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`^${escapedText}$`, "i");
};

const createContainsRegex = (text) => {
    if (!text) return null;
    const escapedText = text.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return new RegExp(escapedText, "i");
};

const createClassRegex = (text) => {
    if (!text) return null;
    const escapedText = text.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return new RegExp(`(^|\\b|Class\\s*)${escapedText}(th)?\\b`, "i");
};

const resolveEntityId = async (Model, value, regexFactory = createContainsRegex) => {
    if (!value) return null;

    if (mongoose.Types.ObjectId.isValid(value)) {
        return value;
    }

    const entity = await Model.findOne({ name: regexFactory(value) }).select("_id");
    return entity?._id || null;
};

const buildReferenceCondition = (field, value, referenceId, regexFactory = createContainsRegex) => {
    if (!value && !referenceId) return null;

    if (referenceId) {
        return { [field]: new mongoose.Types.ObjectId(referenceId) };
    }

    return { [field]: regexFactory(value) };
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const hydrateSubjectRefs = async (subjects) => {
    const idsByField = {
        board: new Set(),
        class: new Set(),
        group: new Set(),
    };

    subjects.forEach((subject) => {
        Object.keys(idsByField).forEach((field) => {
            const value = subject[field]?.toString();
            if (value && mongoose.Types.ObjectId.isValid(value)) {
                idsByField[field].add(value);
            }
        });
    });

    const [boards, classes, groups] = await Promise.all([
        Board.find({ _id: { $in: [...idsByField.board] } }).lean(),
        Class.find({ _id: { $in: [...idsByField.class] } }).lean(),
        Group.find({ _id: { $in: [...idsByField.group] } }).lean(),
    ]);

    const maps = {
        board: new Map(boards.map((item) => [item._id.toString(), item])),
        class: new Map(classes.map((item) => [item._id.toString(), item])),
        group: new Map(groups.map((item) => [item._id.toString(), item])),
    };

    return subjects.map((subject) => {
        const hydratedSubject = { ...subject };

        Object.keys(maps).forEach((field) => {
            const value = subject[field]?.toString();
            if (value && maps[field].has(value)) {
                hydratedSubject[field] = maps[field].get(value);
            }
        });

        return hydratedSubject;
    });
};

// 1. Create Subject
const createSubject = async (req, res, next) => {
    try {
        const { name, code, board, class: className, group } = req.body;

        if (!name || !board || !className || !group) {
            return res.status(400).json({
                success: false,
                message: "Board, Class, Group, and Subject Name are required fields.",
            });
        }

        const trimmedName = name.trim();
        const trimmedBoard = board.toString().trim();
        const trimmedClass = className.toString().trim();
        const trimmedGroup = group.toString().trim();

        if (!isValidObjectId(trimmedBoard) || !isValidObjectId(trimmedClass) || !isValidObjectId(trimmedGroup)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid Board, Class, and Group.",
            });
        }

        // Case-insensitive duplicate check
        const existingSubject = await Subject.findOne({
            name: createCaseInsensitiveRegex(trimmedName),
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
        });

        if (existingSubject) {
            return res.status(400).json({
                success: false,
                message: "This subject already exists for this Board, Class, and Group combination.",
            });
        }

        const newSubject = new Subject({
            ...publication(req.body),
            name: trimmedName,
            code: code ? code.trim() : "",
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
        });

        await newSubject.save();
        await newSubject.populate(["board", "class", "group"]);

        res.status(201).json({
            success: true,
            message: "Subject saved successfully",
            subject: newSubject,
        });
    } catch (error) {
        next(error);
    }
};

// 2. Get Subjects (Supports case-insensitive string filtering & ID lookups)
const getSubjects = async (req, res, next) => {
    try {
        const { board, class: className, group, boardId, classId, groupId } = req.query;
        const resolvedBoardId = boardId || await resolveEntityId(Board, board);
        const resolvedClassId = classId || await resolveEntityId(Class, className, createClassRegex);
        const resolvedGroupId = groupId || await resolveEntityId(Group, group);
        const filterParts = [
            buildReferenceCondition("board", board, resolvedBoardId),
            buildReferenceCondition("class", className, resolvedClassId, createClassRegex),
            buildReferenceCondition("group", group, resolvedGroupId),
        ].filter(Boolean);
        const filter = filterParts.length ? { $and: filterParts } : {};
        const subjects = await Subject.collection
            .find(filter)
            .sort({ name: 1, createdAt: -1 })
            .toArray();
        const hydratedSubjects = await hydrateSubjectRefs(subjects);

        res.status(200).json({
            success: true,
            count: hydratedSubjects.length,
            subjects: hydratedSubjects,
        });
    } catch (error) {
        next(error);
    }
};

// 3. Update Subject
const updateSubject = async (req, res, next) => {
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
        const trimmedBoard = board.toString().trim();
        const trimmedClass = className.toString().trim();
        const trimmedGroup = group.toString().trim();

        if (!isValidObjectId(trimmedBoard) || !isValidObjectId(trimmedClass) || !isValidObjectId(trimmedGroup)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid Board, Class, and Group.",
            });
        }

        // Check for collision with another existing subject
        const duplicateSubject = await Subject.findOne({
            _id: { $ne: id },
            name: createCaseInsensitiveRegex(trimmedName),
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
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
                ...publication(req.body),
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
            subject: await updatedSubject.populate(["board", "class", "group"]),
        });
    } catch (error) {
        next(error);
    }
};

// 4. Delete Subject
const deleteSubject = async (req, res, next) => {
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
        next(error);
    }
};

module.exports = {
    createSubject,
    getSubjects,
    updateSubject,
    deleteSubject,
};
