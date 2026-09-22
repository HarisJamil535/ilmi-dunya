const AssessmentAttempt = require("../models/AssessmentAttempt");
const LearningActivity = require("../models/LearningActivity");

const getDashboardSummary = async (req, res) => {
    const attempts = await AssessmentAttempt.find({ student: req.student._id })
        .populate({
            path: "assessment",
            select: "title type subject chapter topic",
            populate: [
                { path: "subject", select: "name" },
                { path: "chapter", select: "name" },
                { path: "topic", select: "name" },
            ],
        })
        .sort({ createdAt: -1 })
        .lean();

    const completed = attempts.filter((attempt) => attempt.status !== "in_progress");
    const inProgress = attempts.filter((attempt) => attempt.status === "in_progress");
    const averageScore = completed.length
        ? Math.round(completed.reduce((sum, attempt) => sum + attempt.percentage, 0) / completed.length)
        : 0;

    const subjectMap = new Map();
    completed.forEach((attempt) => {
        const subjectName = attempt.assessment?.subject?.name || "General";
        const entry = subjectMap.get(subjectName) || { subject: subjectName, attempts: 0, total: 0 };
        entry.attempts += 1;
        entry.total += attempt.percentage;
        subjectMap.set(subjectName, entry);
    });

    const subjectPerformance = Array.from(subjectMap.values()).map((item) => ({
        ...item,
        average: Math.round(item.total / item.attempts),
    }));

    const weakTopics = subjectPerformance.filter((item) => item.average < 60).slice(0, 5);
    const strongTopics = subjectPerformance.filter((item) => item.average >= 80).slice(0, 5);
    const activities = await LearningActivity.find({ student: req.student._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    res.json({
        success: true,
        summary: {
            testsTaken: completed.length,
            averageScore,
            bestScore: completed.reduce((best, attempt) => Math.max(best, attempt.percentage), 0),
            inProgressCount: inProgress.length,
            totalTimeSpentSeconds: completed.reduce((sum, attempt) => sum + (attempt.timeTakenSeconds || 0), 0),
            learningStreak: 0,
        },
        inProgress,
        recentAttempts: attempts.slice(0, 8),
        subjectPerformance,
        weakTopics,
        strongTopics,
        activities,
        student: {
            name: req.student.name,
            email: req.student.email,
            phone: req.student.phone,
            city: req.student.city,
            school: req.student.school,
        },
    });
};

module.exports = { getDashboardSummary };
