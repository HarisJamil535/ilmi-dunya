const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const PbaTopic = require("../models/PbaTopic");
const PbaPractical = require("../models/PbaPractical");
const PbaCategory = require("../models/PbaCategory");
const PbaSetting = require("../models/PbaSetting");
const { fail } = require("../services/publishing");
const pba = require("../services/pba");

const idOf = value => String(value?._id || value || "");
const byOrder = (a, b) => (a.order - b.order) || (new Date(a.createdAt) - new Date(b.createdAt));

async function loadSubject(id) {
    if (!mongoose.isValidObjectId(id)) fail("Choose a valid subject.");
    const subject = await Subject.findById(id).populate("board class group", "name").lean();
    if (!subject) fail("Subject not found.", 404);
    return subject;
}

// Everything the PBA page of one subject shows, in the admin's order.
async function payload(subject, full = false) {
    const [setting, topics, categories, practicals] = await Promise.all([
        PbaSetting.findOne({ subject: subject._id }).lean(),
        PbaTopic.find({ subject: subject._id }).lean(),
        PbaCategory.find({ subject: subject._id }).lean(),
        PbaPractical.find({ subject: subject._id }).lean(),
    ]);
    return {
        subject: { _id: idOf(subject), name: subject.name, board: subject.board?.name || "", class: subject.class?.name || "", group: subject.group?.name || "", pbaEnabled: Boolean(subject.pbaEnabled) },
        setting: { intro: setting?.intro || "", facts: setting?.facts || [], links: setting?.links || [] },
        topics: topics.sort(byOrder).map(t => ({ _id: idOf(t), title: t.title, summary: t.summary, videoUrl: t.videoUrl, notesUrl: t.notesUrl, order: t.order, subtopics: (t.subtopics || []).map(s => ({ _id: idOf(s), title: s.title, summary: s.summary, videoUrl: s.videoUrl, notesUrl: s.notesUrl })) })),
        categories: categories.sort(byOrder).map(c => ({ _id: idOf(c), name: c.name, order: c.order })),
        practicals: practicals.sort(byOrder).map(p => ({ _id: idOf(p), title: p.title, label: p.label, summary: p.summary, videoUrl: p.videoUrl, notesUrl: p.notesUrl, topic: idOf(p.topic), category: idOf(p.category), order: p.order, marks: p.marks || 0, hasQuestion: Boolean(p.blocks?.length || p.parts?.length), answerVisible: Boolean(p.answerVisible),
            ...(full ? { blocks: p.blocks || [], parts: p.parts || [] } : {}) })),
    };
}

// ---- Public pages -------------------------------------------------------------------------------------------

// Tells the chapters page whether to show the PBA button.
const status = async (req, res) => {
    if (!mongoose.isValidObjectId(req.query.subjectId)) return res.json({ success: true, enabled: false });
    const subject = await Subject.findById(req.query.subjectId).select("pbaEnabled").lean();
    res.json({ success: true, enabled: Boolean(subject?.pbaEnabled) });
};

const overview = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    if (!subject.pbaEnabled) return res.json({ success: true, enabled: false, subject: { _id: idOf(subject), name: subject.name } });
    res.json({ success: true, enabled: true, ...await payload(subject) });
};

// One practical's question for the student page. Model answers are left out unless the admin allowed them.
const question = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    if (!subject.pbaEnabled) fail("Practical not found.", 404);
    const practical = mongoose.isValidObjectId(req.params.id) ? await PbaPractical.findOne({ _id: req.params.id, subject: subject._id }).lean() : null;
    if (!practical) fail("Practical not found.", 404);
    const show = Boolean(practical.answerVisible);
    res.json({ success: true, practical: { _id: idOf(practical), title: practical.title, marks: practical.marks || 0, blocks: practical.blocks || [], answerVisible: show,
        parts: (practical.parts || []).map(part => ({ marks: part.marks, blocks: part.blocks || [], space: part.space, ...(show ? { answer: part.answer || [] } : {}) })) } });
};

// ---- Admin -------------------------------------------------------------------------------------------------

const manage = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    res.json({ success: true, enabled: Boolean(subject.pbaEnabled), ...await payload(subject, true) });
};

const setEnabled = async (req, res) => {
    if (typeof req.body.enabled !== "boolean") fail("Choose on or off.");
    const subject = await loadSubject(req.params.subjectId);
    await Subject.updateOne({ _id: subject._id }, { $set: { pbaEnabled: req.body.enabled } });
    res.json({ success: true, enabled: req.body.enabled });
};

const saveSetting = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    const data = pba.cleanSetting(req.body);
    await PbaSetting.updateOne({ subject: subject._id }, { $set: data, $setOnInsert: { subject: subject._id } }, { upsert: true });
    res.json({ success: true, setting: data });
};

const nextOrder = async (Model, subject) => ((await Model.findOne({ subject }).sort({ order: -1 }).select("order").lean())?.order ?? -1) + 1;
const ensureRoom = async (Model, subject, limit, noun) => { if (await Model.countDocuments({ subject }) >= limit) fail(`A subject can have up to ${limit} ${noun}.`); };

