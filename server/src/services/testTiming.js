const { fail } = require("./publishing");

// A test is timed either per question (seconds for each MCQ) or as one total time in minutes.
const LIMITS = { secondsPerQuestion: [10, 600], minutes: [1, 1440] };
const MIN_ATTEMPT_SECONDS = 30;

const choosesCount = test => ["topic_test", "chapter_test"].includes(test?.type);

// Tests saved before timing could be chosen keep their old behaviour:
// chapter and topic tests one minute per MCQ, every other test its total minutes.
function timingOf(test) {
    const mode = test?.timingMode || (choosesCount(test) ? "per_question" : "total");
    if (mode === "per_question") return { mode, secondsPerQuestion: Number(test?.secondsPerQuestion) || 60 };
    return { mode, minutes: Math.max(1, Number(test?.durationMinutes) || 30) };
}

// Seconds allowed for an attempt of `count` questions out of the test's `available`.
// A total time is shared out when a student picks a shorter set.
function attemptSeconds(test, count, available = test?.questions?.length || count) {
    const timing = timingOf(test);
    const seconds = timing.mode === "per_question"
        ? count * timing.secondsPerQuestion
        : count >= available ? timing.minutes * 60 : Math.ceil(timing.minutes * 60 * count / Math.max(available, 1));
    return Math.max(MIN_ATTEMPT_SECONDS, Math.round(seconds));
}

// The stored fields for a timing chosen by an admin, for a test with `questionCount` questions.
function timingFields(timing, questionCount) {
    if (timing.mode === "per_question") {
        return { $set: { timingMode: "per_question", secondsPerQuestion: timing.secondsPerQuestion, durationMinutes: Math.min(1440, Math.max(1, Math.ceil(questionCount * timing.secondsPerQuestion / 60))) } };
    }
    return { $set: { timingMode: "total", durationMinutes: timing.minutes }, $unset: { secondsPerQuestion: 1 } };
}

// Validates { mode: "per_question", secondsPerQuestion } or { mode: "total", minutes }.
function parseTiming(input) {
    const mode = input?.mode;
    const whole = (value, [min, max], message) => {
        const number = Number(value);
        if (!Number.isInteger(number) || number < min || number > max) fail(message);
        return number;
    };
    if (mode === "per_question") return { mode, secondsPerQuestion: whole(input.secondsPerQuestion, LIMITS.secondsPerQuestion, "Choose 10 to 600 seconds for each MCQ.") };
    if (mode === "total") return { mode, minutes: whole(input.minutes, LIMITS.minutes, "Choose a total time from 1 to 1440 minutes.") };
    return fail("Choose time per question or total time.");
}

const sameTiming = (left, right) => left.mode === right.mode && (left.mode === "per_question" ? left.secondsPerQuestion === right.secondsPerQuestion : left.minutes === right.minutes);

module.exports = { timingOf, attemptSeconds, timingFields, parseTiming, sameTiming, LIMITS };
