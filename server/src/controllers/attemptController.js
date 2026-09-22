const Assessment = require("../models/Assessment");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const Question = require("../models/Question");
const LearningActivity = require("../models/LearningActivity");
const { gradeAttempt } = require("../services/assessmentScoring");

const attemptQuestionSelect = "type questionText options difficulty marks estimatedTimeSeconds scenario";

const startAttempt = async (req, res) => {
    const { assessmentId, chapter, topic } = req.body;
    let assessment;
    try {
        assessment = chapter || topic
            ? await require("../services/scopeTest").createScopeTest(chapter, topic)
            : await Assessment.findById(assessmentId).lean();
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to start test. Please try again." });
    }

    if (!assessment || assessment.status !== "published") {
        return res.status(404).json({ success: false, message: "Assessment not found." });
    }

    if (assessment.allowResume) {
        const existing = await AssessmentAttempt.findOne({
            assessment: assessment._id,
            student: req.student._id,
            status: "in_progress",
        });
        if (existing) {
            return getAttemptById(req, res, existing._id);
        }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + assessment.durationMinutes * 60 * 1000);
    const questionDocs = await Question.find({ _id: { $in: assessment.questions.map(item => item.question) } }).select("_id type scenario correctOption marks").lean();
    const keys = new Map(questionDocs.map((question) => [String(question._id), question]));
    if (assessment.questions.some((item) => !keys.has(String(item.question)))) return res.status(400).json({ message: "This test has unavailable questions. Please contact support." });
    const orderedQuestions = require("../services/scenarioOrder").groupScenarioQuestions(assessment.questions, questionDocs);
    const answers = orderedQuestions.map((item) => ({
        question: item.question,
        marksAwarded: 0,
        skipped: false,
        flaggedForReview: false,
    }));

    const attempt = await AssessmentAttempt.create({
        student: req.student._id,
        assessment: assessment._id,
        answers,
        totalMarks: assessment.totalMarks,
        startedAt: now,
        expiresAt,
        passingMarksSnapshot: assessment.passingMarks,
        gradingSnapshot: orderedQuestions.map((item) => ({ question: item.question, correctOption: keys.get(String(item.question)).correctOption, marks: item.marks ?? keys.get(String(item.question)).marks ?? 1 })),
    });

    await LearningActivity.create({
        student: req.student._id,
        type: "assessment_started",
        subject: assessment.subject,
        chapter: assessment.chapter,
        topic: assessment.topic,
        metadata: { assessment: assessment._id, attempt: attempt._id },
    });

    return getAttemptById(req, res, attempt._id);
};

const getAttemptById = async (req, res, id = req.params.id) => {
    const attempt = await AssessmentAttempt.findOne({ _id: id, student: req.student._id })
        .populate({
            path: "assessment",
            select: "title type durationMinutes totalMarks passingMarks instructions showCorrectAnswers",
        })
        .populate({
            path: "answers.question",
            select: attemptSelect(req),
            populate: { path: "scenario", select: "title scenarioText" },
        })
        .lean();

    if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
    res.json({ success: true, attempt, serverNow: new Date() });
};

const attemptSelect = () => {
    return attemptQuestionSelect;
};

const saveAnswer = async (req, res) => {
    const { selectedOption, skipped, flaggedForReview, timeSpentSeconds = 0 } = req.body;
    const receivedAt = new Date();
    const update = {};
    if (selectedOption !== undefined) {
        const question = await Question.findById(req.params.questionId).select("options").lean();
        if (typeof selectedOption !== "string" || (selectedOption && !question?.options.some((option) => option.key === selectedOption))) return res.status(400).json({ message: "Choose a valid answer option." });
        update["answers.$.selectedOption"] = selectedOption;
        update["answers.$.skipped"] = !selectedOption;
    }
    if (skipped !== undefined) update["answers.$.skipped"] = Boolean(skipped);
    if (flaggedForReview !== undefined) update["answers.$.flaggedForReview"] = Boolean(flaggedForReview);

    if (Number.isFinite(Number(timeSpentSeconds)) && Number(timeSpentSeconds) > 0) update["answers.$.timeSpentSeconds"] = Number(timeSpentSeconds);
    if (selectedOption) update["answers.$.answeredAt"] = new Date();

    const result = await AssessmentAttempt.updateOne(
        {
            _id: req.params.id,
            student: req.student._id,
            status: "in_progress",
            expiresAt: { $gt: receivedAt },
            "answers.question": req.params.questionId,
        },
        { $set: update }
    );

    if (result.matchedCount === 0) {
        const attempt = await AssessmentAttempt.findOne({ _id: req.params.id, student: req.student._id }).select("status expiresAt").lean();
        if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
        if (attempt.expiresAt <= receivedAt) return res.status(409).json({ message: "Time is up. Submit your saved answers to view your result." });
        if (attempt.status !== "in_progress") {
            return res.status(400).json({ success: false, message: "This attempt has already been submitted." });
        }
        return res.status(404).json({ success: false, message: "Question is not part of this attempt." });
    }

    res.json({
        success: true,
        answer: {
            question: req.params.questionId,
            selectedOption,
            skipped: Boolean(skipped),
            flaggedForReview: Boolean(flaggedForReview),
        },
    });
};

