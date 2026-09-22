const { test } = require("node:test");
const assert = require("node:assert/strict");
const { groupScenarioQuestions } = require("../src/services/scenarioOrder");

test("groups multiple scenarios without dropping questions or changing their marks", () => {
    const docs = [
        { _id: "1", type: "scenario_mcq", scenario: "a" },
        { _id: "2", type: "standard_mcq" },
        { _id: "3", type: "scenario_mcq", scenario: "b" },
        { _id: "4", type: "scenario_mcq", scenario: "a" },
        { _id: "5", type: "scenario_mcq", scenario: "b" },
        { _id: "6", type: "scenario_mcq", scenario: "a" },
    ];
    const items = docs.map(doc => ({ question: doc._id, marks: 2 }));
    const ordered = groupScenarioQuestions(items, docs);
    assert.deepEqual(ordered.map(item => item.question), ["1", "4", "6", "2", "3", "5"]);
    assert.equal(ordered.reduce((sum, item) => sum + item.marks, 0), 12);
    assert.deepEqual(items.map(item => item.question), ["1", "2", "3", "4", "5", "6"]);
});

test("one scenario may contain any number of linked questions", () => {
    for (const count of [1, 4, 5, 20]) {
        const docs = Array.from({ length: count }, (_, i) => ({ _id: String(i), type: "scenario_mcq", scenario: "shared" }));
        const items = docs.map(doc => ({ question: doc._id }));
        assert.deepEqual(groupScenarioQuestions(items, docs), items);
    }
});
