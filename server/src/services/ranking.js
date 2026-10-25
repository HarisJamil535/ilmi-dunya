// IlmiDunya Score: ranks students by how well they know the syllabus, not by how many tests they click through.
//
// 1. Attempt score (0-100): 90% accuracy, plus up to 10 for finishing early when at least 60% is correct.
//    Answering faster than about 3 seconds per question is treated as guessing and scores 0.
// 2. Test score: 60% of the first ranked attempt + 40% of the best ranked attempt. A retake is ranked only
//    12 hours after the previous ranked attempt, and at most 3 attempts per test are ranked.
// 3. Test weight: longer tests count more, up to 20 questions (sqrt(questions / 20), at most 1).
//    For each chapter, either its chapter test or its topic tests count, whichever average is higher,
//    because a chapter test is built from the same questions.
// 4. Skill: weighted average of test scores. With few tests a high average is pulled toward 50% (as if
//    5 more tests at 50%), so a lucky start cannot top the board; a low average is never lifted.
// 5. Activity: 0.6 to 1.0, rising with the number of tests (full at 30), with diminishing returns.
// 6. IlmiDunya Score = 10 x Skill x Activity, out of 1000. Students need 3 counted tests to be ranked.

const RULES = Object.freeze({
    accuracyShare: 90,
    speedShare: 10,
    speedMinAccuracy: 60,
    guessSecondsPerQuestion: 3,
    firstAttemptShare: 0.6,
    maxRankedAttempts: 3,
    retakeGapHours: 12,
    fullWeightQuestions: 20,
    priorScore: 50,
    priorWeight: 5,
    fullActivityTests: 30,
    minTestsToRank: 3,
});

const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function attemptFacts(attempt) {
    const questions = Math.max(0, Number(attempt.questionCount) || 0);
    const accuracy = attempt.totalMarks > 0 ? clamp(Number(attempt.score) / Number(attempt.totalMarks), 0, 1) * 100 : 0;
    const started = new Date(attempt.startedAt).getTime();
    const allowed = Math.max(1, (new Date(attempt.expiresAt).getTime() - started) / 1000);
    const used = clamp(Number(attempt.timeTakenSeconds) || 0, 0, allowed);
    return { questions, accuracy, allowed, used };
}

// One attempt on its own, 0 to 100.
function scoreAttempt(attempt) {
    const { questions, accuracy, allowed, used } = attemptFacts(attempt);
    if (questions > 0 && used / questions < RULES.guessSecondsPerQuestion) return { score: 0, accuracy, guessed: true, used, questions };
    // Finishing in half the allowed time or less earns the full speed share, scaled by how much was right.
    const speed = accuracy >= RULES.speedMinAccuracy ? clamp((1 - used / allowed) / 0.5, 0, 1) : 0;
    const score = accuracy * RULES.accuracyShare / 100 + RULES.speedShare * speed * accuracy / 100;
    return { score: round(score), accuracy, guessed: false, speed, used, questions };
}

// Which attempts of one test count: the first, then retakes at least 12 hours apart, at most 3.
function rankedAttempts(attempts) {
    const sorted = [...attempts].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    const ranked = [];
    for (const attempt of sorted) {
        if (ranked.length >= RULES.maxRankedAttempts) break;
        const last = ranked[ranked.length - 1];
        if (last && new Date(attempt.startedAt) - new Date(last.startedAt) < RULES.retakeGapHours * 3600 * 1000) continue;
        ranked.push(attempt);
    }
    return ranked;
}

// The test's contribution from its ranked attempts.
function scoreTest(attempts) {
    const ranked = rankedAttempts(attempts);
    if (!ranked.length) return null;
    const scored = ranked.map(attempt => ({ attempt, ...scoreAttempt(attempt) }));
    const first = scored[0];
    const best = scored.reduce((top, item) => item.score > top.score ? item : top, first);
    const score = RULES.firstAttemptShare * first.score + (1 - RULES.firstAttemptShare) * best.score;
    const weight = Math.min(1, Math.sqrt(Math.max(first.questions, 1) / RULES.fullWeightQuestions));
    return {
        score: round(score), weight, accuracy: best.accuracy, used: best.used, questions: best.questions,
        lastAt: Math.max(...ranked.map(item => new Date(item.submittedAt).getTime())),
    };
}

const weightedAverage = (tests, key) => {
    const weight = tests.reduce((sum, test) => sum + test.weight, 0);
    return weight ? tests.reduce((sum, test) => sum + test.weight * test[key], 0) / weight : 0;
};

