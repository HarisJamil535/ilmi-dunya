const round = (value, precision = 2) => Number(value.toFixed(precision));

function gradeAttempt(attempt, grading, passingMarks, now = new Date()) {
    const keys = new Map(grading.map((item) => [String(item.question), item]));
    let score = 0;
    let totalMarks = 0;
    const answers = attempt.answers.map((original) => {
        const answer = original.toObject ? original.toObject() : { ...original };
        const key = keys.get(String(answer.question));
        if (!key) throw new Error("A question is unavailable for grading. Please contact support.");
        const marks = Math.max(Number(key.marks ?? 1), 0);
        const isCorrect = Boolean(answer.selectedOption && answer.selectedOption === key.correctOption);
        totalMarks += marks;
        score += isCorrect ? marks : 0;
        return { ...answer, isCorrect, skipped: !answer.selectedOption, marksAwarded: isCorrect ? marks : 0 };
    });
    score = round(score, 6);
    totalMarks = round(totalMarks, 6);
    const expired = now.getTime() >= new Date(attempt.expiresAt).getTime();
    const finishedAt = Math.min(now.getTime(), new Date(attempt.expiresAt).getTime());
    return {
        answers, score, totalMarks,
        percentage: totalMarks > 0 ? round(score / totalMarks * 100) : 0,
        passStatus: score >= passingMarks ? "pass" : "fail",
        timeTakenSeconds: Math.max(0, (finishedAt - new Date(attempt.startedAt).getTime()) / 1000),
        submittedAt: new Date(finishedAt),
        status: expired ? "timed_out" : "submitted",
        autoSubmitted: expired,
    };
}

module.exports = { gradeAttempt };
