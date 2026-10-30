// Ready-made patterns and starting values for the Paper Maker. Every number can be changed by the teacher.
export const TEMPLATES = [
  { key: "full", title: "Full paper", note: "13 MCQs, 11 short and 4 long, each with OR. Fits 2 pages.", layout: { mode: "single", pages: 2 }, sections: [
    { kind: "mcq", name: "Section A", total: 13, marksEach: 1 },
    { kind: "short", name: "Section B", total: 11, attempt: 11, marksEach: 2, choice: true },
    { kind: "long", name: "Section C", total: 4, attempt: 4, marksEach: 5, choice: true },
  ] },
  { key: "tear", title: "Two groups, one sheet", note: "Groups A and B print on one sheet that tears in half.", layout: { mode: "tear", pages: 0 }, sections: [
    { kind: "mcq", name: "Section A", total: 6, marksEach: 1 },
    { kind: "short", name: "Section B", total: 4, attempt: 4, marksEach: 3, choice: true },
    { kind: "long", name: "Section C", total: 2, attempt: 2, marksEach: 6, choice: true },
  ] },
  { key: "board", title: "Attempt any", note: "30 MCQs, short (attempt 4 of 6) and long (attempt 2 of 3).", layout: { mode: "single", pages: 0 }, sections: [
    { kind: "mcq", name: "Section A", total: 30, marksEach: 0.5 },
    { kind: "short", name: "Section B", total: 6, attempt: 4, marksEach: 3 },
    { kind: "long", name: "Section C", total: 3, attempt: 2, marksEach: 5 },
  ] },
  { key: "test", title: "Class test", note: "10 MCQs and 5 short questions (attempt 4).", layout: { mode: "single", pages: 1 }, sections: [
    { kind: "mcq", name: "Section A", total: 10, marksEach: 1 },
    { kind: "short", name: "Section B", total: 5, attempt: 4, marksEach: 2 },
  ] },
  { key: "mcq", title: "MCQ paper", note: "40 MCQs only.", layout: { mode: "single", pages: 0 }, sections: [
    { kind: "mcq", name: "Section A", total: 40, marksEach: 1 },
  ] },
];

const withIds = (sections) => sections.map((section, index) => ({ id: `S${index + 1}`, ...section, attempt: section.attempt || section.total }));
export const sectionsFromTemplate = (key) => withIds((TEMPLATES.find((item) => item.key === key) || TEMPLATES[0]).sections);
export const templateLayout = (key) => (TEMPLATES.find((item) => item.key === key) || TEMPLATES[0]).layout;

export const newConfig = () => ({
  header: { schoolName: "", logoUrl: "", examName: "", subjectTitle: "", className: "", date: "", timeAllowed: "", timeObjective: "", timeSubjective: "", instructions: [] },
  scope: { board: "", class: "", group: "", subject: "", chapters: [] },
  sections: sectionsFromTemplate("full"),
  layout: { mode: "single", paper: "A4", pages: 2, font: "arial", fontSize: "normal", spacing: "normal", titleStyle: "bold", watermark: { kind: "none", text: "", imageUrl: "", strength: "light" }, bubbles: true, cutLine: "back", subjectiveNewPage: false },
  versions: ["A"],
  options: { importantFirst: true, avoidRepeats: false, difficulty: "mixed" },
});

export const KIND_LABEL = { mcq: "MCQs", short: "Short questions", long: "Long questions" };
export const sectionMarks = (section) => Math.round((section.kind === "mcq" ? section.total : section.attempt) * section.marksEach * 100) / 100;
export const totalMarks = (sections) => Math.round(sections.reduce((sum, section) => sum + sectionMarks(section), 0) * 100) / 100;
export const questionsInSlots = (slots = []) => slots.reduce((sum, slot) => sum + (slot.questions?.length || 0), 0);
