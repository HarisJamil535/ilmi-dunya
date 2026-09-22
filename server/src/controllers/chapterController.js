const { publication, safeUrl, fail } = require("../services/publishing");
const Chapter = require("../models/Chapter");
const Board = require("../models/Board");
const Class = require("../models/Class");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const mongoose = require("mongoose");

const escapeRegex = (text) => text.toString().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

const createContainsRegex = (text) => {
    if (!text) return null;
    return new RegExp(escapeRegex(text).replace(/\\-/g, "[-\\s]+"), "i");
};

const createClassRegex = (text) => {
    if (!text) return null;
    return new RegExp(`(^|\\b|Class\\s*)${escapeRegex(text)}(th)?\\b`, "i");
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

// 1. Create Chapter
const createChapter = async (req, res, next) => {
    try {
        const { name, chapterNumber, board, class: className, group, subject } = req.body;

        if (!name || !board || !className || !group || !subject) {
            return res.status(400).json({
                success: false,
                message: "All academic context fields and chapter name are required.",
            });
        }

        const parsedChapterNum = Number(chapterNumber) || 1;
        const trimmedBoard = board.toString().trim();
        const trimmedClass = className.toString().trim();
        const trimmedGroup = group.toString().trim();
        const trimmedSubject = subject.toString().trim();

        if (
            !isValidObjectId(trimmedBoard) ||
            !isValidObjectId(trimmedClass) ||
            !isValidObjectId(trimmedGroup) ||
            !isValidObjectId(trimmedSubject)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid Board, Class, Group, and Subject.",
            });
        }

        // Check if chapter number already exists for this specific subject context
        const existingChapterNum = await Chapter.findOne({
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
            subject: trimmedSubject,
            chapterNumber: parsedChapterNum,
        });

        if (existingChapterNum) {
            return res.status(400).json({
                success: false,
                message: `Chapter number #${parsedChapterNum} already exists for this subject. Please use a unique number.`,
            });
        }

        const existingChapterName = await Chapter.findOne({
            name: name.trim(),
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
            subject: trimmedSubject,
        });

        if (existingChapterName) {
            return res.status(400).json({
                success: false,
                message: "A chapter with this name already exists for this subject combination.",
            });
        }

        const newChapter = new Chapter({
            ...publication(req.body),
            name: name.trim(),
            chapterNumber: parsedChapterNum,
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
            subject: trimmedSubject,
        });

        await newChapter.save();
        await newChapter.populate(["board", "class", "group", "subject"]);

        res.status(201).json({
            success: true,
            message: "Chapter saved successfully",
            chapter: newChapter,
        });
    } catch (error) {
        next(error);
    }
};

// 2. Get Chapters (Sorted strictly by chapterNumber ascending)
const getChapters = async (req, res, next) => {
    try {
        const { board, class: className, group, subject, boardId, classId, groupId, subjectId } = req.query;
        const resolvedBoardId = boardId || await resolveEntityId(Board, board);
        const resolvedClassId = classId || await resolveEntityId(Class, className, createClassRegex);
        const resolvedGroupId = groupId || await resolveEntityId(Group, group);
        const resolvedSubjectId = subjectId || await resolveEntityId(Subject, subject);
        const filterParts = [
            buildReferenceCondition("board", board, resolvedBoardId),
            buildReferenceCondition("class", className, resolvedClassId, createClassRegex),
            buildReferenceCondition("group", group, resolvedGroupId),
            buildReferenceCondition("subject", subject, resolvedSubjectId),
        ].filter(Boolean);
        const filter = filterParts.length ? { $and: filterParts } : {};
        const chapters = await Chapter.collection
            .find(filter)
            .sort({ chapterNumber: 1, createdAt: 1 })
            .toArray();
        await Chapter.populate(chapters, ["board", "class", "group", "subject"]);

        res.status(200).json({
            success: true,
            chapters,
        });
    } catch (error) {
        next(error);
    }
};

// 3. Update Chapter
const updateChapter = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, chapterNumber, board, class: className, group, subject } = req.body;

        if (!name || !board || !className || !group || !subject) {
            return res.status(400).json({
                success: false,
                message: "All academic context fields and chapter name are required.",
            });
        }

        const parsedChapterNum = Number(chapterNumber) || 1;
        const trimmedBoard = board.toString().trim();
        const trimmedClass = className.toString().trim();
        const trimmedGroup = group.toString().trim();
        const trimmedSubject = subject.toString().trim();

        if (
            !isValidObjectId(trimmedBoard) ||
            !isValidObjectId(trimmedClass) ||
            !isValidObjectId(trimmedGroup) ||
            !isValidObjectId(trimmedSubject)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid Board, Class, Group, and Subject.",
            });
        }

        // Check if another chapter already has this number in the same context
        const conflictingChapter = await Chapter.findOne({
            _id: { $ne: id },
            board: trimmedBoard,
            class: trimmedClass,
            group: trimmedGroup,
            subject: trimmedSubject,
            chapterNumber: parsedChapterNum,
        });

        if (conflictingChapter) {
            return res.status(400).json({
                success: false,
                message: `Chapter number #${parsedChapterNum} is already assigned to another chapter in this subject.`,
            });
        }

        const updatedChapter = await Chapter.findByIdAndUpdate(
            id,
            {
                ...publication(req.body),
                name: name.trim(),
                chapterNumber: parsedChapterNum,
                board: trimmedBoard,
                class: trimmedClass,
                group: trimmedGroup,
                subject: trimmedSubject,
            },
            { new: true, runValidators: true }
        );

        if (!updatedChapter) {
            return res.status(404).json({
                success: false,
                message: "Chapter not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Chapter updated successfully",
            chapter: await updatedChapter.populate(["board", "class", "group", "subject"]),
        });
    } catch (error) {
        next(error);
    }
};

// 4. Delete Chapter
const deleteChapter = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deletedChapter = await Chapter.findByIdAndDelete(id);

        if (!deletedChapter) {
            return res.status(404).json({
                success: false,
                message: "Chapter not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Chapter deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createChapter,
    getChapters,
    updateChapter,
    deleteChapter,
};
