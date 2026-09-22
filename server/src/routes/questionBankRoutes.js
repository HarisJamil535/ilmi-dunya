const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const {
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
    getPublicTopicQuestions,
} = require("../controllers/questionBankController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/topic-questions", getPublicTopicQuestions);
router.get("/", authMiddleware, getQuestions);
router.post("/", authMiddleware, createQuestion);
router.get("/scenarios/list", authMiddleware, getScenarios);
router.post("/scenarios", authMiddleware, createScenario);
router.put("/scenarios/:id", authMiddleware, updateScenario);
router.post("/import/preview", authMiddleware, upload.single("file"), importPreview);
router.post("/import/commit", authMiddleware, importCommit);
router.get("/import/template", authMiddleware, downloadImportTemplate);
router.put("/:id", authMiddleware, updateQuestion);
router.delete("/:id", authMiddleware, deleteQuestion);

module.exports = router;
