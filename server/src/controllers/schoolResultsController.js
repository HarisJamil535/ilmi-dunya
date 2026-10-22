const { loadScope, previewReport, fullReport } = require("../services/schoolResults");
const { buildWorkbookOffThread, workbookName } = require("../services/schoolResultsWorkbook");

const filtersFor = scope => ({
    school: { _id: scope.school._id, name: scope.school.name },
    className: scope.className,
    sectionName: scope.sectionName,
    from: scope.range.start || null,
    to: scope.range.end || null,
});

// On-screen report: totals for the whole selection and one page of attempts.
const getSchoolResults = async (req, res, next) => {
    try {
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
        const scope = await loadScope(req.params.id, req.query);
        res.json({ success: true, filters: filtersFor(scope), ...await previewReport(scope, page, limit) });
    } catch (error) { next(error); }
};

// Excel download with a summary, a student sheet and one row per attempt.
const exportSchoolResults = async (req, res, next) => {
    try {
        const scope = await loadScope(req.params.id, req.query);
        const report = await fullReport(scope);
        const generatedAt = new Date();
        const buffer = await buildWorkbookOffThread(scope, report, generatedAt);
        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${workbookName(scope, generatedAt)}"`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "private, no-store",
        }).send(buffer);
    } catch (error) { next(error); }
};

module.exports = { getSchoolResults, exportSchoolResults };
