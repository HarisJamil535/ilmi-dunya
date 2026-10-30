import { useState } from "react";
import { PenLine, X } from "lucide-react";
import CustomSelect from "../../shared/CustomSelect";
import { Button, Field, input } from "./ui";

const newId = () => `c_${Math.random().toString(36).slice(2, 10)}`;
const TYPE = { mcq: "mcq", short: "short_question", long: "long_question" };

// A question the teacher writes for this paper only; it is saved with the paper and never enters the question bank.
export default function CustomQuestionModal({ section, chapters, existing, onClose, onSave }) {
  const [text, setText] = useState(existing?.questionText || "");
  const [options, setOptions] = useState(existing?.options?.map((o) => o.text) || ["", "", "", ""]);
  const [correct, setCorrect] = useState(existing?.correctOption || "A");
  const [chapter, setChapter] = useState(existing?.chapter || "");
  const [error, setError] = useState("");
  const isMcq = section.kind === "mcq";

  const save = () => {
    if (!text.trim()) return setError("Write the question first.");
    if (isMcq && options.some((o) => !o.trim())) return setError("Fill in all four options.");
    onSave({
      _id: existing?._id || newId(), contentType: TYPE[section.kind], questionText: text.trim(), chapter, isCustom: true,
      ...(isMcq ? { options: options.map((value, i) => ({ key: String.fromCharCode(65 + i), text: value.trim() })), correctOption: correct } : { options: [] }),
    });
  };

  return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Write your own question" onKeyDown={(e) => e.key === "Escape" && onClose()}>
    <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><PenLine className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-slate-900">{existing ? "Edit your question" : "Write your own question"}</h2><p className="text-sm text-slate-500">For {section.name} only. It is saved with this paper, not in the question bank.</p></div></div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="Question"><textarea autoFocus className={`${input} min-h-24 py-2`} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} placeholder={isMcq ? "e.g. Which unit measures electric current?" : "Type the question"} /></Field>
        {isMcq && <div className="space-y-2.5"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Options (tap the circle for the correct one)</p>
          {options.map((value, i) => { const key = String.fromCharCode(65 + i); return <div key={key} className="flex items-center gap-2.5">
            <button type="button" role="radio" aria-checked={correct === key} aria-label={`Option ${key} is correct`} onClick={() => setCorrect(key)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-sm font-black transition ${correct === key ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-500 hover:border-primary"}`}>{key}</button>
            <input className={input} value={value} maxLength={300} onChange={(e) => setOptions((list) => list.map((o, j) => (j === i ? e.target.value : o)))} placeholder={`Option ${key}`} aria-label={`Option ${key}`} /></div>; })}</div>}
        {chapters.length > 0 && <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Chapter (optional, for the chapter summary)</span>
          <CustomSelect value={chapter} onChange={setChapter} placeholder="No chapter" options={chapters.map((c) => ({ value: c._id, label: `Chapter ${c.chapterNumber}: ${c.name}` }))} /></div>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{existing ? "Save changes" : "Add to paper"}</Button></div>
    </div>
  </div>;
}
