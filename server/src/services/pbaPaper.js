// PBA (practical based assessment) papers: sections of questions, each question made of parts with marks.
// Pure code like the other paper engine, so it is easy to test; the controller supplies the practicals.
const mongoose = require("mongoose");
const { fail } = require("./publishing");
const { rng, shuffled, styleOf } = require("./paperEngine");

const VERSION_LETTERS = ["A", "B", "C", "D"];
const CANDIDATE_FIELDS = ["Candidate Name", "Class & Section", "School Name", "Date", "Sign of Invigilator"];
const MAX_SECTIONS = 6;
const MAX_SLOTS = 12;
const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const validId = value => mongoose.isValidObjectId(value);
const idOf = value => String(value?._id || value || "");
const round = value => Math.round(value * 100) / 100;
const letter = index => String.fromCharCode(97 + index);
const isCustom = id => /^c_[a-z0-9]{4,16}$/.test(String(id));

function normalizePbaConfig(input = {}) {
    const header = input.header || {};
    const sectionsIn = Array.isArray(input.sections) ? input.sections : [];
    if (!sectionsIn.length) fail("Add at least one section to the paper.");
    if (sectionsIn.length > MAX_SECTIONS) fail(`A paper can have at most ${MAX_SECTIONS} sections.`);
    const ids = list => (Array.isArray(list) ? list : []).filter(validId).map(idOf).slice(0, 12);
    const sections = sectionsIn.map((section, index) => {
        const slotsIn = Array.isArray(section.slots) ? section.slots : [];
        if (!slotsIn.length) fail(`Section ${index + 1} needs at least one question.`);
        if (slotsIn.length > MAX_SLOTS) fail(`A section can have at most ${MAX_SLOTS} questions.`);
        return {
            id: text(section.id, 12) || `S${index + 1}`,
            name: text(section.name, 40) || `SECTION-${String.fromCharCode(65 + index)}`,
            note: text(section.note, 200),
            slots: slotsIn.map((slot, i) => ({ id: text(slot.id, 12) || `Q${index + 1}${i + 1}`, topics: ids(slot.topics), categories: ids(slot.categories) })),
        };
    });
    if (new Set(sections.map(section => section.id)).size !== sections.length) fail("Each section needs its own id.");
    const scope = input.scope || {};
    if (!validId(scope.subject) || !validId(scope.board) || !validId(scope.class)) fail("Choose the board, class and subject.");
    const versions = [...new Set((Array.isArray(input.versions) ? input.versions : ["A"]).map(value => String(value).toUpperCase()).filter(value => VERSION_LETTERS.includes(value)))].sort();
    const fields = (Array.isArray(header.candidateFields) ? header.candidateFields : CANDIDATE_FIELDS).map(value => text(value, 40)).filter(Boolean).slice(0, 8);
    const layout = input.layout || {};
    return {
        kind: "pba",
        header: {
            schoolName: text(header.schoolName, 120), logoUrl: /^\/api\/media\/images\/[a-f\d]{24}$/.test(header.logoUrl || "") ? header.logoUrl : "",
            examName: text(header.examName, 120), paperTitle: text(header.paperTitle, 120), session: text(header.session, 60), date: text(header.date, 40),
            timeAllowed: text(header.timeAllowed, 40), className: text(header.className, 60), subjectTitle: text(header.subjectTitle, 100), note: text(header.note, 300),
            candidateFields: fields,
        },
        scope: { board: idOf(scope.board), class: idOf(scope.class), group: validId(scope.group) ? idOf(scope.group) : "", subject: idOf(scope.subject) },
        sections,
        layout: { ...styleOf(layout), rollNumber: layout.rollNumber !== false, rollDigits: Math.min(Math.max(Number(layout.rollDigits) || 7, 4), 10), spaceMode: layout.spaceMode === "none" ? "none" : "practical" },
        versions: versions.length ? versions : ["A"],
        options: { avoidRepeats: Boolean(input.options?.avoidRepeats), targetMarks: Math.min(Math.max(Number(input.options?.targetMarks) || 0, 0), 500) },
    };
}

