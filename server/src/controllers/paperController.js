const mongoose = require("mongoose");
const Board = require("../models/Board");
const ClassModel = require("../models/Class");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Question = require("../models/Question");
const QuestionScenario = require("../models/QuestionScenario");
const School = require("../models/School");
const QuestionPaper = require("../models/QuestionPaper");
const mediaStore = require("../services/mediaStore");
const { fail } = require("../services/publishing");
const engine = require("../services/paperEngine");
const { renderPaperPdf, renderKeyPdf, measureLayout, hasNonLatin } = require("../services/paperPdf");
const { renderPaperDocx, renderKeyDocx } = require("../services/paperDocx");
const { createConcurrencyLimit } = require("../services/concurrencyLimit");

const id = value => String(value?._id || value || "");
const MAX_PAPERS_PER_DAY = 40;
const MAX_BANK = 6000;
const isOwner = (req, paper) => req.admin.role === "super_admin" || id(paper.owner) === id(req.admin._id);
const renderTurn = createConcurrencyLimit(3);
// Export limit per teacher, so the question bank cannot be copied out in bulk.
const exportLog = new Map();
function exportAllowed(adminId) {
    const now = Date.now();
    const recent = (exportLog.get(adminId) || []).filter(time => now - time < 3600000);
    if (recent.length >= 120) return false;
    recent.push(now);
    exportLog.set(adminId, recent);
    return true;
}

// Boards, classes, groups and subjects for the first step.
const catalog = async (req, res) => {
    const [boards, classes, groups, subjects] = await Promise.all([
        Board.find().select("name").sort({ name: 1 }).lean(), ClassModel.find().select("name").sort({ name: 1 }).lean(), Group.find().select("name").sort({ name: 1 }).lean(),
        Subject.find().select("name board class group").sort({ name: 1 }).lean(),
    ]);
    res.json({ success: true, boards, classes, groups, subjects });
};

const schools = async (req, res) => {
    res.json({ success: true, schools: await School.find({ isActive: true }).select("name").sort({ name: 1 }).lean() });
};

// Chapters and topics of a subject with how many questions each has.
const outline = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) fail("Choose a valid subject.");
    const subject = new mongoose.Types.ObjectId(req.params.id);
    const [chapters, topics, counts] = await Promise.all([
        Chapter.find({ subject }).select("name chapterNumber").sort({ chapterNumber: 1 }).lean(),
        Topic.find({ subjectId: subject }).select("name topicNumber chapterId").lean(),
        Question.aggregate([
            { $match: { subject, status: { $ne: "archived" }, contentLanguage: { $ne: "ur" } } },
            { $group: { _id: { chapter: "$chapter", topic: "$topic", type: "$contentType" }, count: { $sum: 1 } } },
        ]),
    ]);
    const key = type => ({ mcq: "mcq", short_question: "short", long_question: "long" }[type]);
    const sum = (filter) => { const out = { mcq: 0, short: 0, long: 0 }; for (const row of counts) if (filter(row._id) && key(row._id.type)) out[key(row._id.type)] += row.count; return out; };
    const urdu = await Question.countDocuments({ subject, status: { $ne: "archived" }, contentLanguage: "ur" });
    res.json({
        success: true, urduQuestions: urdu,
        chapters: chapters.map(chapter => ({
            _id: chapter._id, name: chapter.name, chapterNumber: chapter.chapterNumber, counts: sum(row => id(row.chapter) === id(chapter)),
            topics: topics.filter(topic => id(topic.chapterId) === id(chapter)).sort((a, b) => String(a.topicNumber).localeCompare(String(b.topicNumber), "en", { numeric: true })).map(topic => ({ _id: topic._id, name: topic.name, topicNumber: topic.topicNumber, counts: sum(row => id(row.topic) === id(topic)) })),
        })),
    });
};

const kindType = { mcq: "mcq", short: "short_question", long: "long_question" };
const publicQuestion = q => ({ _id: id(q), contentType: q.contentType, questionText: q.questionText, options: (q.options || []).map(option => ({ key: option.key, text: option.text })), correctOption: q.correctOption, isImportant: Boolean(q.isImportant), chapter: id(q.chapter), topic: id(q.topic), scenario: id(q.scenario), difficulty: q.difficulty });

