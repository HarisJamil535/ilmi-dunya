const { randomInt } = require("node:crypto");

const supportsSelection = assessment => ["topic_test", "chapter_test"].includes(assessment.type);

function resolveQuestionCount(requested, total) {
    if (requested === undefined || requested === "all") return total;
    if (!Number.isInteger(requested) || requested < Math.min(5, total) || requested > total || requested <= 0) {
        throw Object.assign(new Error(`Choose a whole number from ${Math.min(5, total)} to ${total}, or all questions.`), { status: 400 });
    }
    return requested;
}

// Unbiased Fisher-Yates shuffle that returns a new array.
function shuffled(items, random = randomInt) {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = random(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

function selectQuestions(questions, count, previousIds = [], random = randomInt) {
    if (count === questions.length) return [...questions];
    const pool = shuffled(questions, random);
    const chosen = pool.slice(0, count);
    const previous = new Set(previousIds.map(String));
    // Avoid an identical consecutive subset, while allowing questions to recur.
    if (previous.size === count && chosen.every(item => previous.has(String(item.question)))) {
        const replacement = pool.slice(count).find(item => !previous.has(String(item.question)));
        if (replacement) chosen[random(count)] = replacement;
    }
    return chosen.map((item, index) => ({ ...item, order: index + 1 }));
}

module.exports = { supportsSelection, resolveQuestionCount, selectQuestions, shuffled };
