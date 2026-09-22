const Question = require("../models/Question");
const QuestionScenario = require("../models/QuestionScenario");
const Board = require("../models/Board");
const ClassModel = require("../models/Class");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const mongoose = require("mongoose");
const { readSheet } = require("read-excel-file/node");
const writeXlsxFile = require("write-excel-file/node");

const parseTags = (tags) => {
    if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
    if (typeof tags === "string") return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    return [];
};

const rowsFromSheetData = (sheetData) => {
    if (!Array.isArray(sheetData) || !Array.isArray(sheetData[0])) {
        throw new Error("The first worksheet is empty. Add the column headings and at least one question.");
    }
    const headers = (sheetData[0] || []).map((header) => String(header || "").trim());
    const missing = ["questionText"].filter((header) => !headers.includes(header));
    if (missing.length) throw new Error(`Missing Excel columns: ${missing.join(", ")}. Please use the downloaded template.`);
    return sheetData.slice(1).map((row) => {
        const item = {};
        headers.forEach((header, index) => {
            if (header) item[header] = row[index] ?? "";
        });
        return item;
    }).filter((item) => Object.values(item).some((value) => String(value || "").trim()));
};

const sheetFromRows = (name, rows) => {
    const headers = Object.keys(rows[0] || { value: "" });
    return {
        sheet: name,
        columns: headers.map((header) => ({ width: Math.min(Math.max(header.length + 6, 16), 42) })),
        stickyRowsCount: 1,
        data: [
            headers.map((header) => ({
                value: header,
                fontWeight: "bold",
                backgroundColor: "#EFF6FF",
            })),
            ...rows.map((row) => headers.map((header) => row[header] ?? "")),
        ],
    };
};

const buildQuestionFilter = (query) => {
    const filter = {};
    ["board", "class", "group", "subject", "chapter", "topic", "type", "difficulty", "status"].forEach((key) => {
        if (query[key]) filter[key] = query[key];
    });
    if (query.contentType) filter.contentType = query.contentType;
    if (!query.status && query.includeArchived !== "true") filter.status = { $ne: "archived" };
    if (query.mcqOnly === "true") filter.contentType = { $nin: ["long_question", "short_question"] };
    if (query.search) filter.$text = { $search: query.search };
    return filter;
};

const cleanQuestionPayload = (body, adminId) => {
    const payload = {
        ...body,
        tags: parseTags(body.tags),
        createdBy: adminId,
        updatedBy: adminId,
    };

    ["group", "chapter", "topic", "scenario"].forEach((key) => {
        if (payload[key] === "") delete payload[key];
    });

    payload.options = (payload.options || [])
        .map((option) => ({
            key: String(option.key || "").trim().toUpperCase(),
            text: String(option.text || "").trim(),
        }))
        .filter((option) => option.key && option.text);

    payload.correctOption = String(payload.correctOption || "").trim().toUpperCase();
    payload.marks = Number(payload.marks || 1);
    payload.estimatedTimeSeconds = Number(payload.estimatedTimeSeconds || 60);
    payload.negativeMarks = Number(payload.negativeMarks || 0);

    payload.contentType = body.contentType || "mcq";
    if (payload.contentType === "mcq") {
        payload.examYear = undefined;
        payload.examSession = undefined;
    }
    if (!payload.examYear && payload.contentType !== "mcq") payload.examYear = undefined;
    if (!payload.examSession) payload.examSession = undefined;
    if (payload.contentType !== "mcq") {
        payload.options = [];
        payload.correctOption = undefined;
        payload.type = "standard_mcq";
        payload.scenario = undefined;
    }
    return payload;
};

const applyQuestionScope = async (payload) => {
    if (!payload.chapter && !payload.topic) {
        if (payload.contentType !== "mcq") throw new Error("Choose a chapter and topic for written questions.");
        return;
    }
    if (payload.contentType !== "mcq" && !payload.topic) throw new Error("Choose a topic for written questions.");
    const { filter } = await require("../services/scopeTest").resolveScope(payload.chapter, payload.topic);
    Object.assign(payload, filter);
    if (payload.type === "scenario_mcq") {
        const scenario = isObjectId(payload.scenario) ? await QuestionScenario.findById(payload.scenario).lean() : null;
        if (!scenario) throw new Error("Select an existing scenario or create a new one.");
        for (const key of ["subject", "chapter", "topic"]) {
            if (scenario[key] && String(scenario[key]) !== String(payload[key])) throw new Error("The scenario must match the selected subject, chapter and topic.");
        }
    }
};