// A chapter test reuses its topics' questions, so per chapter only the better of the two sets counts.
function withoutOverlap(tests) {
    const byChapter = new Map();
    const others = [];
    for (const test of tests) {
        if (test.chapter && (test.type === "chapter_test" || test.type === "topic_test")) {
            const entry = byChapter.get(test.chapter) || { chapter: [], topic: [] };
            entry[test.type === "chapter_test" ? "chapter" : "topic"].push(test);
            byChapter.set(test.chapter, entry);
        } else others.push(test);
    }
    for (const { chapter, topic } of byChapter.values()) {
        if (!chapter.length || !topic.length) { others.push(...chapter, ...topic); continue; }
        others.push(...(weightedAverage(topic, "score") > weightedAverage(chapter, "score") ? topic : chapter));
    }
    return others;
}

// One student's IlmiDunya Score from the tests that count.
function scoreStudent(tests) {
    const counted = withoutOverlap(tests);
    const weight = counted.reduce((sum, test) => sum + test.weight, 0);
    const weighted = counted.reduce((sum, test) => sum + test.weight * test.score, 0);
    // Few tests pull a high average down toward 50%; a low average is never lifted (guessing stays at 0).
    const average = weight ? weighted / weight : 0;
    const prior = Math.min(RULES.priorScore, average);
    const skill = (weighted + RULES.priorWeight * prior) / (weight + RULES.priorWeight);
    const activity = 0.6 + 0.4 * Math.min(1, Math.log(1 + counted.length) / Math.log(1 + RULES.fullActivityTests));
    const questions = counted.reduce((sum, test) => sum + test.questions, 0);
    return {
        points: round(10 * skill * activity, 1),
        skill: round(skill),
        accuracy: round(weightedAverage(counted, "accuracy")),
        testsTaken: counted.length,
        secondsPerQuestion: questions ? round(counted.reduce((sum, test) => sum + test.used, 0) / questions, 1) : 0,
        totalTimeSeconds: round(counted.reduce((sum, test) => sum + test.used, 0), 1),
        reachedAt: counted.length ? Math.max(...counted.map(test => test.lastAt)) : 0,
        ranked: counted.length >= RULES.minTestsToRank && weighted > 0,
    };
}

// Groups attempts by student and test, scores everyone and orders them.
// Each attempt needs: student, scopeKey, type, chapter, score, totalMarks, questionCount, startedAt, expiresAt, submittedAt, timeTakenSeconds.
function buildRanking(attempts) {
    const students = new Map();
    for (const attempt of attempts) {
        const id = String(attempt.student);
        if (!students.has(id)) students.set(id, new Map());
        const tests = students.get(id);
        if (!tests.has(attempt.scopeKey)) tests.set(attempt.scopeKey, []);
        tests.get(attempt.scopeKey).push(attempt);
    }
    const rows = [];
    for (const [student, tests] of students) {
        const scored = [];
        for (const list of tests.values()) {
            const test = scoreTest(list);
            if (test) scored.push({ ...test, type: list[0].type, chapter: list[0].chapter ? String(list[0].chapter) : "" });
        }
        rows.push({ studentId: student, ...scoreStudent(scored) });
    }
    rows.sort((a, b) => b.points - a.points || b.accuracy - a.accuracy || a.secondsPerQuestion - b.secondsPerQuestion || a.reachedAt - b.reachedAt || a.studentId.localeCompare(b.studentId));
    let rank = 0;
    const ranked = rows.filter(row => row.ranked);
    ranked.forEach((row, index) => {
        const previous = ranked[index - 1];
        if (!previous || previous.points !== row.points || previous.accuracy !== row.accuracy || previous.secondsPerQuestion !== row.secondsPerQuestion) rank = index + 1;
        row.rank = rank;
    });
    return { ranked, all: rows };
}

// Why one finished attempt does or does not change the student's ranking, for the result page.
function attemptRankingNote(attempt, sameTestAttempts) {
    const scored = scoreAttempt(attempt);
    const ranked = rankedAttempts(sameTestAttempts);
    const isRanked = ranked.some(item => String(item._id) === String(attempt._id));
    // A rushed attempt still uses its ranked slot, so guessing once to see the answers does not pay off.
    if (scored.guessed) return { counts: isRanked, score: 0, reason: "Answered too quickly (under 3 seconds per question), so this attempt scores 0 for ranking. Take your time on the next one." };
    if (isRanked) {
        const isFirst = String(ranked[0]._id) === String(attempt._id);
        return { counts: true, score: scored.score, reason: isFirst ? "Your first attempt counts most (60%). Retakes after 12 hours can add up to 40% more." : "This retake counts toward your ranking together with your first attempt." };
    }
    if (ranked.length >= RULES.maxRankedAttempts) return { counts: false, score: scored.score, reason: "You have used all 3 ranked attempts for this test. Keep practising; it just will not change your ranking." };
    return { counts: false, score: scored.score, reason: "Retakes count for ranking 12 hours after your last ranked attempt. This one is practice." };
}

module.exports = { RULES, scoreAttempt, rankedAttempts, scoreTest, withoutOverlap, scoreStudent, buildRanking, attemptRankingNote };
