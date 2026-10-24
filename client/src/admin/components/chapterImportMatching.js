// Matches Excel file names like "2.3 MCQs.xlsx" or "Topic 2-3 short.xlsx" to a chapter's topics.

export const IMPORT_KINDS = [
  { value: "standard_mcq", label: "MCQs" },
  { value: "scenario_mcq", label: "Scenario MCQs" },
  { value: "short_question", label: "Short questions" },
  { value: "long_question", label: "Long questions" },
];

export const isWrittenKind = (kind) => kind === "short_question" || kind === "long_question";

// "02.03" -> "2.3", "2-3" -> "2.3", "Topic 2.3." -> "2.3"
export const normalizeNumber = (value) => String(value ?? "")
  .trim()
  .replace(/^(topic|t)\s*/i, "")
  .replace(/\s*[.\-_]\s*/g, ".")
  .replace(/\.+$/, "")
  .split(".")
  .map((part) => (/^\d+$/.test(part) ? String(Number(part)) : part.toLowerCase()))
  .join(".");

const plain = (value) => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const baseName = (fileName) => String(fileName || "").replace(/\.[^.]+$/, "");

// Every number in the name, longest (most specific) first: "Ch 2 topic 2.3" -> ["2.3", "2"].
const numbersIn = (name) => [...name.matchAll(/\d+(?:\s*[.\-_]\s*\d+)*/g)]
  .map((match) => normalizeNumber(match[0]))
  .sort((a, b) => b.split(".").length - a.split(".").length);

export function matchTopic(fileName, topics, chapterNumber) {
  const name = baseName(fileName);
  const byNumber = new Map(topics.map((topic) => [normalizeNumber(topic.topicNumber), topic]));
  for (const number of numbersIn(name)) {
    const found = byNumber.get(number) || (chapterNumber ? byNumber.get(`${normalizeNumber(chapterNumber)}.${number}`) : null);
    if (found) return found;
  }
  const text = ` ${plain(name)} `;
  return [...topics]
    .sort((a, b) => plain(b.name).length - plain(a.name).length)
    .find((topic) => plain(topic.name).length > 2 && text.includes(` ${plain(topic.name)} `)) || null;
}

// The question type is read from words in the file name, falling back to the chosen default.
export function detectKind(fileName, fallback) {
  const words = ` ${plain(baseName(fileName))} `;
  if (/ scenario| case stud/.test(words)) return "scenario_mcq";
  if (/ (short|sq|sqs)( |$)/.test(words)) return "short_question";
  if (/ (long|lq|lqs)( |$)/.test(words)) return "long_question";
  if (/ (mcq|mcqs|objective)( |$)/.test(words)) return "standard_mcq";
  return fallback;
}