const hasContent = practical => Boolean(practical?.parts?.length || practical?.blocks?.length);
const matches = (slot, practical) => (!slot.topics.length || slot.topics.includes(idOf(practical.topic))) && (!slot.categories.length || slot.categories.includes(idOf(practical.category)));

// Picks a practical for every question slot. Slots in `keep` (chosen by hand or written by the teacher) stay as they are.
function generatePbaSelection(config, practicals, { seed = "pba", exclude = new Set(), keep = {} } = {}) {
    const random = rng(seed);
    const used = new Set([...exclude].map(String));
    const selection = {};
    const warnings = [];
    for (const section of config.sections) {
        for (const kept of keep[section.id] || []) if (kept?.id) used.add(String(kept.id));
    }
    for (const section of config.sections) {
        selection[section.id] = section.slots.map((slot, index) => {
            const kept = keep[section.id]?.[index];
            if (kept?.id) return kept;
            const pool = shuffled(practicals.filter(practical => hasContent(practical) && matches(slot, practical) && !used.has(idOf(practical))), random);
            if (!pool.length) {
                warnings.push({ sectionId: section.id, message: `${section.name}, question ${index + 1}: no practical with a written question matches. Add one in Prepare PBA, or relax the topic and category.` });
                return null;
            }
            used.add(idOf(pool[0]));
            return { id: idOf(pool[0]) };
        });
    }
    return { selection, warnings };
}

// The selection for one version: version A is the saved one; the others pick different practicals where they can.
function selectionForVersion(config, selection, practicals, letterOfVersion, seed) {
    if (letterOfVersion === config.versions[0]) return selection;
    const earlier = new Set();
    for (const entries of Object.values(selection)) for (const entry of entries || []) if (entry?.id) earlier.add(String(entry.id));
    const keep = {};
    for (const [sectionId, entries] of Object.entries(selection)) keep[sectionId] = (entries || []).map(entry => (entry && isCustom(entry.id) ? entry : null));
    const exclude = new Set([...earlier].filter(id => !isCustom(id)));
    const fresh = generatePbaSelection(config, practicals, { seed: `${seed}:${letterOfVersion}`, exclude, keep }).selection;
    // A slot that ran out of new practicals falls back to the saved one.
    for (const section of config.sections) fresh[section.id] = fresh[section.id].map((entry, i) => entry || selection[section.id]?.[i] || null);
    return fresh;
}

function buildPbaPaper(config, selection, byId, letterOfVersion = "A") {
    let number = 0;
    let missing = 0;
    const sections = config.sections.map(section => {
        const questions = [];
        section.slots.forEach((slot, index) => {
            const entry = selection[section.id]?.[index];
            const practical = entry && byId.get(String(entry.id));
            if (!practical) { missing += 1; return; }
            number += 1;
            const parts = (practical.parts || []).map((part, i) => ({
                label: letter(i), marks: Number.isFinite(Number(entry.partMarks?.[i])) ? Number(entry.partMarks[i]) : part.marks,
                blocks: part.blocks || [], space: config.layout.spaceMode === "none" ? { mode: "none", size: 0 } : (part.space || { mode: "none", size: 0 }), answer: part.answer || [],
            }));
            questions.push({ id: String(practical._id), number, label: `Q-${number}`, marks: parts.length ? round(parts.reduce((sum, part) => sum + part.marks, 0)) : round(Number(entry.marks ?? practical.marks) || 0), stem: practical.blocks || [], parts });
        });
        const total = round(questions.reduce((sum, question) => sum + question.marks, 0));
        const same = questions.length > 1 && questions.every(question => question.marks === questions[0].marks);
        const line = same ? `[${questions.length}×${questions[0].marks}=${total} marks]` : `[${total} marks]`;
        return { id: section.id, name: section.name, note: section.note, title: `${section.name} ${line}`, marks: total, questions };
    });
    return { kind: "pba", version: letterOfVersion, versionCount: config.versions.length, header: config.header, layout: config.layout, totalMarks: round(sections.reduce((sum, section) => sum + section.marks, 0)), sections, missing };
}

module.exports = { VERSION_LETTERS, CANDIDATE_FIELDS, normalizePbaConfig, generatePbaSelection, selectionForVersion, buildPbaPaper, hasContent, isCustom, idOf };
