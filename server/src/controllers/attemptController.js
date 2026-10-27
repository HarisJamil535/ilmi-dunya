const Assessment = require("../models/Assessment");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const Question = require("../models/Question");
const LearningActivity = require("../models/LearningActivity");
const { gradeAttempt } = require("../services/assessmentScoring");
const { rankEligibility } = require("../services/leaderboardScoring");
const { attemptRankingNote } = require("../services/ranking");
const { loadRankableAttempts } = require("./leaderboardController");
const { finishExpiredAttempts, gradingFor } = require("../services/expiredAttempts");
const LeaderboardState = require("../models/LeaderboardState");
const mongoose = require("mongoose");
const { supportsSelection, resolveQuestionCount, selectQuestions, shuffled } = require("../services/attemptSelection");
const { withLock } = require("../services/keyedLock");
const { startBlocker, attemptExpiry, orderOptions, resultsWithheld, withholdScores } = require("../services/attemptRules");
const { timingOf, attemptSeconds } = require("../services/testTiming");

const attemptQuestionSelect = "type questionText contentLanguage options imageUrls imageAlt difficulty marks estimatedTimeSeconds scenario";

const previewAttempt = async (req, res) => {
    const { assessmentId, chapter, topic } = req.query;
    if (!chapter && !topic && !mongoose.isValidObjectId(assessmentId)) return res.status(400).json({ success: false, message: "Choose a valid test." });
    let assessment;
    try {
        assessment = chapter || topic
            ? await require("../services/scopeTest").createScopeTest(chapter, topic)
            : await Assessment.findById(assessmentId).lean();
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to load test details. Please try again." });
    }
    if (!assessment || assessment.status !== "published" || !assessment.createdBy) return res.status(404).json({ success: false, message: "Test not found." });
    const existing = assessment.allowResume && await AssessmentAttempt.findOne({
        assessment: assessment._id,
        student: req.student._id,
        status: "in_progress",
        expiresAt: { $gt: new Date() },
    }).select("_id answers totalMarks startedAt expiresAt isPartialPractice").lean();
    if (!existing) {
        const blocker = await startBlocker(assessment, req.student._id);
        if (blocker) return res.status(403).json({ success: false, message: blocker });
    }
    res.json({ success: true, test: {
        title: assessment.title,
        type: assessment.type,
        questionCount: existing ? existing.answers.length : assessment.questions.length,
        availableQuestions: assessment.questions.length,
        canChooseCount: supportsSelection(assessment) && !existing,
        durationMinutes: existing ? Math.ceil((new Date(existing.expiresAt) - new Date(existing.startedAt)) / 60000) : Math.ceil(attemptSeconds(assessment, assessment.questions.length) / 60),
        // Lets the page show the time for any number of MCQs the student picks.
        timing: timingOf(assessment),
        totalMarks: existing ? existing.totalMarks : assessment.totalMarks,
        instructions: assessment.instructions,
        ranked: assessment.type !== "custom_practice" && !existing?.isPartialPractice && !resultsWithheld(assessment),
        resume: Boolean(existing),
        closesAt: assessment.endsAt || null,
        maxAttempts: Number(assessment.maxAttempts) || 0,
        resultsWithheld: resultsWithheld(assessment),
    } });
};

// A student starting the same test twice at once (double click, retry on a slow network) must get one attempt.
const startAttempt = (req, res) => {
    const { assessmentId, chapter, topic } = req.body || {};
    return withLock(`start:${req.student._id}:${assessmentId || topic || chapter}`, () => beginAttempt(req, res));
};

