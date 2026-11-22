const imp = require("../services/curriculumImport");

const send = (res, error, next) => (error.status ? res.status(error.status).json({ success: false, message: error.message }) : next(error));
const needFile = (req) => { if (!req.file?.buffer) throw Object.assign(new Error("Choose an Excel file (.xlsx) to upload."), { status: 400 }); };
// "save=1" adds the new rows; otherwise the file is only checked and previewed.
const saving = (req) => ["1", "true"].includes(String(req.body.save || req.query.save || ""));

exports.chapterTemplate = async (req, res, next) => {
    try { res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=chapters-sample.xlsx" }).send(await imp.template("chapter")); } catch (e) { send(res, e, next); }
};
exports.topicTemplate = async (req, res, next) => {
    try { res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=topics-sample.xlsx" }).send(await imp.template("topic")); } catch (e) { send(res, e, next); }
};
exports.importChapters = async (req, res, next) => {
    try {
        needFile(req);
        const { board, class: cls, group, subject } = req.body;
        res.json({ success: true, ...(await imp.importChapters(req.file.buffer, { board, class: cls, group, subject }, { save: saving(req) })) });
    } catch (e) { send(res, e, next); }
};
exports.importTopics = async (req, res, next) => {
    try { needFile(req); res.json({ success: true, ...(await imp.importTopics(req.file.buffer, req.body.chapterId, { save: saving(req) })) }); } catch (e) { send(res, e, next); }
};
