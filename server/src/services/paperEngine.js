// Question-paper engine: validates a pattern, picks questions, makes shuffled versions, and builds the paper and answer key.
// Everything here is pure (no database), so it is easy to test; the controller supplies the question bank.
const mongoose = require("mongoose");
const { fail } = require("./publishing");

const KINDS = ["mcq", "short", "long"];
const VERSION_LETTERS = ["A", "B", "C", "D"];
const MAX_SECTIONS = 8;
const MAX_QUESTIONS = 100;
const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const clean = (value, max) => String(value ?? "").replace(/\r/g, "").trim().slice(0, max);
const idOf = value => String(value?._id || value || "");
const validId = value => mongoose.isValidObjectId(value);
const round = value => Math.round(value * 100) / 100;

// Seeded random numbers, so the same paper and version always come out the same.
function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
}
function rng(seed) {
    let state = hashSeed(seed) || 1;
    return () => {
        state += 0x6D2B79F5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffled(list, random) {
    const items = [...list];
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

// Formulas are written with $...$ in the bank; a paper prints them as readable plain text.
function plainMath(value) {
    return String(value ?? "")
        .replace(/\$\$([\s\S]+?)\$\$/g, "$1").replace(/\$([^$\n]+?)\$/g, "$1")
        .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)").replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
        .replace(/\\times/g, "×").replace(/\\div/g, "÷").replace(/\\cdot/g, "·").replace(/\\pm/g, "±").replace(/\\pi/g, "π").replace(/\\theta/g, "θ")
        .replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\lambda/g, "λ").replace(/\\mu/g, "μ").replace(/\\Delta/g, "Δ").replace(/\\omega/g, "ω")
        .replace(/\\leq?/g, "≤").replace(/\\geq?/g, "≥").replace(/\\neq/g, "≠").replace(/\\approx/g, "≈").replace(/\\infty/g, "∞").replace(/\\circ/g, "°")
        .replace(/\\rightarrow|\\to/g, "→").replace(/\\left|\\right/g, "").replace(/\\,|\\;|\\ /g, " ")
        .replace(/\^\{([^{}]*)\}/g, "^($1)").replace(/_\{([^{}]*)\}/g, "_($1)").replace(/\\([a-zA-Z]+)/g, "$1");
}

// Checks a pattern and returns a clean copy. Throws a 400 with a clear message when something is wrong.
function normalizeConfig(input = {}) {
    const header = input.header || {};
    const sectionsIn = Array.isArray(input.sections) ? input.sections : [];
    if (!sectionsIn.length) fail("Add at least one section to the paper.");
    if (sectionsIn.length > MAX_SECTIONS) fail(`A paper can have at most ${MAX_SECTIONS} sections.`);
    const sections = sectionsIn.map((section, index) => {
        const kind = KINDS.includes(section.kind) ? section.kind : fail(`Choose MCQ, short or long for section ${index + 1}.`);
        const total = Number(section.total);
        if (!Number.isInteger(total) || total < 1 || total > MAX_QUESTIONS) fail(`Section ${index + 1}: use 1 to ${MAX_QUESTIONS} questions.`);
        const choice = kind !== "mcq" && Boolean(section.choice);
        let attempt = total;
        if (kind !== "mcq" && section.attempt !== undefined && section.attempt !== "") {
            attempt = Number(section.attempt);
            if (!Number.isInteger(attempt) || attempt < 1 || attempt > total) fail(`Section ${index + 1}: "attempt" must be between 1 and ${total}.`);
        }
        const marksEach = Number(section.marksEach);
        if (!(marksEach > 0) || marksEach > 100 || Math.round(marksEach * 2) !== marksEach * 2) fail(`Section ${index + 1}: marks per question must be a number like 0.5, 1, 2 or 5.`);
        return {
            id: text(section.id, 12) || `S${index + 1}`, kind,
            name: text(section.name, 40) || `Section ${String.fromCharCode(65 + index)}`,
            heading: text(section.heading, 80) || { mcq: "Multiple Choice Questions", short: "Short Questions", long: "Long Questions" }[kind],
            instructions: clean(section.instructions, 400), total, attempt, marksEach, choice,
            choiceRule: ["different", "same", "any"].includes(section.choiceRule) ? section.choiceRule : "different",
        };
    });
    if (new Set(sections.map(section => section.id)).size !== sections.length) fail("Each section needs its own id.");
    const scope = input.scope || {};
    if (!validId(scope.subject) || !validId(scope.board) || !validId(scope.class)) fail("Choose the board, class and subject.");
    const chapters = (Array.isArray(scope.chapters) ? scope.chapters : []).slice(0, 80).map(item => {
        if (!validId(item.chapter)) fail("A chosen chapter is not valid.");
        const weight = Number(item.weight ?? 1);
        const quota = {};
        for (const kind of KINDS) {
            const value = item.quota?.[kind];
            if (value !== undefined && value !== null && value !== "") quota[kind] = Math.min(Math.max(Math.floor(Number(value)) || 0, 0), MAX_QUESTIONS);
        }
        return { chapter: idOf(item.chapter), weight: weight > 0 && weight <= 100 ? weight : 1, quota, topics: (Array.isArray(item.topics) ? item.topics : []).filter(validId).map(idOf).slice(0, 200) };
    });
    if (!chapters.length) fail("Choose at least one chapter to take questions from.");
    const versions = [...new Set((Array.isArray(input.versions) ? input.versions : ["A"]).map(letter => String(letter).toUpperCase()).filter(letter => VERSION_LETTERS.includes(letter)))];
    const instructions = (Array.isArray(header.instructions) ? header.instructions : String(header.instructions || "").split("\n")).map(line => text(line, 300)).filter(Boolean).slice(0, 10);
    return {
        header: {
            schoolName: text(header.schoolName, 120), logoUrl: /^\/api\/media\/images\/[a-f\d]{24}$/.test(header.logoUrl || "") ? header.logoUrl : "",
            examName: text(header.examName, 120), subjectTitle: text(header.subjectTitle, 100), className: text(header.className, 60), date: text(header.date, 40),
            timeAllowed: text(header.timeAllowed, 40), timeObjective: text(header.timeObjective, 40), timeSubjective: text(header.timeSubjective, 40), paperCode: text(header.paperCode, 40), schemeNote: text(header.schemeNote, 120),
            instructions, showRollBoxes: header.showRollBoxes !== false, rollBoxCount: Math.min(Math.max(Number(header.rollBoxCount) || 7, 4), 12),
            showSignatures: header.showSignatures !== false, footerNote: text(header.footerNote, 120),
        },
        scope: { board: idOf(scope.board), class: idOf(scope.class), group: validId(scope.group) ? idOf(scope.group) : "", subject: idOf(scope.subject), chapters },
        sections,
        layout: {
            mode: input.layout?.mode === "tear" ? "tear" : "single",
            paper: input.layout?.paper === "Letter" ? "Letter" : "A4",
            pages: [0, 1, 2, 3, 4].includes(Number(input.layout?.pages)) ? Number(input.layout.pages) : 0,
            font: input.layout?.font === "serif" ? "serif" : "sans",
            bubbles: input.layout?.bubbles !== false,
            cutLine: ["back", "both", "none"].includes(input.layout?.cutLine) ? input.layout.cutLine : "back",
            subjectiveNewPage: Boolean(input.layout?.subjectiveNewPage),
        },
        versions: input.layout?.mode === "tear" ? ["A", "B"] : versions.length ? versions.sort() : ["A"],
        options: { importantFirst: input.options?.importantFirst !== false, avoidRepeats: Boolean(input.options?.avoidRepeats), difficulty: ["mixed", "easy", "hard"].includes(input.options?.difficulty) ? input.options.difficulty : "mixed" },
    };
}

const sectionMarks = section => round(section.attempt * section.marksEach);
const totalMarks = config => round(config.sections.reduce((sum, section) => sum + sectionMarks(section), 0));

// Shares `total` between groups by weight, never above what each group has (a group's `cap`); leftovers go to groups with room.
function allocate(total, groups) {
    const result = new Map(groups.map(group => [group.key, 0]));
    let left = total;
    let open = groups.filter(group => group.cap > 0);
    while (left > 0 && open.length) {
        const weight = open.reduce((sum, group) => sum + group.weight, 0);
        const shares = open.map(group => ({ group, exact: left * group.weight / weight }));
        let given = 0;
        for (const { group, exact } of shares) {
            const room = group.cap - result.get(group.key);
            const take = Math.min(Math.floor(exact), room);
            result.set(group.key, result.get(group.key) + take);
            given += take;
        }
        let remainder = left - given;
        // Largest fractional parts get the last few.
        for (const { group, exact } of [...shares].sort((a, b) => (b.exact % 1) - (a.exact % 1) || b.group.weight - a.group.weight)) {
            if (remainder <= 0) break;
            if (result.get(group.key) < group.cap) { result.set(group.key, result.get(group.key) + 1); remainder -= 1; given += 1; }
        }
        left -= given;
        open = open.filter(group => result.get(group.key) < group.cap);
        if (!given) break;
    }
    return result;
}

// Picks questions for every section. `bank` holds the questions the teacher may use (already limited to the chosen scope).
// Returns { selection, warnings }; selection[sectionId] is a list of slots.
function generateSelection(config, bank, { seed = "paper", exclude = new Set(), keep = {} } = {}) {
    const random = rng(seed);
    const used = new Set(exclude);
    const selection = {};
    const warnings = [];
    const chapterInfo = new Map(config.scope.chapters.map(item => [item.chapter, item]));
    const inScope = question => {
        const info = chapterInfo.get(idOf(question.chapter));
        return Boolean(info) && (!info.topics.length || info.topics.includes(idOf(question.topic)));
    };
    const pool = bank.filter(inScope);
    const rank = { easy: 0, medium: 1, hard: 2 };
    const order = list => {
        const base = config.options.importantFirst ? [...shuffled(list.filter(q => q.isImportant), random), ...shuffled(list.filter(q => !q.isImportant), random)] : shuffled(list, random);
        if (config.options.difficulty === "mixed") return base;
        const sign = config.options.difficulty === "easy" ? 1 : -1;
        return base.map((q, index) => ({ q, index })).sort((a, b) => sign * ((rank[a.q.difficulty] ?? 1) - (rank[b.q.difficulty] ?? 1)) || a.index - b.index).map(item => item.q);
    };
    // When the teacher set how many questions each chapter gives, those numbers replace the weights and are used up as sections take them.
    const quotaMaps = {};
    for (const kind of KINDS) if (config.scope.chapters.some(item => item.quota?.[kind] !== undefined)) quotaMaps[kind] = new Map(config.scope.chapters.map(item => [item.chapter, item.quota?.[kind] ?? 0]));
    const weightOf = (info, kind) => (quotaMaps[kind] ? quotaMaps[kind].get(info.chapter) ?? 0 : info.weight);
    const consume = (kind, chapter, count) => { if (quotaMaps[kind]) quotaMaps[kind].set(chapter, Math.max(0, (quotaMaps[kind].get(chapter) || 0) - count)); };
    const groupsFor = (kind, capOf) => {
        const groups = [...chapterInfo.values()].map(info => ({ key: info.chapter, weight: weightOf(info, kind), cap: capOf(info.chapter) }));
        return groups.some(group => group.weight > 0 && group.cap > 0) ? groups.filter(group => group.weight > 0) : groups.map(group => ({ ...group, weight: chapterInfo.get(group.key).weight }));
    };

    for (const section of config.sections) {
        // Slots the teacher chose by hand stay; the rest are filled automatically.
        const kept = (keep[section.id] || []).filter(slot => slot?.questions?.length);
        kept.forEach(slot => slot.questions.forEach(id => used.add(idOf(id))));
        if (section.kind === "mcq") {
            const slots = [...kept];
            let have = kept.reduce((sum, slot) => sum + slot.questions.length, 0);
            const candidates = pool.filter(q => q.contentType === "mcq" && !used.has(idOf(q)));
            // A scenario and its questions are one unit and are never split.
            const units = new Map();
            for (const q of candidates) {
                const key = q.scenario ? `s:${idOf(q.scenario)}` : `q:${idOf(q)}`;
                if (!units.has(key)) units.set(key, { key, chapter: idOf(q.chapter), scenario: q.scenario ? idOf(q.scenario) : "", questions: [] });
                units.get(key).questions.push(q);
            }
            const byChapter = new Map();
            for (const unit of units.values()) byChapter.set(unit.chapter, [...(byChapter.get(unit.chapter) || []), unit]);
            const need = section.total - have;
            const quota = allocate(need, groupsFor("mcq", chapter => (byChapter.get(chapter) || []).reduce((sum, unit) => sum + unit.questions.length, 0)));
            const take = (unit, limit) => {
                const questions = unit.scenario ? [...unit.questions].sort((a, b) => idOf(a).localeCompare(idOf(b))) : unit.questions;
                if (questions.length > limit) return false;
                slots.push({ scenario: unit.scenario || "", questions: questions.map(idOf) });
                questions.forEach(q => used.add(idOf(q)));
                consume("mcq", unit.chapter, questions.length);
                have += questions.length;
                return true;
            };
            for (const info of chapterInfo.values()) {
                let target = quota.get(info.chapter) || 0;
                for (const unit of order(byChapter.get(info.chapter) || []).map(unit => unit)) {
                    if (target <= 0) break;
                    if (units.get(unit.key).taken) continue;
                    if (take(unit, target)) { units.get(unit.key).taken = true; target -= unit.questions.length; }
                }
            }
            // Chapters that could not give their share are topped up from the rest.
            if (have < section.total) {
                for (const unit of order([...units.values()].filter(unit => !unit.taken))) {
                    if (have >= section.total) break;
                    if (take(unit, section.total - have)) unit.taken = true;
                }
            }
            if (have < section.total) warnings.push({ sectionId: section.id, message: `${section.name}: only ${have} of ${section.total} MCQs are available in the chosen chapters. Add more chapters or lower the number.` });
            selection[section.id] = slots;
        } else {
            const wantType = section.kind === "short" ? "short_question" : "long_question";
            const per = section.choice ? 2 : 1;
            const rule = section.choice ? section.choiceRule : "any";
            const slots = [...kept];
            const candidates = pool.filter(q => q.contentType === wantType && !used.has(idOf(q)));
            const byChapter = new Map();
            for (const q of candidates) byChapter.set(idOf(q.chapter), [...(byChapter.get(idOf(q.chapter)) || []), q]);
            const need = section.total - slots.length;
            const spread = rule === "different" && chapterInfo.size > 1;
            // Chapters give questions one by one; for "same chapter" pairs they give them two at a time.
            const unit = rule === "same" ? 2 : 1;
            const wanted = need * per;
            const quota = allocate(Math.floor(wanted / unit), groupsFor(section.kind, chapter => Math.floor(Math.min((byChapter.get(chapter) || []).length, spread ? need : Infinity) / unit)));
            const chosen = [];
            for (const info of chapterInfo.values()) {
                const list = order(byChapter.get(info.chapter) || []);
                const count = (quota.get(info.chapter) || 0) * unit;
                chosen.push(...list.splice(0, count));
                consume(section.kind, info.chapter, count);
                byChapter.set(info.chapter, list);
            }
            // Top up from what is left, taking from the chapters with the most questions so pairs can still differ.
            while (chosen.length < wanted) {
                const richest = [...byChapter.entries()].filter(([, list]) => list.length).sort((x, y) => y[1].length - x[1].length)[0];
                if (!richest) break;
                const picked = richest[1].shift();
                chosen.push(picked);
                consume(section.kind, richest[0], 1);
            }
            const groups = [];
            let crossed = 0;
            if (per === 1) chosen.forEach(q => groups.push([q]));
            else if (rule === "different") {
                const pools = new Map();
                for (const q of chosen) pools.set(idOf(q.chapter), [...(pools.get(idOf(q.chapter)) || []), q]);
                const left = () => [...pools.values()].filter(list => list.length);
                // Always pair the two chapters with the most questions left; this keeps every pair apart whenever that is possible.
                while (left().length >= 2) {
                    const [first, second] = shuffled(left(), random).sort((x, y) => y.length - x.length);
                    groups.push(random() < 0.5 ? [first.pop(), second.pop()] : [second.pop(), first.pop()]);
                }
                const rest = left().flat();
                while (rest.length >= 2) { groups.push([rest.pop(), rest.pop()]); crossed += 1; }
            } else if (rule === "same") {
                const pools = new Map();
                for (const q of chosen) pools.set(idOf(q.chapter), [...(pools.get(idOf(q.chapter)) || []), q]);
                const rest = [];
                for (const list of pools.values()) { while (list.length >= 2) groups.push([list.pop(), list.pop()]); rest.push(...list); }
                while (rest.length >= 2) groups.push([rest.pop(), rest.pop()]);
            } else { const mixed = shuffled(chosen, random); while (mixed.length >= 2) groups.push([mixed.pop(), mixed.pop()]); }
            if (crossed) warnings.push({ sectionId: section.id, message: `${section.name}: ${crossed} OR pair${crossed > 1 ? "s" : ""} could not use different chapters. Choose more chapters or give each chapter fewer questions.` });
            for (const group of shuffled(groups, random).slice(0, need)) { slots.push({ questions: group.map(idOf) }); group.forEach(q => used.add(idOf(q))); }
            if (slots.length < section.total) warnings.push({ sectionId: section.id, message: `${section.name}: only ${slots.length} of ${section.total} ${section.kind} questions${section.choice ? " (with choices)" : ""} are available in the chosen chapters.` });
            selection[section.id] = slots;
        }
    }
    return { selection, warnings };
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
const roman = number => ROMAN[number - 1] || String(number);
const WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"];
const words = number => WORDS[number] || String(number);
const titleOf = (section, count) => `${section.name} (Marks ${section.marksEach} x ${count} = ${round(section.marksEach * count)})`;
// The time lines printed in the header: separate times for the objective and subjective parts, or one overall time.
const timeLinesOf = header => {
    const parts = [header.timeObjective && `Objective Time: ${header.timeObjective}`, header.timeSubjective && `Subjective Time: ${header.timeSubjective}`].filter(Boolean);
    return parts.length ? parts : header.timeAllowed ? [`Time Allowed: ${header.timeAllowed}`] : [];
};
const keepsOrder = option => /(all|none|both|neither)\s+of\s+(the\s+)?(above|these)|^(all|none)\b|both\s+[a-d]\s+and\s+[a-d]/i.test(option?.text || "");

// The paper as it will be printed: numbered questions, marks lines and (for MCQs) the answer key.
// The first version keeps the picked order; later versions shuffle MCQ order and options.
function buildPaper(config, selection, questions, letter = "A", { seed = "paper", scenarios = {} } = {}) {
    const byId = new Map(questions.map(q => [idOf(q), q]));
    const random = rng(`${seed}:${letter}`);
    const shuffle = letter !== (config.versions[0] || "A");
    const key = [];
    let missing = 0;
    const sections = config.sections.map(section => {
        const slots = (selection[section.id] || []).map(slot => ({ ...slot, questions: slot.questions.filter(id => byId.has(id)) })).filter(slot => slot.questions.length);
        missing += (selection[section.id] || []).reduce((sum, slot) => sum + slot.questions.length, 0) - slots.reduce((sum, slot) => sum + slot.questions.length, 0);
        const items = [];
        if (section.kind === "mcq") {
            let ordered = slots.map(slot => ({ ...slot, questions: shuffle ? shuffled(slot.questions, random) : slot.questions }));
            if (shuffle) ordered = shuffled(ordered, random);
            let number = 0;
            for (const slot of ordered) {
                if (slot.scenario && slots.length) {
                    const scenario = scenarios[slot.scenario];
                    items.push({ type: "scenario", title: plainMath(scenario?.title || "Scenario"), text: plainMath(scenario?.scenarioText || ""), from: number + 1, to: number + slot.questions.length });
                }
                for (const id of slot.questions) {
                    const q = byId.get(id);
                    number += 1;
                    let options = (q.options || []).map(option => ({ key: option.key, text: plainMath(option.text), correct: option.key === q.correctOption }));
                    if (shuffle && !options.some(keepsOrder)) options = shuffled(options, random);
                    // Options are relabelled A, B, C, D in print order.
                    options = options.map((option, index) => ({ ...option, key: String.fromCharCode(65 + index) }));
                    const answer = options.find(option => option.correct)?.key || "";
                    key.push({ no: number, answer });
                    items.push({ type: "mcq", no: number, text: plainMath(q.questionText), options: options.map(({ key: k, text: t }) => ({ key: k, text: t })), answer, image: q.imageUrls?.[0] || "", important: Boolean(q.isImportant) });
                }
            }
            const prompt = config.layout.bubbles ? `Fill the relevant bubble against each question. Each part carries ${section.marksEach} ${section.marksEach === 1 ? "mark" : "marks"}.` : `Choose the correct option for each question. Each part carries ${section.marksEach} ${section.marksEach === 1 ? "mark" : "marks"}.`;
            return { ...section, marks: sectionMarks(section), title: titleOf(section, section.total), prompt, number: 0, items };
        }
        let writtenSlots = slots;
        if (shuffle) writtenSlots = shuffled(slots, random).map(slot => ({ ...slot, questions: slot.questions.length > 1 && random() < 0.5 ? [...slot.questions].reverse() : slot.questions }));
        writtenSlots.forEach((slot, index) => items.push({ type: "written", no: index + 1, label: section.kind === "short" ? roman(index + 1) : String(index + 1), marks: section.marksEach, alternatives: slot.questions.map(id => ({ text: plainMath(byId.get(id).questionText), important: Boolean(byId.get(id).isImportant) })) }));
        const prompt = section.attempt === section.total ? "Answer all the following questions." : `Answer any ${words(section.attempt)} of the following questions.`;
        return { ...section, marks: sectionMarks(section), title: titleOf(section, section.attempt), prompt, number: 0, items };
    });
    sections.forEach((section, index) => { section.number = index + 1; section.prompt = `Q${index + 1}. ${section.prompt}`; if (section.instructions) section.prompt += ` ${section.instructions}`; });
    return { version: letter, timeLines: timeLinesOf(config.header), versionCount: config.versions.length, header: config.header, layout: config.layout, totalMarks: totalMarks(config), sections, key, missing };
}

module.exports = { normalizeConfig, generateSelection, buildPaper, allocate, plainMath, rng, shuffled, totalMarks, sectionMarks, KINDS, VERSION_LETTERS, MAX_QUESTIONS };
