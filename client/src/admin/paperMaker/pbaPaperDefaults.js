// Starting patterns for PBA papers. Every name, count and filter can be changed by the admin or teacher.
const slots = (count, prefix) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i + 1}`, topics: [], categories: [] }));

export const PBA_TEMPLATES = [
  { key: "school", title: "School pattern (APSAC)", note: "Section A: 3 questions of 6 marks. Section B: 3 questions of 4 marks. 30 marks, 2 hours.", sections: [{ id: "S1", name: "SECTION-A", note: "", slots: slots(3, "A") }, { id: "S2", name: "SECTION-B", note: "", slots: slots(3, "B") }], paperNote: "Attempt all questions and write answers within provided spaces on E-Sheet." },
  { key: "fbise", title: "FBISE model paper", note: "One section of 5 questions. 30 marks, 2 hours.", sections: [{ id: "S1", name: "SECTION-A", note: "", slots: slots(5, "A") }], paperNote: "Attempt all questions." },
  { key: "blank", title: "Start empty", note: "One section with one question. Add what you need.", sections: [{ id: "S1", name: "SECTION-A", note: "", slots: slots(1, "A") }], paperNote: "" },
];

export const newPbaConfig = (template = PBA_TEMPLATES[0]) => ({
  kind: "pba",
  header: { schoolName: "", logoUrl: "", examName: "FIRST TERM EXAMINATIONS", paperTitle: "PBA COMPUTER", session: "", date: "", timeAllowed: "2 hours", className: "", subjectTitle: "", note: template.paperNote, candidateFields: ["Candidate Name", "Class & Section", "School Name", "Date", "Sign of Invigilator"] },
  scope: { board: "", class: "", group: "", subject: "" },
  sections: template.sections.map((section) => ({ ...section, slots: section.slots.map((slot) => ({ ...slot })) })),
  layout: { paper: "A4", pages: 0, font: "arial", fontSize: "normal", spacing: "normal", titleStyle: "bold", watermark: { kind: "none", text: "", imageUrl: "", strength: "light" }, rollNumber: true, rollDigits: 7, spaceMode: "practical" },
  versions: ["A"],
  options: { avoidRepeats: false, targetMarks: 30 },
});

export const newCustomId = () => `c_${Math.random().toString(36).slice(2, 10)}`;
export const round = (value) => Math.round(value * 100) / 100;
export const marksOfParts = (parts) => round((parts || []).reduce((sum, part) => sum + (Number(part.marks) || 0), 0));
export const entryMarks = (entry, practical) => (practical?.parts?.length ? round(practical.parts.reduce((sum, part, i) => sum + (Number(entry?.partMarks?.[i] ?? part.marks) || 0), 0)) : Number(practical?.marks) || 0);
