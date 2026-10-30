import { Scale } from "lucide-react";
import { Button, Pill, Stepper } from "./ui";

const KINDS = [["mcq", "MCQs"], ["short", "Short"], ["long", "Long"]];

import { requiredFor } from "./planMath";

export default function ChapterPlan({ sections, chosen, chapters, onQuota, onSpread, onClear }) {
  const need = requiredFor(sections);
  const kinds = KINDS.filter(([k]) => need[k] > 0);
  const manual = chosen.some((c) => Object.keys(c.quota || {}).length);
  const given = (k) => chosen.reduce((sum, c) => sum + (c.quota?.[k] ?? 0), 0);
  const find = (id) => chapters.find((c) => c._id === id);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" icon={Scale} onClick={onSpread}>Spread evenly</Button>
      {manual && <Button variant="ghost" onClick={onClear}>Back to automatic</Button>}
      <p className="text-xs text-slate-500">{manual ? "You are setting how many questions each chapter gives." : "Automatic: chapters share the questions fairly. Set numbers to take control."}</p>
    </div>
    {manual && <div className="flex flex-wrap gap-2">{kinds.map(([k, label]) => <Pill key={k} tone={given(k) === need[k] ? "green" : "amber"}>{label}: {given(k)} of {need[k]}</Pill>)}</div>}
    <div className="grid gap-3 lg:grid-cols-2">{chosen.map((item) => { const ch = find(item.chapter); if (!ch) return null; return <div key={item.chapter} className="rounded-2xl border border-slate-200 p-3.5">
      <p className="text-sm font-black text-slate-900">Chapter {ch.chapterNumber}: {ch.name}</p>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2.5">{kinds.map(([k, label]) => <div key={k}><span className="mb-1 block text-[11px] font-bold text-slate-500">{label} <span className="text-slate-400">(of {ch.counts[k]})</span></span>
        <Stepper label={`${label} from chapter ${ch.chapterNumber}`} value={item.quota?.[k] ?? 0} min={0} max={Math.min(100, ch.counts[k])} onChange={(value) => onQuota(item.chapter, k, value)} /></div>)}</div>
    </div>; })}</div>
  </div>;
}
