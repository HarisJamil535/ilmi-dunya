const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const PbaTopic = require("../models/PbaTopic");
const PbaCategory = require("../models/PbaCategory");
const PbaPractical = require("../models/PbaPractical");
const mediaStore = require("../services/mediaStore");
const { fail } = require("../services/publishing");
const content = require("../services/pbaContent");
const pbaPaper = require("../services/pbaPaper");
const { renderPbaPdf, measurePba, imageUrlsOf } = require("../services/pbaPaperPdf");
const { renderPbaDocx } = require("../services/pbaPaperDocx");
const { fadeImage } = require("../services/watermark");

const id = value => String(value?._id || value || "");
const newSeed = () => new mongoose.Types.ObjectId().toString();
const MAX_CUSTOM = 40;

// Practicals a teacher can pick from, with their full questions; only the written ones are useful in a paper.
const practicals = async (req, res) => {
    if (!mongoose.isValidObjectId(req.query.subject)) fail("Choose a subject.");
    const subject = await Subject.findById(req.query.subject).select("name").lean();
    if (!subject) fail("Subject not found.", 404);
    const [topics, categories, rows] = await Promise.all([
        PbaTopic.find({ subject: subject._id }).sort({ order: 1 }).select("name order").lean(),
        PbaCategory.find({ subject: subject._id }).sort({ order: 1 }).select("name order").lean(),
        PbaPractical.find({ subject: subject._id }).sort({ order: 1 }).lean(),
    ]);
    res.json({
        success: true, subject: { _id: subject._id, name: subject.name },
        topics: topics.map(row => ({ _id: id(row), name: row.name })), categories: categories.map(row => ({ _id: id(row), name: row.name })),
        practicals: rows.filter(pbaPaper.hasContent).map(row => ({ _id: id(row), title: row.title, label: row.label || "", topic: id(row.topic), category: id(row.category), marks: row.marks || 0, blocks: row.blocks || [], parts: row.parts || [] })),
    });
};

// Questions the teacher wrote for this paper only; they never enter the practical list.
function cleanCustom(list) {
    return (Array.isArray(list) ? list : []).slice(0, MAX_CUSTOM).filter(item => /^c_[a-z0-9]{4,16}$/.test(String(item?._id))).map(item => {
        const parts = content.cleanParts(item.parts);
        return { _id: String(item._id), title: String(item.title || "").replace(/\s+/g, " ").trim().slice(0, 200), blocks: content.cleanBlocks(item.blocks), parts, marks: parts.length ? content.totalOf(parts) : Math.min(Math.max(Number(item.marks) || 0, 0), 100) };
    });
}

function cleanSelection(config, selection, custom) {
    const allowed = new Set(custom.map(item => item._id));
    const out = {};
    for (const section of config.sections) {
        const entries = Array.isArray(selection?.[section.id]) ? selection[section.id] : [];
        out[section.id] = section.slots.map((slot, index) => {
            const entry = entries[index];
            const key = String(entry?.id || "");
            if (!mongoose.isValidObjectId(key) && !allowed.has(key)) return null;
            const partMarks = Array.isArray(entry.partMarks) ? entry.partMarks.slice(0, 12).map(value => (value === null || value === "" ? null : Math.min(Math.max(Number(value) || 0, 0), 100))) : undefined;
            return partMarks && partMarks.some(value => value !== null) ? { id: key, partMarks } : { id: key };
        });
    }
    return out;
}

async function loadAll(config, custom) {
    const rows = await PbaPractical.find({ subject: config.scope.subject }).lean();
    const byId = new Map(rows.map(row => [id(row), row]));
    for (const item of custom) byId.set(item._id, item);
    return { rows, byId };
}

// Every version of the paper, ready to print.
async function papersFor(config, selection, custom, seed) {
    const { rows, byId } = await loadAll(config, custom);
    const pool = rows.filter(pbaPaper.hasContent);
    return config.versions.map(letter => pbaPaper.buildPbaPaper(config, pbaPaper.selectionForVersion(config, selection, pool, letter, seed), byId, letter));
}

