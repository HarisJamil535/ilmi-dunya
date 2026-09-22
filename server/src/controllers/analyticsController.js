const AssessmentAttempt = require("../models/AssessmentAttempt");

const getAssessmentAnalytics = async (req, res) => {
    const attempts = await AssessmentAttempt.find({
        assessment: req.params.assessmentId,
        status: { $ne: "in_progress" },
    })
        .populate("student", "name email")
        .populate("answers.question", "questionText difficulty")
        .lean();

    const total = attempts.length;
    const averageScore = total
        ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / total)
        : 0;

    const questionStats = new Map();
    attempts.forEach((attempt) => {
        attempt.answers.forEach((answer) => {
            const id = String(answer.question?._id || answer.question);
            const stat = questionStats.get(id) || {
                questionId: id,
                questionText: answer.question?.questionText || "",
                attempts: 0,
                correct: 0,
                skipped: 0,
                flagged: 0,
            };
            stat.attempts += 1;
            if (answer.isCorrect) stat.correct += 1;
            if (answer.skipped || !answer.selectedOption) stat.skipped += 1;
            if (answer.flaggedForReview) stat.flagged += 1;
            questionStats.set(id, stat);
        });
    });

    const questions = Array.from(questionStats.values()).map((stat) => ({
        ...stat,
        accuracy: stat.attempts ? Math.round((stat.correct / stat.attempts) * 100) : 0,
    }));

    res.json({
        success: true,
        summary: {
            attempts: total,
            averageScore,
            completionRate: 100,
            passRate: total ? Math.round((attempts.filter((attempt) => attempt.passStatus === "pass").length / total) * 100) : 0,
            averageTimeSeconds: total ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.timeTakenSeconds, 0) / total) : 0,
        },
        difficultQuestions: questions.sort((a, b) => a.accuracy - b.accuracy).slice(0, 10),
        skippedQuestions: [...questions].sort((a, b) => b.skipped - a.skipped).slice(0, 10),
        students: attempts.map((attempt) => ({
            student: attempt.student,
            score: attempt.score,
            percentage: attempt.percentage,
            passStatus: attempt.passStatus,
            timeTakenSeconds: attempt.timeTakenSeconds,
            submittedAt: attempt.submittedAt,
        })),
    });
};

module.exports = { getAssessmentAnalytics };
