// Keep each passage's questions contiguous, preserving order within each group.
function groupScenarioQuestions(items, questionDocs) {
    const lookup = new Map(questionDocs.map(question => [String(question._id), question]));
    const groups = new Map();
    for (const item of items) {
        const question = lookup.get(String(item.question));
        const key = question?.type === "scenario_mcq" && question.scenario
            ? "scenario:" + String(question.scenario)
            : "question:" + String(item.question);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }
    return [...groups.values()].flat();
}

module.exports = { groupScenarioQuestions };
