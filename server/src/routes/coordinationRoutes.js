const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const { canUseArea } = require("../services/coordAccess");
const c = require("../controllers/coordinationController");

const router = express.Router();
const docx = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (!/\.docx$/i.test(file.originalname || "")) return cb(Object.assign(new Error("Upload a Word file (.docx). Old .doc files: open in Word and Save As .docx."), { status: 400 }));
    cb(null, true);
} });
const picture = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (!["image/png", "image/jpeg"].includes(file.mimetype)) return cb(Object.assign(new Error("Use a PNG or JPG picture."), { status: 400 }));
    cb(null, true);
} });

// Signed in, plus access to the Coordination area. Each file then checks the person's role on it.
router.use(authMiddleware, (req, res, next) => (canUseArea(req.admin) ? next() : res.status(403).json({ success: false, message: "You do not have access to coordination files." })));

router.get("/files", c.listFiles);
router.post("/files", c.createFile);
router.get("/overview", c.overview);
router.get("/inbox", c.inbox);
router.get("/notifications", c.listNotifications);
router.post("/notifications/read-all", c.readAllNotifications);
router.post("/notifications/:id/read", c.readNotification);
router.get("/announcements", c.listAnnouncements);
router.post("/announcements", c.createAnnouncement);
router.post("/announcements/:id/read", c.readAnnouncement);
router.get("/announcements/:id/readers", c.announcementReaders);
router.delete("/announcements/:id", c.deleteAnnouncement);
router.post("/departments", c.createDepartment);
router.patch("/departments/:id", c.updateDepartment);
router.delete("/departments/:id", c.deleteDepartment);
router.post("/staff", c.createStaff);
router.patch("/staff/:id", c.updateStaff);
router.delete("/staff/:id", c.removeStaff);
router.get("/subjects", c.subjects);
router.get("/settings", c.getSettings);
router.put("/settings", c.updateSettings);
router.post("/settings/watermark", picture.single("image"), c.uploadWatermark);
router.get("/me/signature", c.getSignature);
router.post("/me/signature", picture.single("image"), c.uploadSignature);
router.delete("/me/signature", c.removeSignature);

router.get("/files/:id", c.getFile);
router.patch("/files/:id", c.updateFile);
router.delete("/files/:id", c.deleteFile);
router.post("/files/:id/weeks", c.createWeek);
router.delete("/files/:id/weeks", c.deleteWeeks);
router.get("/files/:id/copy-sources", c.copySources);
router.post("/files/:id/import", docx.single("file"), c.importIntoFile);
router.get("/files/:id/export", c.exportFile);

router.get("/weeks/:id", c.getWeek);
router.get("/weeks/:id/fit", c.fit);
router.patch("/weeks/:id", c.updateWeek);
router.delete("/weeks/:id", c.deleteWeek);
router.put("/weeks/:id/cells", c.saveCells);
router.post("/weeks/:id/import", docx.single("file"), c.importIntoWeek);
router.get("/weeks/:id/export", c.exportWeek);
router.post("/weeks/:id/versions", c.saveVersion);
router.get("/weeks/:id/versions/:versionId", c.getVersion);
router.post("/weeks/:id/versions/:versionId/restore", c.restoreVersion);
router.post("/weeks/:id/comments", c.addComment);
for (const action of ["submit", "approve", "reopen", "resign"]) router.post(`/weeks/:id/${action}`, (req, res, next) => { req.params.action = action; next(); }, c.status);
router.post("/comments/:commentId/replies", c.replyComment);
router.patch("/comments/:commentId", c.updateComment);
router.delete("/comments/:commentId", c.deleteComment);

module.exports = router;