const generate = async (req, res) => {
    const config = pbaPaper.normalizePbaConfig(req.body.config);
    const custom = cleanCustom(req.body.custom);
    const { rows } = await loadAll(config, custom);
    const keep = cleanSelection(config, req.body.keep || {}, custom);
    const seed = typeof req.body.seed === "string" && req.body.seed ? req.body.seed.slice(0, 40) : newSeed();
    const { selection, warnings } = pbaPaper.generatePbaSelection(config, rows, { seed: `${seed}:${Date.now() % 100000}`, keep });
    res.json({ success: true, selection, warnings, seed });
};

const preview = async (req, res) => {
    const config = pbaPaper.normalizePbaConfig(req.body.config);
    const custom = cleanCustom(req.body.custom);
    const selection = cleanSelection(config, req.body.selection || {}, custom);
    const papers = await papersFor(config, selection, custom, String(req.body.seed || "paper").slice(0, 40));
    const filled = papers.some(paper => paper.sections.some(section => section.questions.length));
    let layout = null;
    if (filled) {
        const logo = config.header.logoUrl ? await mediaStore.readImage(config.header.logoUrl).catch(() => null) : null;
        layout = await measurePba(papers[0], { logo, images: await loadImages([papers[0]]) });
    }
    res.json({ success: true, papers, totalMarks: papers[0].totalMarks, layout });
};

async function loadImages(papers) {
    const images = new Map();
    await Promise.all(imageUrlsOf(papers).map(async url => { try { images.set(url, await mediaStore.readImage(url)); } catch { /* a missing picture is simply left out */ } }));
    return images;
}

const watermarkImage = async mark => {
    if (mark?.kind !== "image" || !mark.imageUrl) return null;
    try { return fadeImage(await mediaStore.readImage(mark.imageUrl), mark.strength); } catch { return null; }
};

// Everything a render needs, loaded once: every version, the logo, the watermark and all pictures.
async function exportContext(stored) {
    const config = pbaPaper.normalizePbaConfig(stored.config);
    const papers = await papersFor(config, stored.selection || {}, stored.custom || [], stored.seed);
    if (!papers.some(paper => paper.sections.some(section => section.questions.length))) fail("This paper has no questions yet. Pick the questions first.");
    const logo = config.header.logoUrl ? await mediaStore.readImage(config.header.logoUrl).catch(() => null) : null;
    return { config, papers, logo, mark: await watermarkImage(config.layout.watermark), images: await loadImages(papers), title: stored.title };
}

async function renderOne(context, paper, mode, format) {
    const { logo, mark, images, title } = context;
    if (format === "docx") {
        const fit = mode === "paper" ? await measurePba(paper, { logo, images, mark, title }) : { scale: 1 };
        return renderPbaDocx(paper, { logo, mark, images, scale: fit.scale, mode });
    }
    return (await renderPbaPdf(paper, { logo, mark, images, mode, title })).buffer;
}

// A saved paper as a PDF or Word file. mode: paper, key (answer key) or esheet.
async function exportPba(stored, query) {
    const context = await exportContext(stored);
    const letter = String(query.version || context.config.versions[0]).toUpperCase();
    const paper = context.papers.find(item => item.version === letter) || context.papers[0];
    const mode = query.key === "1" ? "key" : query.esheet === "1" ? "esheet" : "paper";
    const format = query.format === "docx" ? "docx" : "pdf";
    return { buffer: await renderOne(context, paper, mode, format), format, mode, paper, config: context.config };
}

// One ZIP with the question paper, E-sheet and answer key of every version, so a teacher prints everything in one go.
async function exportPbaBundle(stored, query) {
    const JSZip = require("jszip");
    const context = await exportContext(stored);
    const format = query.format === "docx" ? "docx" : "pdf";
    const zip = new JSZip();
    const many = context.papers.length > 1;
    for (const paper of context.papers) {
        const tag = many ? `-Version-${paper.version}` : "";
        zip.file(`1-Question-Paper${tag}.${format}`, await renderOne(context, paper, "paper", format));
        zip.file(`2-E-Sheet${tag}.${format}`, await renderOne(context, paper, "esheet", format));
        zip.file(`3-Answer-Key${tag}.${format}`, await renderOne(context, paper, "key", format));
    }
    return { buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), config: context.config };
}

module.exports = { practicals, generate, preview, cleanCustom, cleanSelection, exportPba, exportPbaBundle, papersFor };
