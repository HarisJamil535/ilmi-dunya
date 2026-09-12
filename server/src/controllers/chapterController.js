const Chapter = require("../models/Chapter");
const Board = require("../models/Board");
const Class = require("../models/Class");
const Group = require("../models/Group");
const Subject = require("../models/Subject");

// 1. Create Chapter
const createChapter = async (req, res) => {
    try {
        const { name, chapterNumber, board, class: className, group, subject } = req.body;

        if (!name || !board || !className || !group || !subject) {
            return res.status(400).json({
                success: false,
                message: "All academic context fields and chapter name are required.",
            });
        }

        const parsedChapterNum = Number(chapterNumber) || 1;

        // Check if chapter number already exists for this specific subject context
        const existingChapterNum = await Chapter.findOne({
            board: board.trim(),
            class: className.trim(),
            group: group.trim(),
            subject: subject.trim(),
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
            board: board.trim(),
            class: className.trim(),
            group: group.trim(),
            subject: subject.trim(),
        });

        if (existingChapterName) {
            return res.status(400).json({
                success: false,
                message: "A chapter with this name already exists for this subject combination.",
            });
        }

        const newChapter = new Chapter({
            name: name.trim(),
            chapterNumber: parsedChapterNum,
            board: board.trim(),
            class: className.trim(),
            group: group.trim(),
            subject: subject.trim(),
        });

        await newChapter.save();

        res.status(201).json({
            success: true,
            message: "Chapter saved successfully",
            chapter: newChapter,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// 2. Get Chapters (Sorted strictly by chapterNumber ascending)
const getChapters = async (req, res) => {
    try {
        const { board, class: className, group, subject, boardId, classId, groupId, subjectId } = req.query;
        let filter = {};

        if (board) filter.board = board;
        if (className) filter.class = className;
        if (group) filter.group = group;
        if (subject) filter.subject = subject;

        if (boardId && !board) {
            const b = await Board.findById(boardId);
            if (b) filter.board = b.name;
        }
        if (classId && !className) {
            const c = await Class.findById(classId);
            if (c) filter.class = c.name;
        }
        if (groupId && !group) {
            const g = await Group.findById(groupId);
            if (g) filter.group = g.name;
        }
        if (subjectId && !subject) {
            const s = await Subject.findById(subjectId);
            if (s) filter.subject = s.name;
        }

        // Fetch and sort strictly by chapterNumber ascending (1, 2, 3...)
        const chapters = await Chapter.find(filter).sort({ chapterNumber: 1, createdAt: 1 });

        res.status(200).json({
            success: true,
            chapters,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// 3. Update Chapter
const updateChapter = async (req, res) => {
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

        // Check if another chapter already has this number in the same context
        const conflictingChapter = await Chapter.findOne({
            _id: { $ne: id },
            board: board.trim(),
            class: className.trim(),
            group: group.trim(),
            subject: subject.trim(),
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
                name: name.trim(),
                chapterNumber: parsedChapterNum,
                board: board.trim(),
                class: className.trim(),
                group: group.trim(),
                subject: subject.trim(),
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
            chapter: updatedChapter,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// 4. Delete Chapter
const deleteChapter = async (req, res) => {
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
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

module.exports = {
    createChapter,
    getChapters,
    updateChapter,
    deleteChapter,
};