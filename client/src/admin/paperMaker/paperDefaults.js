// Ready-made patterns and starting values for the Paper Maker.
export const TEMPLATES = [
  { key: "board", title: "Board style", note: "12 MCQs, 10 short (attempt 7), 5 long (attempt 3)", sections: [
    { kind: "mcq", name: "Section A", heading: "Multiple Choice Questions", total: 12, attempt: 12, marksEach: 1 },
    { kind: "short", name: "Section B", heading: "Short Questions", total: 10, attempt: 7, marksEach: 2 },
    { kind: "long", name: "Section C", heading: "Long Questions", total: 5, attempt: 3, marksEach: 8 },
  ] },
  { key: "choice", title: "With internal choice", note: "20 MCQs, 8 short (attempt 6), 3 long with either / or", sections: [
    { kind: "mcq", name: "Section A", heading: "Multiple Choice Questions", total: 20, attempt: 20, marksEach: 1 },
    { kind: "short", name: "Section B", heading: "Short Questions", total: 8, attempt: 6, marksEach: 2 },
    { kind: "long", name: "Section C", heading: "Long Questions", total: 3, attempt: 3, marksEach: 8, choice: true },
  ] },
  { key: "half", title: "50% MCQs, 50% written", note: "30 MCQs at 0.5 marks, then short and long", sections: [
    { kind: "mcq", name: "Section A", heading: "Multiple Choice Questions", total: 30, attempt: 30, marksEach: 0.5 },
    { kind: "short", name: "Section B", heading: "Short Questions", total: 6, attempt: 5, marksEach: 3 },
    { kind: "long", name: "Section C", heading: "Long Questions", total: 3, attempt: 2, marksEach: 5, choice: true },
  ] },
  { key: "test", title: "Class test", note: "10 MCQs and 5 short questions (attempt 4)", sections: [
    { kind: "mcq", name: "Section A", heading: "Multiple Choice Questions", total: 10, attempt: 10, marksEach: 1 },
    { kind: "short", name: "Section B", heading: "Short Questions", total: 5, attempt: 4, marksEach: 2 },
  ] },
  { key: "mcq", title: "MCQ paper", note: "40 MCQs only", sections: [
    { kind: "mcq", name: "Section A", heading: "Multiple Choice Questions", total: 40, attempt: 40, marksEach: 1 },
  ] },
];

export const DEFAULT_INSTRUCTIONS = [
  "All questions of Section A are compulsory.",
  "Deleting or overwriting is not allowed. Do not use lead pencil.",
  "No extra sheet will be given in any case.",
];

const withIds = (sections) => sections.map((section, index) => ({ id: `S${index + 1}`, ...section, attempt: section.attempt || section.total }));
export const sectionsFromTemplate = (key) => withIds((TEMPLATES.find((item) => item.key === key) || TEMPLATES[0]).sections);

export const newConfig = () => ({
  header: { schoolName: "", logoUrl: "", examName: "", subjectTitle: "", className: "", date: "", timeAllowed: "", paperCode: "", schemeNote: "", instructions: [...DEFAULT_INSTRUCTIONS], showRollBoxes: true, rollBoxCount: 7, showSignatures: true, footerNote: "" },
  scope: { board: "", class: "", group: "", subject: "", chapters: [] },
  sections: sectionsFromTemplate("board"),
  versions: ["A"],
  options: { importantFirst: true, avoidRepeats: false },
});

export const KIND_LABEL = { mcq: "MCQs", short: "Short questions", long: "Long questions" };
export const sectionMarks = (section) => Math.round((section.kind === "mcq" ? section.total : section.attempt) * section.marksEach * 100) / 100;
export const totalMarks = (sections) => Math.round(sections.reduce((sum, section) => sum + sectionMarks(section), 0) * 100) / 100;
export const questionsInSlots = (slots = []) => slots.reduce((sum, slot) => sum + (slot.questions?.length || 0), 0);