const submitAttempt = async (req, res) => {
    const receivedAt = new Date();
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.id, student: req.student._id }).select("+gradingSnapshot");
    if (!attempt) return res.status(404).json({ message: "Attempt not found." });
    if (attempt.status !== "in_progress") {
        return res.json({ success: true, attempt: { _id: attempt._id } });
    }
    const assessment = await Assessment.findById(attempt.assessment).lean();
    if (!assessment) return res.status(404).json({ message: "Test not found. Please contact support." });
    let grading = attempt.gradingSnapshot;
    if (!grading?.length) {
        const questions = await Question.find({ _id: { $in: attempt.answers.map((answer) => answer.question) } }).lean();
        const marks = new Map(assessment.questions.map((item) => [String(item.question), item.marks]));
        grading = questions.map((question) => ({ question: question._id, correctOption: question.correctOption, marks: marks.get(String(question._id)) ?? question.marks ?? 1 }));
    }
    const result = gradeAttempt(attempt, grading, attempt.passingMarksSnapshot ?? assessment.passingMarks, receivedAt);
    // Only finalize the exact answer revision that was graded.
    const saved = await AssessmentAttempt.findOneAndUpdate({
        _id: attempt._id, student: req.student._id, status: "in_progress", updatedAt: attempt.updatedAt,
    }, { $set: result }, { new: true });
    if (!saved) return res.status(409).json({ message: "Your answers changed while submitting. Please submit again." });
    await LearningActivity.create({
        student: req.student._id, type: "assessment_submitted",
        subject: assessment.subject, chapter: assessment.chapter, topic: assessment.topic,
        metadata: { assessment: assessment._id, attempt: attempt._id, score: result.score, percentage: result.percentage },
    });
    res.json({ success: true, attempt: saved });
};

const getResult = async (req, res) => {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.id, student: req.student._id })
        .select("+gradingSnapshot")
        .populate("assessment", "title type totalMarks passingMarks showCorrectAnswers")
        .populate({
            path: "answers.question",
            populate: { path: "scenario", select: "title scenarioText" },
        })
        .lean();

    if (!attempt) return res.status(404).json({ success: false, message: "Result not found." });
    if (attempt.status === "in_progress") {
        return res.status(400).json({ success: false, message: "Attempt is still in progress." });
    }

    const keys = new Map((attempt.gradingSnapshot || []).map((item) => [String(item.question), item]));
    for (const answer of attempt.answers) {
        if (!answer.question) continue;
        const key = keys.get(String(answer.question._id));
        if (key) answer.question.correctOption = key.correctOption;
        if (attempt.assessment?.showCorrectAnswers === false) {
            delete answer.question.correctOption;
            delete answer.question.explanation;
        }
    }
    delete attempt.gradingSnapshot;
    attempt.percentage = attempt.totalMarks > 0 ? Number((attempt.score / attempt.totalMarks * 100).toFixed(2)) : 0;
    attempt.points = Number((attempt.score * 100).toFixed(2));
    res.json({ success: true, attempt });
};

const getStudentAttempts = async (req, res) => {
    const attempts = await AssessmentAttempt.find({ student: req.student._id })
        .populate("assessment", "title type subject chapter topic")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    res.json({ success: true, attempts });
};

module.exports = {
    startAttempt,
    getAttemptById,
    saveAnswer,
    submitAttempt,
    getResult,
    getStudentAttempts,
};