const getQuestionValidationMessage = (error) => {
    if (error?.name === "ValidationError") {
        return Object.values(error.errors).map((item) => item.message).join(" ");
    }

    if (error?.name === "CastError") {
        return `Invalid value for ${error.path}. Please select it again.`;
    }

    return error?.message || "Unable to save question.";
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || "").trim());

const normalizeName = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(board|class|grade|group|chapter|ch|subject|topic)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getNameVariants = (value) => {
    const cleaned = String(value || "").trim();
    const normalized = normalizeName(cleaned);
    const variants = new Set([cleaned, normalized]);
    const numberMatch = normalized.match(/\d+/);
    if (numberMatch) {
        variants.add(numberMatch[0]);
        variants.add(`class ${numberMatch[0]}`);
        variants.add(`grade ${numberMatch[0]}`);
    }
    if (normalized) {
        variants.add(`${normalized} board`);
        variants.add(`${normalized} group`);
    }
    return [...variants].filter(Boolean);
};

const findByIdOrName = async (Model, value, extraFilter = {}) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return null;
    if (isObjectId(cleaned)) return Model.findById(cleaned).select("_id").lean();

    const directMatch = await Model.findOne({
        ...extraFilter,
        name: { $in: getNameVariants(cleaned).map((variant) => new RegExp(`^${escapeRegex(variant)}$`, "i")) },
    }).select("_id").lean();
    if (directMatch) return directMatch;

    const candidates = await Model.find(extraFilter).select("_id name").lean();
    const requestedName = normalizeName(cleaned);
    return candidates.find((candidate) => {
        const candidateName = normalizeName(candidate.name);
        return candidateName === requestedName
            || candidateName.includes(requestedName)
            || requestedName.includes(candidateName);
    }) || null;
};

const resolveImportCurriculum = async (row) => {
    const errors = [];
    const boardDoc = await findByIdOrName(Board, row.board);
    if (!boardDoc) errors.push(`Board "${row.board}" was not found.`);

    const classDoc = await findByIdOrName(ClassModel, row.class);
    if (!classDoc) errors.push(`Class "${row.class}" was not found.`);

    const groupDoc = row.group ? await findByIdOrName(Group, row.group) : null;
    if (row.group && !groupDoc) errors.push(`Group "${row.group}" was not found.`);

    const subjectFilter = {};
    if (boardDoc) subjectFilter.board = boardDoc._id;
    if (classDoc) subjectFilter.class = classDoc._id;
    if (groupDoc) subjectFilter.group = groupDoc._id;
    const subjectDoc = await findByIdOrName(Subject, row.subject, subjectFilter);
    if (!subjectDoc) errors.push(`Subject "${row.subject}" was not found for the selected board/class/group.`);

    const chapterFilter = {};
    if (subjectDoc) chapterFilter.subject = subjectDoc._id;
    const chapterDoc = row.chapter ? await findByIdOrName(Chapter, row.chapter, chapterFilter) : null;
    if (row.chapter && !chapterDoc) errors.push(`Chapter "${row.chapter}" was not found for this subject.`);

    let topicDoc = null;
    if (row.topic) {
        if (isObjectId(row.topic)) {
            topicDoc = await Topic.findById(row.topic).select("_id").lean();
        } else {
            const topicFilter = {};
            if (chapterDoc) topicFilter.chapterId = chapterDoc._id;
            if (subjectDoc) topicFilter.subjectId = subjectDoc._id;
            topicDoc = await findByIdOrName(Topic, row.topic, topicFilter);
        }
        if (!topicDoc) errors.push(`Topic "${row.topic}" was not found for this chapter.`);
    }

    return {
        errors,
        values: {
            board: boardDoc?._id,
            class: classDoc?._id,
            group: groupDoc?._id,
            subject: subjectDoc?._id,
            chapter: chapterDoc?._id,
            topic: topicDoc?._id,
        },
    };
};

