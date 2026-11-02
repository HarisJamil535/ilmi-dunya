export const moved = (list, from, to) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };
export const messageOf = (error, fallback) => error?.response?.data?.message || fallback;

// A new, empty part of a question.
export const newPart = () => ({ marks: 1, blocks: [{ type: "text", text: "" }], space: { mode: "none", size: 0 }, answer: [] });
export const totalMarks = (parts) => Math.round(parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0) * 100) / 100;