const beginAttempt = async (req, res) => {
    const { assessmentId, chapter, topic } = req.body;
    let assessment;
    try {
        assessment = chapter || topic
            ? await require("../services/scopeTest").createScopeTest(chapter, topic)
            : await Assessment.findById(assessmentId).lean();
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to start test. Please try again." });
    }

    if (!assessment || assessment.status !== "published" || !assessment.createdBy) {
        return res.status(404).json({ success: false, message: "Assessment not found." });
    }

    if (assessment.allowResume) {
        const existing = await AssessmentAttempt.findOne({
            assessment: assessment._id,
            student: req.student._id,
            status: "in_progress",
            expiresAt: { $gt: new Date() },
        });
        if (existing) {
            return getAttemptById(req, res, existing._id);
        }
    }

    const blocker = await startBlocker(assessment, req.student._id);
    if (blocker) return res.status(403).json({ success: false, message: blocker });

    let count = assessment.questions.length;
    try {
        if (supportsSelection(assessment)) count = resolveQuestionCount(req.body.questionCount, count);
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
    if (!count) return res.status(400).json({ success: false, message: "This test has no available questions." });
    const isPartialPractice = count < assessment.questions.length;
    const previous = isPartialPractice ? await AssessmentAttempt.findOne({ student: req.student._id, assessment: assessment._id }).sort({ createdAt: -1, _id: -1 }).select("answers.question").lean() : null;
    let selected = selectQuestions(assessment.questions, count, previous?.answers.map(item => item.question) || []);
    if (assessment.shuffleQuestions) selected = shuffled(selected).map((item, index) => ({ ...item, order: index + 1 }));
    const now = new Date();
    const expiresAt = attemptExpiry(assessment, now, attemptSeconds(assessment, count, assessment.questions.length));
    const questionDocs = await Question.find({ _id: { $in: selected.map(item => item.question) }, status: { $ne: "archived" } }).select(`_id type scenario correctOption marks${assessment.shuffleOptions ? " options.key" : ""}`).lean();
    const keys = new Map(questionDocs.map((question) => [String(question._id), question]));
    if (selected.some((item) => !keys.has(String(item.question)))) return res.status(400).json({ message: "This test has unavailable questions. Please contact support." });
    const orderedQuestions = require("../services/scenarioOrder").groupScenarioQuestions(selected, questionDocs);
    const totalMarks = orderedQuestions.reduce((sum, item) => sum + Number(item.marks ?? keys.get(String(item.question)).marks ?? 1), 0);
    const answers = orderedQuestions.map((item) => {
        const optionKeys = assessment.shuffleOptions ? (keys.get(String(item.question)).options || []).map(option => option.key) : [];
        return {
            question: item.question,
            marksAwarded: 0,
            skipped: false,
            flaggedForReview: false,
            ...(optionKeys.length > 1 ? { optionOrder: shuffled(optionKeys) } : {}),
        };
    });

    const attempt = await AssessmentAttempt.create({
        student: req.student._id,
        assessment: assessment._id,
        answers,
        totalMarks,
        isPartialPractice,
        startedAt: now,
        expiresAt,
        passingMarksSnapshot: isPartialPractice ? Math.ceil(totalMarks * (assessment.totalMarks > 0 ? assessment.passingMarks / assessment.totalMarks : 0.4)) : assessment.passingMarks,
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
            select: "title type durationMinutes totalMarks passingMarks instructions showCorrectAnswers showResultImmediately",
        })
        .populate({
            path: "answers.question",
            select: attemptSelect(req),
            populate: { path: "scenario", select: "title scenarioText contentLanguage" },
        })
        .lean();

    if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
    attempt.answers.forEach(orderOptions);
    if (attempt.status !== "in_progress" && resultsWithheld(attempt.assessment)) withholdScores(attempt);
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

async function answersSentWithSubmit(attempt, answers, receivedAt) {
    if (answers === undefined) return {};
    if (!Array.isArray(answers) || answers.length > attempt.answers.length) return { error: "Send each answer at most once." };
    // Choices that reach the server after the time limit do not count, as with single saves.
    if (new Date(attempt.expiresAt) <= receivedAt) return {};
    const byQuestion = new Map(attempt.answers.map((answer) => [String(answer.question), answer]));
    const chosen = answers.filter((item) => typeof item?.selectedOption === "string" && item.selectedOption);
    const options = new Map((await Question.find({ _id: { $in: chosen.map((item) => String(item.question)).filter((questionId) => byQuestion.has(questionId)) } }).select("options.key").lean())
        .map((question) => [String(question._id), new Set(question.options.map((option) => option.key))]));
    for (const item of answers) {
        const answer = byQuestion.get(String(item?.question));
        if (!answer) return { error: "An answer does not belong to this test." };
        if (item.selectedOption !== undefined) {
            if (typeof item.selectedOption !== "string" || (item.selectedOption && !options.get(String(item.question))?.has(item.selectedOption))) return { error: "Choose a valid answer option." };
            answer.selectedOption = item.selectedOption;
            answer.skipped = !item.selectedOption;
            if (item.selectedOption) answer.answeredAt = receivedAt;
        }
        if (item.skipped !== undefined && !item.selectedOption) answer.skipped = Boolean(item.skipped);
        if (item.flaggedForReview !== undefined) answer.flaggedForReview = Boolean(item.flaggedForReview);
    }
    return {};
}

const submitAttempt = async (req, res) => {
    const receivedAt = new Date();
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.id, student: req.student._id }).select("+gradingSnapshot");
    if (!attempt) return res.status(404).json({ message: "Attempt not found." });
    if (attempt.status !== "in_progress") {
        return res.json({ success: true, attempt: { _id: attempt._id } });
    }
    const assessment = await Assessment.findById(attempt.assessment).lean();
    if (!assessment) return res.status(404).json({ message: "Test not found. Please contact support." });
    // Answers the browser could not send yet (a weak connection, or the page closing) arrive with the submit.
    const late = await answersSentWithSubmit(attempt, req.body?.answers, receivedAt);
    if (late.error) return res.status(400).json({ message: late.error });
    const grading = await gradingFor(attempt, assessment);
    const result = gradeAttempt(attempt, grading, attempt.passingMarksSnapshot ?? assessment.passingMarks, receivedAt);
    if (req.body?.autoSubmitted && result.status === "submitted") result.autoSubmitted = true;
    // Only finalize the exact answer revision that was graded.
    const saved = await AssessmentAttempt.findOneAndUpdate({
        _id: attempt._id, student: req.student._id, status: "in_progress", updatedAt: attempt.updatedAt,
    }, { $set: result }, { returnDocument: "after" });
    if (!saved) return res.status(409).json({ message: "Your answers changed while submitting. Please submit again." });
    await LearningActivity.create({
        student: req.student._id, type: "assessment_submitted",
        subject: assessment.subject, chapter: assessment.chapter, topic: assessment.topic,
        metadata: { assessment: assessment._id, attempt: attempt._id, score: result.score, percentage: result.percentage },
    });
    res.json({ success: true, attempt: { _id: saved._id, status: saved.status } });
};