const getImportContextValues = async (context = {}) => {
    const errors = [];
    const values = {
        board: context.board,
        class: context.class,
        group: context.group,
        subject: context.subject,
        chapter: context.chapter,
        topic: context.topic || undefined,
    };

    if (!isObjectId(values.board)) errors.push("Select a valid board before uploading.");
    if (!isObjectId(values.class)) errors.push("Select a valid class before uploading.");
    if (!isObjectId(values.group)) errors.push("Select a valid group before uploading.");
    if (!isObjectId(values.subject)) errors.push("Select a valid subject before uploading.");
    if (!isObjectId(values.chapter)) errors.push("Select a valid chapter before uploading.");
    if (values.topic && !isObjectId(values.topic)) errors.push("Select a valid topic or leave topic empty.");

    if (!errors.length) {
        const [boardDoc, classDoc, groupDoc, subjectDoc, chapterDoc, topicDoc] = await Promise.all([
            Board.findById(values.board).select("_id").lean(),
            ClassModel.findById(values.class).select("_id").lean(),
            Group.findById(values.group).select("_id").lean(),
            Subject.findOne({ _id: values.subject, board: values.board, class: values.class, group: values.group }).select("_id").lean(),
            Chapter.findOne({ _id: values.chapter, subject: values.subject }).select("_id").lean(),
            values.topic ? Topic.findOne({ _id: values.topic, chapterId: values.chapter }).select("_id").lean() : null,
        ]);
        if (!boardDoc) errors.push("Selected board was not found.");
        if (!classDoc) errors.push("Selected class was not found.");
        if (!groupDoc) errors.push("Selected group was not found.");
        if (!subjectDoc) errors.push("Selected subject does not match the selected board/class/group.");
        if (!chapterDoc) errors.push("Selected chapter does not match the selected subject.");
        if (values.topic && !topicDoc) errors.push("Selected topic does not match the selected chapter.");
    }

    return { errors, values };
};

const buildQuestionFromImportRow = async (row, adminId, contextValues) => {
    const resolved = contextValues ? { errors: [], values: contextValues } : await resolveImportCurriculum(row);
    const { errors, values } = resolved;
    if (errors.length) {
        const error = new Error(errors.join(" "));
        error.name = "ImportReferenceError";
        throw error;
    }

    let scenario = row.scenario || undefined;
    if (row.type === "scenario_mcq" && !scenario && row.scenarioTitle && row.scenarioText) {
        const scenarioTitle = String(row.scenarioTitle).trim();
        const scenarioText = String(row.scenarioText).trim();
        const scenarioDoc = await QuestionScenario.findOneAndUpdate({
            title: scenarioTitle,
            scenarioText,
            subject: values.subject,
            chapter: values.chapter,
            topic: values.topic,
        }, {
            title: scenarioTitle,
            scenarioText,
            subject: values.subject,
            chapter: values.chapter,
            topic: values.topic,
            difficulty: row.difficulty || "medium",
            tags: parseTags(row.tags),
            createdBy: adminId,
        }, { new: true, upsert: true, setDefaultsOnInsert: true });
        scenario = scenarioDoc._id;
    }

    return cleanQuestionPayload({
        contentType: row.contentType || "mcq",
        examYear: row.examYear,
        examSession: row.examSession,
        type: row.type || "standard_mcq",
        questionText: row.questionText,
        options: [
            { key: "A", text: row.optionA },
            { key: "B", text: row.optionB },
            { key: "C", text: row.optionC || "" },
            { key: "D", text: row.optionD || "" },
        ],
        correctOption: row.correctOption,
        explanation: row.explanation || "",
        difficulty: row.difficulty || "medium",
        marks: row.marks || 1,
        estimatedTimeSeconds: row.estimatedTimeSeconds || 60,
            board: values.board,
            class: values.class,
            group: values.group,
            subject: values.subject,
            chapter: values.chapter,
            topic: values.topic,
        scenario,
        tags: row.tags,
        status: row.status || "published",
    }, adminId);
};