// Browse the questions of a subject, to pick by hand.
const browse = async (req, res) => {
    const { subject, chapter, topic, kind, search = "" } = req.query;
    if (!mongoose.isValidObjectId(subject)) fail("Choose a subject first.");
    const filter = { subject, status: { $ne: "archived" }, contentLanguage: { $ne: "ur" }, contentType: kindType[kind] || "mcq" };
    if (mongoose.isValidObjectId(chapter)) filter.chapter = chapter;
    if (mongoose.isValidObjectId(topic)) filter.topic = topic;
    const term = String(search).trim().slice(0, 80);
    if (term) filter.questionText = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const page = Math.max(1, Math.min(500, Number.parseInt(req.query.page, 10) || 1));
    const size = 20;
    const [rows, total] = await Promise.all([
        Question.find(filter).select("contentType questionText options correctOption isImportant chapter topic scenario difficulty").sort({ isImportant: -1, _id: 1 }).skip((page - 1) * size).limit(size).lean(),
        Question.countDocuments(filter),
    ]);
    const scenarios = rows.filter(row => row.scenario).length ? await QuestionScenario.find({ _id: { $in: rows.filter(row => row.scenario).map(row => row.scenario) } }).select("title scenarioText").lean() : [];
    res.json({ success: true, total, pages: Math.max(1, Math.ceil(total / size)), questions: rows.map(publicQuestion), scenarios });
};

// Every question of one scenario, so a scenario can be added to a paper as a whole.
const scenarioGroup = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) fail("Scenario not found.", 404);
    const rows = await Question.find({ scenario: req.params.id, status: { $ne: "archived" }, contentLanguage: { $ne: "ur" } }).select("contentType questionText options correctOption isImportant chapter topic scenario difficulty").sort({ _id: 1 }).lean();
    const scenario = await QuestionScenario.findById(req.params.id).select("title scenarioText").lean();
    if (!scenario || !rows.length) fail("Scenario not found.", 404);
    res.json({ success: true, scenario: { _id: id(scenario), title: scenario.title, scenarioText: scenario.scenarioText }, questions: rows.map(publicQuestion) });
};