const getResult = async (req, res) => {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.id, student: req.student._id })
        .select("+gradingSnapshot")
        .populate("assessment", "title type board class group subject chapter topic totalMarks passingMarks showCorrectAnswers showResultImmediately")
        .populate({
            path: "answers.question",
            populate: { path: "scenario", select: "title scenarioText contentLanguage" },
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
    attempt.answers.forEach(orderOptions);
    if (resultsWithheld(attempt.assessment)) return res.json({ success: true, attempt: withholdScores(attempt) });
    attempt.percentage = attempt.totalMarks > 0 ? Number((attempt.score / attempt.totalMarks * 100).toFixed(2)) : 0;
    const eligibility = rankEligibility(attempt.assessment, attempt);
    const state = await LeaderboardState.findOne({ key: "global" }).select("resetAt").lean();
    const inCycle = !state?.resetAt || (attempt.submittedAt && attempt.submittedAt >= state.resetAt);
    attempt.ranking = { eligible: eligibility.eligible && inCycle, reason: inCycle ? eligibility.reason : "This result belongs to a previous leaderboard cycle." };
    attempt.points = 0;
    if (attempt.ranking.eligible) {
        // Score this attempt the way the leaderboard does, next to the student's other attempts at the same test.
        // A test this student left unsubmitted earlier is finished first, so the first attempt is the real first.
        await finishExpiredAttempts({ studentId: req.student._id });
        const own = await loadRankableAttempts({ studentId: req.student._id, since: state?.resetAt || null });
        const self = own.find((row) => String(row._id) === String(attempt._id));
        if (self) {
            const note = attemptRankingNote(self, own.filter((row) => row.scopeKey === self.scopeKey));
            attempt.ranking = { eligible: note.counts, reason: note.reason };
            attempt.points = note.score;
        }
    }
    res.json({ success: true, attempt });
};

const getStudentAttempts = async (req, res) => {
    const attempts = await AssessmentAttempt.find({ student: req.student._id })
        .select("-answers")
        .populate("assessment", "title type subject chapter topic showResultImmediately")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    for (const attempt of attempts) if (attempt.status !== "in_progress" && resultsWithheld(attempt.assessment)) withholdScores(attempt);
    res.json({ success: true, attempts });
};

module.exports = {
    previewAttempt,
    startAttempt,
    getAttemptById,
    saveAnswer,
    submitAttempt,
    getResult,
    getStudentAttempts,
    answersSentWithSubmit,
};
