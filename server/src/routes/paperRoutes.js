const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const papers = require("../controllers/paperController");

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => (["image/jpeg", "image/png"].includes(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error("Upload the logo as a PNG or JPG image."), { status: 400 }))),
});
// Teachers hold only the "papers" permission, so these routes are all they can reach.
router.use(authMiddleware);
router.get("/catalog", papers.catalog);
router.get("/schools", papers.schools);
router.get("/subjects/:id/outline", papers.outline);
router.get("/questions", papers.browse);
router.get("/scenarios/:id", papers.scenarioGroup);
router.post("/logo", upload.single("logo"), papers.uploadLogo);
router.post("/generate", papers.generate);
router.post("/suggest", papers.suggest);
router.post("/preview", papers.preview);
router.get("/", papers.list);
router.post("/", papers.create);
router.get("/:id", papers.getOne);
router.put("/:id", papers.update);
router.delete("/:id", papers.remove);
router.post("/:id/duplicate", papers.duplicate);
router.get("/:id/export", papers.exportPaper);

module.exports = router;
