// Shows comment text with "@Name" mentions highlighted (and "you" when it is the reader).
export default function MentionText({ text, people = [], me }) {
  const names = people.map((p) => p.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return text;
  const pattern = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  return String(text).split(pattern).map((part, i) => {
    if (!part.startsWith("@")) return part;
    const person = people.find((p) => `@${p.name}` === part);
    return person ? <span key={i} className={`mention ${person.id === me ? "is-me" : ""}`}>{part}</span> : part;
  });
}