const getQuestions = async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const filter = buildQuestionFilter(req.query);

    const [questions, total] = await Promise.all([
        Question.find(filter)
            .populate("subject chapter topic scenario", "name title")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Question.countDocuments(filter),
    ]);

    res.json({ success: true, questions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

const getPublicTopicQuestions = async (req, res) => {
    try {
        const { resolveScope } = require("../services/scopeTest");
        const { filter, topic, chapter } = await resolveScope(undefined, req.query.topic);
        const contentType = req.query.contentType || "long_question";
        if (!["long_question", "short_question"].includes(contentType)) return res.status(400).json({ message: "Choose long or short questions." });
        const questions = await Question.find({ ...filter, status: "published", contentType })
            .sort({ examYear: -1, _id: 1 })
            .select("questionText contentType examYear examSession")
            .lean();
        res.json({ success: true, questions, topic: { name: topic.name, chapter: chapter._id } });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to load questions." });
    }
};

const createQuestion = async (req, res) => {
    try {
        const payload = cleanQuestionPayload(req.body, req.admin?._id);
        await applyQuestionScope(payload);

        if (payload.contentType === "mcq" && payload.options.length < 2) {
            return res.status(400).json({ success: false, message: "At least two answer options are required." });
        }

        const optionKeys = new Set((payload.options || []).map((option) => option.key));
        if (payload.contentType === "mcq" && !optionKeys.has(payload.correctOption)) {
            return res.status(400).json({ success: false, message: "Correct answer must match one of the filled option keys." });
        }

        if (payload.type === "scenario_mcq" && !payload.scenario) {
            return res.status(400).json({ success: false, message: "Scenario-based MCQs require selecting or creating a scenario." });
        }

        const question = await Question.create(payload);
        res.status(201).json({ success: true, question });
    } catch (error) {
        res.status(400).json({ success: false, message: getQuestionValidationMessage(error) });
    }
};

const updateQuestion = async (req, res) => {
    const payload = cleanQuestionPayload(req.body, req.admin?._id);
    await applyQuestionScope(payload);
    delete payload.createdBy;

    const question = await Question.findById(req.params.id);
    if (question) { question.set(payload); await question.save(); }

    if (!question) return res.status(404).json({ success: false, message: "Question not found." });
    res.json({ success: true, question });
};

const deleteQuestion = async (req, res) => {
    const question = await Question.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
    if (!question) return res.status(404).json({ success: false, message: "Question not found." });
    res.json({ success: true, question });
};

const getScenarios = async (req, res) => {
    const scenarios = await QuestionScenario.find(buildQuestionFilter(req.query))
        .sort({ createdAt: -1 })
        .lean();
    res.json({ success: true, scenarios });
};

const createScenario = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            tags: parseTags(req.body.tags),
            createdBy: req.admin?._id,
        };

        ["chapter", "topic"].forEach((key) => {
            if (payload[key] === "") delete payload[key];
        });

        const scenario = await QuestionScenario.create(payload);
        res.status(201).json({ success: true, scenario });
    } catch (error) {
        res.status(400).json({ success: false, message: getQuestionValidationMessage(error) });
    }
};

const updateScenario = async (req, res) => {
    const scenario = await QuestionScenario.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!scenario) return res.status(404).json({ success: false, message: "Scenario not found." });
    res.json({ success: true, scenario });
};

const importKinds = ["standard_mcq", "scenario_mcq", "short_question", "long_question"];
const normalizeImportRow = (source, kind) => {
    if (kind && !importKinds.includes(kind)) throw new Error("Choose a valid question type.");
    const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
    row.contentType = kind ? (["short_question", "long_question"].includes(kind) ? kind : "mcq") : row.contentType || "mcq";
    row.type = row.contentType === "mcq" ? kind || row.type || "standard_mcq" : "standard_mcq";
    row.correctOption = String(row.correctOption || "").toUpperCase();
    row.examSession = String(row.examSession || "").toLowerCase();
    delete row.scenario;
    return row;
};

const validateImportRow = (row, context) => {
    const errors = [];
    if (!String(row.questionText || "").trim()) errors.push("Question text is required.");
    if (!["mcq", "short_question", "long_question"].includes(row.contentType)) errors.push("Invalid question type.");
    if (row.contentType === "mcq") {
        if (!["standard_mcq", "scenario_mcq"].includes(row.type)) errors.push("Invalid MCQ type.");
        if (!row.optionA || !row.optionB) errors.push("Fill optionA and optionB.");
        if (!["A", "B", "C", "D"].includes(row.correctOption) || !row[`option${row.correctOption}`]) errors.push("Correct answer must match a filled option A, B, C or D.");
        if (row.type === "scenario_mcq" && (!row.scenarioTitle || !row.scenarioText)) errors.push("Fill scenarioTitle and scenarioText on every related question row.");
    } else {
        if (!context?.topic) errors.push("Select a topic for short and long questions.");
        if (row.examYear !== undefined && row.examYear !== "" && (!Number.isInteger(Number(row.examYear)) || Number(row.examYear) < 1900 || Number(row.examYear) > 2100)) errors.push("Exam year must be between 1900 and 2100, or blank.");
        if (row.examSession && !["morning", "evening"].includes(row.examSession)) errors.push("Exam session must be morning, evening, or blank.");
    }
    if (row.difficulty && !["easy", "medium", "hard"].includes(row.difficulty)) errors.push("Invalid difficulty.");
    if (row.marks !== undefined && row.marks !== "" && (!Number.isFinite(Number(row.marks)) || Number(row.marks) < 0)) errors.push("Marks must be a non-negative number.");
    return errors;
};

