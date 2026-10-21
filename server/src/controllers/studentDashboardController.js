const AssessmentAttempt = require("../models/AssessmentAttempt");
const LearningActivity = require("../models/LearningActivity");
const { resultsWithheld, withholdScores } = require("../services/attemptRules");

const pakistanDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" });
const dayKey = value => pakistanDay.format(new Date(value));
const previousDay = key => {
    const date = new Date(`${key}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
};

// Consecutive Pakistan-time days with test activity, ending today or yesterday.
function learningStreak(attempts, now = new Date()) {
    const days = new Set(attempts.flatMap(attempt => [attempt.startedAt, attempt.submittedAt].filter(Boolean).map(dayKey)));
    let day = dayKey(now);
    if (!days.has(day)) day = previousDay(day);
    let streak = 0;
    while (days.has(day)) {
        streak += 1;
        day = previousDay(day);
    }
    return streak;
}

// Groups results by the most specific syllabus area each test covers.
function areaPerformance(attempts) {
    const areas = new Map();
    for (const attempt of attempts) {
        const assessment = attempt.assessment || {};
        const area = assessment.topic || assessment.chapter || assessment.subject;
        if (!area?._id) continue;
        const key = String(area._id);
        const entry = areas.get(key) || {
            name: area.name,
            level: assessment.topic ? "topic" : assessment.chapter ? "chapter" : "subject",
            subject: assessment.subject?.name || "",
            attempts: 0,
            total: 0,
        };
        entry.attempts += 1;
        entry.total += attempt.percentage || 0;
        areas.set(key, entry);
    }
    return [...areas.values()].map(({ total, ...item }) => ({ ...item, average: Math.round(total / item.attempts) }));
}

const getDashboardSummary = async (req, res) => {
    const now = new Date();
    const [attempts, activities] = await Promise.all([
        AssessmentAttempt.find({ student: req.student._id })
            // Answer arrays are not shown here and can be large.
            .select("-answers")
            .populate({
                path: "assessment",
                select: "title type subject chapter topic showResultImmediately",
                populate: [
                    { path: "subject", select: "name" },
                    { path: "chapter", select: "name" },
                    { path: "topic", select: "name" },
                ],
            })
            .sort({ createdAt: -1 })
            .lean(),
        LearningActivity.find({ student: req.student._id }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const finished = attempts.filter((attempt) => attempt.status !== "in_progress");
    const inProgress = attempts.filter((attempt) => attempt.status === "in_progress" && attempt.assessment && new Date(attempt.expiresAt) > now);
    // Scores of withheld tests stay hidden until an admin releases them.
    const completed = finished.filter((attempt) => !resultsWithheld(attempt.assessment));
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

    const areas = areaPerformance(completed);
    const weakTopics = areas.filter((item) => item.average < 60).sort((a, b) => a.average - b.average).slice(0, 5);
    const strongTopics = areas.filter((item) => item.average >= 80).sort((a, b) => b.average - a.average).slice(0, 5);
    const recentAttempts = attempts.slice(0, 8).map((attempt) => (
        attempt.status !== "in_progress" && resultsWithheld(attempt.assessment) ? withholdScores({ ...attempt }) : attempt
    ));

    res.json({
        success: true,
        summary: {
            testsTaken: finished.length,
            averageScore,
            bestScore: completed.reduce((best, attempt) => Math.max(best, attempt.percentage), 0),
            inProgressCount: inProgress.length,
            totalTimeSpentSeconds: finished.reduce((sum, attempt) => sum + (attempt.timeTakenSeconds || 0), 0),
            learningStreak: learningStreak(attempts, now),
        },
        inProgress,
        recentAttempts,
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

module.exports = { getDashboardSummary, learningStreak, areaPerformance };