const createTopic = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    await ensureRoom(PbaTopic, subject._id, pba.LIMITS.topics, "topics");
    const topic = await PbaTopic.create({ ...pba.cleanTopic(req.body), subject: subject._id, order: await nextOrder(PbaTopic, subject._id) });
    res.status(201).json({ success: true, topic });
};
const updateTopic = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    const topic = await PbaTopic.findOneAndUpdate({ _id: req.params.id, subject: subject._id }, { $set: pba.cleanTopic(req.body) }, { returnDocument: "after", runValidators: true });
    if (!topic) fail("Topic not found.", 404);
    res.json({ success: true, topic });
};
// Practicals that belonged to a deleted topic stay, just without a topic.
const removeTopic = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    const topic = await PbaTopic.findOneAndDelete({ _id: req.params.id, subject: subject._id });
    if (!topic) fail("Topic not found.", 404);
    await PbaPractical.updateMany({ subject: subject._id, topic: topic._id }, { $set: { topic: null } });
    res.json({ success: true });
};

const refs = async subject => ({
    topics: new Set((await PbaTopic.find({ subject }).select("_id").lean()).map(idOf)),
    categories: new Set((await PbaCategory.find({ subject }).select("_id").lean()).map(idOf)),
});
const createPractical = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    await ensureRoom(PbaPractical, subject._id, pba.LIMITS.practicals, "practicals");
    const practical = await PbaPractical.create({ ...pba.cleanPractical(req.body, await refs(subject._id)), subject: subject._id, order: await nextOrder(PbaPractical, subject._id) });
    res.status(201).json({ success: true, practical });
};
const updatePractical = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    const practical = await PbaPractical.findOneAndUpdate({ _id: req.params.id, subject: subject._id }, { $set: pba.cleanPractical(req.body, await refs(subject._id)) }, { returnDocument: "after", runValidators: true });
    if (!practical) fail("Practical not found.", 404);
    res.json({ success: true, practical });
};
const removePractical = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    if (!await PbaPractical.findOneAndDelete({ _id: req.params.id, subject: subject._id })) fail("Practical not found.", 404);
    res.json({ success: true });
};

const categoryName = body => pba.clean(body.name, 60, "Category name", { required: true });
const duplicateName = error => { if (error?.code === 11000) fail("This subject already has a category with that name."); throw error; };
const sameName = (subject, name, exceptId) => PbaCategory.exists({ subject, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
const createCategory = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    await ensureRoom(PbaCategory, subject._id, pba.LIMITS.categories, "categories");
    const name = categoryName(req.body);
    if (await sameName(subject._id, name)) fail("This subject already has a category with that name.");
    const category = await PbaCategory.create({ name, subject: subject._id, order: await nextOrder(PbaCategory, subject._id) }).catch(duplicateName);
    res.status(201).json({ success: true, category });
};
const updateCategory = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    const name = categoryName(req.body);
    if (await sameName(subject._id, name, req.params.id)) fail("This subject already has a category with that name.");
    const category = await PbaCategory.findOneAndUpdate({ _id: req.params.id, subject: subject._id }, { $set: { name } }, { returnDocument: "after" }).catch(duplicateName);
    if (!category) fail("Category not found.", 404);
    res.json({ success: true, category });
};
const removeCategory = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    const used = await PbaPractical.countDocuments({ subject: subject._id, category: req.params.id });
    if (used) fail(`${used} practical${used > 1 ? "s use" : " uses"} this category. Move ${used > 1 ? "them" : "it"} to another category first.`);
    if (!await PbaCategory.findOneAndDelete({ _id: req.params.id, subject: subject._id })) fail("Category not found.", 404);
    res.json({ success: true });
};

// Pictures for questions (a router to identify, a diagram...). PNG or JPG so they can be printed on papers.
const uploadImage = async (req, res) => {
    await loadSubject(req.params.subjectId);
    if (!req.file) fail("Choose a picture to upload.");
    const { imageExtension } = require("../services/imageUpload");
    if (imageExtension(req.file.buffer) === ".webp") fail("Upload the picture as a PNG or JPG file.");
    res.status(201).json({ success: true, url: await require("../services/mediaStore").storeImage(req.file.buffer, "pba") });
};

const MODELS = { topics: PbaTopic, practicals: PbaPractical, categories: PbaCategory };
// The admin sends the ids in the order they should appear; that becomes the order students see.
const reorder = async (req, res) => {
    const subject = await loadSubject(req.params.subjectId);
    const Model = MODELS[req.body.kind];
    if (!Model) fail("Choose what to reorder.");
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    if (!ids.length || ids.length > 600 || new Set(ids).size !== ids.length || ids.some(value => !mongoose.isValidObjectId(value))) fail("The new order is not valid.");
    const owned = new Set((await Model.find({ subject: subject._id, _id: { $in: ids } }).select("_id").lean()).map(idOf));
    if (owned.size !== ids.length) fail("Some items do not belong to this subject.");
    await Model.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })));
    res.json({ success: true });
};

module.exports = { question, uploadImage, status, overview, manage, setEnabled, saveSetting, createTopic, updateTopic, removeTopic, createPractical, updatePractical, removePractical, createCategory, updateCategory, removeCategory, reorder };