const importPreview = async (req, res) => {
    try {
        let rows = Array.isArray(req.body.rows) ? req.body.rows : [];
        const importContext = typeof req.body.context === "string" ? JSON.parse(req.body.context || "{}") : req.body.context;
        const { errors: contextErrors } = await getImportContextValues(importContext);
        if (contextErrors.length) return res.status(400).json({ success: false, message: contextErrors.join(" ") });

        if (req.file?.buffer) {
            const sheetData = await readSheet(req.file.buffer);
            rows = rowsFromSheetData(sheetData);
        }

        if (!rows.length) return res.status(400).json({ success: false, message: "Add at least one question below the Excel column headings." });

        const seen = new Set();
        const preview = [];

        for (const [index, source] of rows.entries()) {
            const row = normalizeImportRow(source, req.body.kind);
            const errors = validateImportRow(row, importContext);
            const normalized = String(row.questionText || "").trim().toLowerCase();
            if (normalized && seen.has(normalized)) errors.push("Duplicate question in uploaded file.");
            seen.add(normalized);

            preview.push({ rowNumber: index + 1, row, status: errors.length ? "invalid" : "valid", errors });
        }

        res.json({
            success: true,
            preview,
            summary: {
                total: preview.length,
                valid: preview.filter((item) => item.status === "valid").length,
                invalid: preview.filter((item) => item.status === "invalid").length,
            },
        });
    } catch (error) {
        res.status(400).json({ success: false, message: getQuestionValidationMessage(error) || "Unable to preview Excel file." });
    }
};

const importCommit = async (req, res) => {
    try {
        const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
        const { errors: contextErrors, values: contextValues } = await getImportContextValues(req.body.context || {});
        if (contextErrors.length) return res.status(400).json({ success: false, message: contextErrors.join(" ") });
        const created = [];
        const failed = [];

        for (const [index, source] of rows.entries()) {
            try {
                const row = normalizeImportRow(source, req.body.kind);
                const errors = validateImportRow(row, contextValues);
                if (errors.length) throw new Error(errors.join(" "));
                const payload = await buildQuestionFromImportRow(row, req.admin?._id, contextValues);
                const question = await Question.create(payload);
                created.push(question);
            } catch (error) {
                failed.push({ rowNumber: index + 1, message: getQuestionValidationMessage(error) });
            }
        }

        res.json({ success: true, imported: created.length, failed: failed.length, errors: failed });
    } catch (error) {
        res.status(400).json({ success: false, message: getQuestionValidationMessage(error) || "Unable to import questions." });
    }
};

const downloadImportTemplate = async (req, res) => {
    const kind = req.query?.kind || "standard_mcq";
    if (!importKinds.includes(kind)) return res.status(400).json({ message: "Choose a valid question type." });
    const written = ["short_question", "long_question"].includes(kind);
    const simpleHeaders = written ? ["questionText", "examYear", "examSession"] : ["questionText", "optionA", "optionB", "optionC", "optionD", "correctOption", "explanation"];
    let sampleRows = [
        ["What type of motion repeats after equal intervals of time?", "Periodic motion", "Random motion", "Linear motion", "Projectile motion", "A", "Periodic motion repeats after equal intervals of time."],
        ["What is the time taken for one complete oscillation called?", "Frequency", "Time period", "Amplitude", "Speed", "B", "The time period is the time taken to complete one oscillation."],
    ];
    if (written) sampleRows = [[kind === "short_question" ? "Define periodic motion." : "Explain periodic motion with examples and describe the time period of a pendulum.", 2025, "morning"], [kind === "short_question" ? "What is one oscillation?" : "Describe an experiment to measure the time period of a pendulum.", "", ""]];
    if (kind === "scenario_mcq") {
        simpleHeaders.push("scenarioTitle", "scenarioText");
        sampleRows = sampleRows.map((row) => [...row, "Pendulum experiment", "A student observes a pendulum moving back and forth at regular intervals. Read this passage and answer the related questions."]);
    }
    const data = [
        simpleHeaders.map((header) => ({ value: header, type: String, fontWeight: "bold", backgroundColor: "#EEF2FF" })),
        ...sampleRows.map((row) => row.map((value) => ({ value, type: typeof value === "number" ? Number : String }))),
    ];

    const buffer = await writeXlsxFile(data, {
        columns: simpleHeaders.map((header) => ({ width: header === "questionText" || header === "explanation" ? 60 : 24 })),
        stickyRowsCount: 1,
    }).toBuffer();

    res.setHeader("Content-Disposition", `attachment; filename=${kind}-import-template.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
};

module.exports = {
    getPublicTopicQuestions,
    getQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    getScenarios,
    createScenario,
    updateScenario,
    importPreview,
    importCommit,
    downloadImportTemplate,
};