// The questions a paper may use: published or draft, not archived, English only (Urdu needs a font the PDF does not have yet).
async function loadBank(config) {
    const chapters = config.scope.chapters.map(item => new mongoose.Types.ObjectId(item.chapter));
    const rows = await Question.find({ subject: config.scope.subject, chapter: { $in: chapters }, status: { $ne: "archived" }, contentLanguage: { $ne: "ur" } })
        .select("contentType questionText options correctOption isImportant chapter topic scenario imageUrls").limit(MAX_BANK).lean();
    return rows;
}
async function loadScenarios(questions) {
    const ids = [...new Set(questions.map(q => id(q.scenario)).filter(Boolean))];
    if (!ids.length) return {};
    const rows = await QuestionScenario.find({ _id: { $in: ids } }).select("title scenarioText").lean();
    return Object.fromEntries(rows.map(row => [id(row), row]));
}
// Questions used in the teacher's recent papers, for "avoid repeats".
async function recentlyUsed(ownerId, exceptId) {
    const papers = await QuestionPaper.find({ owner: ownerId, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).sort({ updatedAt: -1 }).limit(10).select("selection").lean();
    return new Set(papers.flatMap(paper => Object.values(paper.selection || {}).flat().flatMap(slot => (slot.questions || []).map(String))));
}
const CUSTOM_ID = /^c_[a-z0-9]{4,16}$/;
const TYPES = ["mcq", "short_question", "long_question"];
const cleanText = (value, max) => String(value ?? "").replace(/\r/g, "").trim().slice(0, max);
// The teacher's own questions: validated here so a paper can only hold well-formed ones.
function cleanCustom(list) {
    const seen = new Set();
    const out = [];
    for (const item of (Array.isArray(list) ? list : []).slice(0, 60)) {
        if (!CUSTOM_ID.test(String(item?._id)) || seen.has(item._id) || !TYPES.includes(item.contentType)) continue;
        const questionText = cleanText(item.questionText, 1500);
        if (!questionText) continue;
        const entry = { _id: item._id, contentType: item.contentType, questionText, chapter: mongoose.isValidObjectId(item.chapter) ? String(item.chapter) : "", isCustom: true };
        if (item.contentType === "mcq") {
            const options = (Array.isArray(item.options) ? item.options : []).slice(0, 4).map((option, i) => ({ key: String.fromCharCode(65 + i), text: cleanText(option?.text, 300) }));
            if (options.length < 2 || options.some(option => !option.text) || !options.some(option => option.key === item.correctOption)) continue;
            entry.options = options; entry.correctOption = item.correctOption;
        }
        seen.add(item._id); out.push(entry);
    }
    return out;
}
const customView = list => (list || []).map(q => ({ ...q, options: q.options || [], isImportant: false, topic: "", scenario: "" }));
const newSeed = () => new mongoose.Types.ObjectId().toString();

// Question text and scenarios for the picked questions, so the editor can show them.
async function detailsFor(selection, custom = []) {
    const ids = [...new Set(Object.values(selection || {}).flat().flatMap(slot => slot.questions || []).map(String))].filter(value => mongoose.isValidObjectId(value));
    const rows = ids.length ? await Question.find({ _id: { $in: ids } }).select("contentType questionText options correctOption isImportant chapter topic scenario difficulty").lean() : [];
    return { questions: [...rows.map(publicQuestion), ...customView(custom)], scenarios: Object.values(await loadScenarios(rows)).map(row => ({ _id: id(row), title: row.title, scenarioText: row.scenarioText })) };
}

// Picks questions automatically; slots in `keep` (chosen by hand) stay as they are.
const generate = async (req, res) => {
    const config = engine.normalizeConfig(req.body.config);
    const bank = await loadBank(config);
    const exclude = config.options.avoidRepeats ? await recentlyUsed(req.admin._id, req.body.paperId) : new Set();
    const seed = typeof req.body.seed === "string" && req.body.seed ? req.body.seed.slice(0, 40) : newSeed();
    const { selection, warnings } = engine.generateSelection(config, bank, { seed: `${seed}:${Date.now() % 100000}`, exclude, keep: req.body.keep && typeof req.body.keep === "object" ? req.body.keep : {} });
    res.json({ success: true, selection, warnings, seed, available: bank.length, ...await detailsFor(selection) });
};

// One new question for a swap, avoiding those already in the paper.
const suggest = async (req, res) => {
    const config = engine.normalizeConfig(req.body.config);
    const section = config.sections.find(item => item.id === req.body.sectionId);
    if (!section) fail("Choose a section.");
    const used = new Set((Array.isArray(req.body.exclude) ? req.body.exclude : []).map(String));
    const bank = (await loadBank(config)).filter(q => q.contentType === kindType[section.kind] && !used.has(id(q)) && !q.scenario);
    const wantChapter = mongoose.isValidObjectId(req.body.chapter) ? String(req.body.chapter) : "";
    const pool = wantChapter ? bank.filter(q => id(q.chapter) === wantChapter) : bank;
    const list = pool.length ? pool : bank;
    if (!list.length) fail("No other question is available for this section.", 404);
    res.json({ success: true, question: publicQuestion(list[Math.floor(Math.random() * list.length)]) });
};

// Builds the printed layout of every version, for the on-screen preview and for exports.
async function paperFor(config, selection, seed, custom = []) {
    const ids = [...new Set(Object.values(selection || {}).flat().flatMap(slot => slot.questions || []).map(String))].filter(value => mongoose.isValidObjectId(value));
    const stored = await Question.find({ _id: { $in: ids } }).select("contentType questionText options correctOption isImportant chapter topic scenario imageUrls").lean();
    const questions = [...stored, ...customView(custom)];
    const scenarios = await loadScenarios(questions);
    const papers = config.versions.map(letter => engine.buildPaper(config, selection, questions, letter, { seed, scenarios }));
    const mixed = questions.some(q => hasNonLatin(q.questionText));
    return { papers, questions, nonLatin: mixed };
}

const preview = async (req, res) => {
    const config = engine.normalizeConfig(req.body.config);
    const seed = String(req.body.seed || "paper").slice(0, 40);
    const { papers } = await paperFor(config, req.body.selection || {}, seed, cleanCustom(req.body.custom));
    const logo = config.header.logoUrl ? await mediaStore.readImage(config.header.logoUrl).catch(() => null) : null;
    const filled = papers.some(paper => paper.sections.some(section => section.items.length));
    res.json({ success: true, papers, totalMarks: engine.totalMarks(config), layout: filled ? await measureLayout(papers, { logo }) : null });
};

const fields = body => {
    const config = engine.normalizeConfig(body.config);
    const title = String(body.title || "").replace(/\s+/g, " ").trim().slice(0, 160) || [config.header.subjectTitle, config.header.examName].filter(Boolean).join(" - ") || "Untitled paper";
    const selection = body.selection && typeof body.selection === "object" ? body.selection : {};
    const custom = cleanCustom(body.custom);
    const allowed = new Set(custom.map(q => q._id));
    const clean = {};
    for (const section of config.sections) {
        clean[section.id] = (Array.isArray(selection[section.id]) ? selection[section.id] : []).slice(0, engine.MAX_QUESTIONS).map(slot => ({
            scenario: mongoose.isValidObjectId(slot.scenario) ? String(slot.scenario) : "",
            questions: (Array.isArray(slot.questions) ? slot.questions : []).filter(value => mongoose.isValidObjectId(value) || allowed.has(String(value))).map(String).slice(0, 12),
        })).filter(slot => slot.questions.length);
    }
    return { title, config, selection: clean, custom, seed: String(body.seed || newSeed()).slice(0, 40) };
};

const list = async (req, res) => {
    const all = req.admin.role === "super_admin" && req.query.all === "1";
    const papers = await QuestionPaper.find(all ? {} : { owner: req.admin._id }).sort({ updatedAt: -1 }).limit(200).select("title owner config.header config.sections updatedAt createdAt exports").populate("owner", "name email").lean();
    res.json({ success: true, papers: papers.map(paper => ({ _id: paper._id, title: paper.title, owner: paper.owner ? { name: paper.owner.name, email: paper.owner.email } : null, mine: id(paper.owner) === id(req.admin._id), school: paper.config?.header?.schoolName || "", subject: paper.config?.header?.subjectTitle || "", exam: paper.config?.header?.examName || "", totalMarks: (paper.config?.sections || []).reduce((sum, section) => sum + (section.kind === "mcq" ? section.total : section.attempt) * section.marksEach, 0), exports: paper.exports || 0, updatedAt: paper.updatedAt })) });
};

const getOne = async (req, res) => {
    const paper = await loadOwned(req);
    res.json({ success: true, paper: { _id: paper._id, title: paper.title, config: paper.config, selection: paper.selection, custom: paper.custom || [], seed: paper.seed, updatedAt: paper.updatedAt }, ...await detailsFor(paper.selection, paper.custom) });
};
async function loadOwned(req) {
    if (!mongoose.isValidObjectId(req.params.id)) fail("Paper not found.", 404);
    const paper = await QuestionPaper.findById(req.params.id).lean();
    if (!paper || !isOwner(req, paper)) fail("Paper not found.", 404);
    return paper;
}

const create = async (req, res) => {
    if (req.admin.role !== "super_admin") {
        const today = new Date(Date.now() - 24 * 3600 * 1000);
        if (await QuestionPaper.countDocuments({ owner: req.admin._id, createdAt: { $gte: today } }) >= MAX_PAPERS_PER_DAY) fail(`You can save up to ${MAX_PAPERS_PER_DAY} new papers a day. Edit an existing paper or try again tomorrow.`, 429);
    }
    const paper = await QuestionPaper.create({ ...fields(req.body), owner: req.admin._id });
    res.status(201).json({ success: true, paper: { _id: paper._id, seed: paper.seed } });
};
const update = async (req, res) => {
    const paper = await loadOwned(req);
    const saved = await QuestionPaper.findByIdAndUpdate(paper._id, { $set: fields({ ...req.body, seed: req.body.seed || paper.seed }) }, { returnDocument: "after" }).lean();
    res.json({ success: true, paper: { _id: saved._id, seed: saved.seed, updatedAt: saved.updatedAt } });
};
const remove = async (req, res) => {
    const paper = await loadOwned(req);
    await QuestionPaper.deleteOne({ _id: paper._id });
    res.json({ success: true });
};
const duplicate = async (req, res) => {
    const paper = await loadOwned(req);
    const copy = await QuestionPaper.create({ owner: req.admin._id, title: `${paper.title} (copy)`.slice(0, 160), config: paper.config, selection: paper.selection, custom: paper.custom || [], seed: newSeed() });
    res.status(201).json({ success: true, paper: { _id: copy._id } });
};

const tearName = (config, paper) => (config.layout.mode === "tear" ? "Groups-A-and-B" : `Version-${paper.version}`);
const safeName = value => String(value || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

// A saved paper as a PDF or Word file; `key=1` gives the answer key for every version instead.
const exportPaper = (req, res, next) => renderTurn(async () => {
    try {
        const stored = await loadOwned(req);
        if (!exportAllowed(id(req.admin._id))) fail("You have exported many papers in the last hour. Please try again a little later.", 429);
        const format = req.query.format === "docx" ? "docx" : "pdf";
        const config = engine.normalizeConfig(stored.config);
        const { papers } = await paperFor(config, stored.selection, stored.seed, stored.custom);
        if (!papers.some(paper => paper.sections.some(section => section.items.length))) fail("This paper has no questions yet. Pick the questions first.");
        const logo = config.header.logoUrl ? await mediaStore.readImage(config.header.logoUrl).catch(() => null) : null;
        const wantKey = req.query.key === "1";
        const letter = String(req.query.version || config.versions[0]).toUpperCase();
        const paper = papers.find(item => item.version === letter) || papers[0];
        const tear = config.layout.mode === "tear";
        let buffer;
        if (wantKey) buffer = format === "docx" ? await renderKeyDocx(papers, { logo }) : await renderKeyPdf(papers, { title: stored.title, logo });
        else {
            const sheet = tear ? papers : [paper];
            const fit = await measureLayout(sheet, { logo, title: stored.title });
            if (!fit.fits && tear) fail("This paper is too long to fit half a sheet. Remove a few questions or choose the single-paper layout.");
            buffer = format === "docx" ? await renderPaperDocx(sheet, { logo, scale: fit.scale }) : (await renderPaperPdf(sheet, { logo, title: stored.title })).buffer;
        }
        await QuestionPaper.updateOne({ _id: stored._id }, { $inc: { exports: 1 } });
        const name = [safeName(config.header.subjectTitle || stored.title), safeName(config.header.examName), wantKey ? "Answer-Key" : tearName(config, paper)].filter(Boolean).join("_");
        res.set({ "Content-Type": MIME[format], "Content-Disposition": `attachment; filename="${name}.${format}"`, "Content-Length": String(buffer.length), "Cache-Control": "private, no-store" }).send(buffer);
    } catch (error) { next(error); }
});

const uploadLogo = async (req, res) => {
    if (!req.file) fail("Please choose a logo image.");
    const { imageExtension } = require("../services/imageUpload");
    if (imageExtension(req.file.buffer) === ".webp") fail("Upload the logo as a PNG or JPG image.");
    res.status(201).json({ success: true, logoUrl: await mediaStore.storeImage(req.file.buffer, "paper-logo") });
};

module.exports = { scenarioGroup, catalog, schools, outline, browse, generate, suggest, preview, list, getOne, create, update, remove, duplicate, exportPaper, uploadLogo };
