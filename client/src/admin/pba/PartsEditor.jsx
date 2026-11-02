import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import CustomSelect from "../../shared/CustomSelect";
import { Button, Pill, Stepper, input } from "../paperMaker/ui";
import BlockEditor from "./BlockEditor";
import { newPart, totalMarks } from "./pbaUtils";

const SPACE = [{ value: "none", label: "No answer space" }, { value: "lines", label: "Writing lines" }, { value: "box", label: "Empty box" }];
const letter = (i) => String.fromCharCode(97 + i);

// The parts of a question (a, b, c...), each with its own marks, answer space and model answer.
export default function PartsEditor({ parts, onChange, upload }) {
  const set = (i, patch) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (from, to) => { const next = [...parts]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next); };
  return <div className="space-y-4">
    {parts.map((part, i) => <section key={i} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4" aria-label={`Part ${letter(i)}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-black text-white">{letter(i)}</span>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600">Marks<Stepper label={`marks for part ${letter(i)}`} value={Number(part.marks) || 0} min={0} max={50} step={0.5} onChange={(value) => set(i, { marks: value })} /></label>
        <div className="flex items-center gap-2"><div className="w-44"><CustomSelect value={part.space.mode} allowClear={false} onChange={(mode) => set(i, { space: { mode, size: mode === "none" ? 0 : part.space.size || (mode === "box" ? 8 : 5) } })} options={SPACE} /></div>
          {part.space.mode !== "none" && <label className="flex items-center gap-2 text-xs font-bold text-slate-500">{part.space.mode === "box" ? "Height" : "Lines"}<input type="number" min="1" max="30" className={`${input} w-20`} value={part.space.size} onChange={(e) => set(i, { space: { ...part.space, size: Math.min(30, Math.max(1, Number(e.target.value) || 1)) } })} aria-label="Answer space size" /></label>}</div>
        <span className="ml-auto flex"><button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move part ${letter(i)} up`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" disabled={i === parts.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move part ${letter(i)} down`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" onClick={() => onChange(parts.filter((_, j) => j !== i))} aria-label={`Delete part ${letter(i)}`} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></span>
      </div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">What the student reads</p>
      <BlockEditor blocks={part.blocks} onChange={(blocks) => set(i, { blocks })} upload={upload} label={`part ${letter(i)}`} />
      <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3" open={part.answer.length > 0}>
        <summary className="cursor-pointer text-sm font-black text-slate-700">Model answer for the answer key {part.answer.length > 0 && <Pill tone="green">added</Pill>}</summary>
        <div className="mt-3"><BlockEditor blocks={part.answer} onChange={(answer) => set(i, { answer })} upload={upload} label={`answer of part ${letter(i)}`} /></div>
      </details>
    </section>)}
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" icon={Plus} disabled={parts.length >= 12} onClick={() => onChange([...parts, newPart()])}>Add part {letter(parts.length)}</Button>{parts.length > 0 && <Pill tone="violet">Total {totalMarks(parts)} marks</Pill>}</div>
  </div>;
}
