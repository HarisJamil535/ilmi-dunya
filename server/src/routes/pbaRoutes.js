const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const pba = require("../controllers/pbaController");

// Public pages: the PBA button check and a subject's topics and practicals.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => (["image/jpeg", "image/png"].includes(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error("Upload the picture as a PNG or JPG file under 2 MB."), { status: 400 }))),
});

const publicRouter = express.Router();
publicRouter.get("/status", pba.status);
publicRouter.get("/:subjectId", pba.overview);
publicRouter.get("/:subjectId/practicals/:id", pba.question);

// Admin: everything is managed per subject.
const manageRouter = express.Router();
manageRouter.use(authMiddleware);
manageRouter.get("/:subjectId", pba.manage);
manageRouter.put("/:subjectId/enabled", pba.setEnabled);
manageRouter.put("/:subjectId/setting", pba.saveSetting);
manageRouter.post("/:subjectId/reorder", pba.reorder);
manageRouter.post("/:subjectId/image", upload.single("image"), pba.uploadImage);
manageRouter.post("/:subjectId/topics", pba.createTopic);
manageRouter.put("/:subjectId/topics/:id", pba.updateTopic);
manageRouter.delete("/:subjectId/topics/:id", pba.removeTopic);
manageRouter.post("/:subjectId/practicals", pba.createPractical);
manageRouter.put("/:subjectId/practicals/:id", pba.updatePractical);
manageRouter.delete("/:subjectId/practicals/:id", pba.removePractical);
manageRouter.post("/:subjectId/categories", pba.createCategory);
manageRouter.put("/:subjectId/categories/:id", pba.updateCategory);
manageRouter.delete("/:subjectId/categories/:id", pba.removeCategory);

module.exports = { publicRouter, manageRouter };
