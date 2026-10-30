import { useRef } from "react";
import { Droplets, ImagePlus, Type, X } from "lucide-react";
import { Button, input } from "./ui";

const FONT_CHOICES = [
  ["arial", "Arial", "Clean and clear"], ["times", "Times New Roman", "Classic exam look"], ["garamond", "Garamond", "Elegant, bookish"],
  ["calibri", "Calibri", "Modern and soft"], ["cambria", "Cambria", "Sharp serif"], ["poppins", "Poppins", "Bold and modern"],
];
const SIZES = [["small", "Small"], ["normal", "Normal"], ["large", "Large"], ["xl", "Extra large"]];
const SPACING = [["compact", "Compact"], ["normal", "Normal"], ["relaxed", "Relaxed"]];
const TITLES = [["bold", "Bold"], ["underline", "Underlined"], ["boxed", "Boxed"]];
const STRENGTH = [["light", "Light"], ["medium", "Medium"], ["strong", "Strong"]];
const fontKey = (value) => ({ sans: "arial", serif: "times" }[value] || value || "arial");

// A row of equal buttons where one is chosen.
const Segmented = ({ label, value, options, onChange }) => <div>
  <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</span>
  <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{options.map(([key, name]) => <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)} className={`min-h-9 rounded-lg px-3.5 text-sm font-bold transition ${value === key ? "bg-white text-primary-dark shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{name}</button>)}</div>
</div>;

export default function PaperStyle({ layout, setLayout, onUpload, uploading }) {
  const file = useRef(null);
  const mark = layout.watermark || { kind: "none", text: "", imageUrl: "", strength: "light" };
  const setMark = (patch) => setLayout({ watermark: { ...mark, ...patch } });
  const font = fontKey(layout.font);
  return <div className="space-y-6">
    <div>
      <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Font</span>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{FONT_CHOICES.map(([key, name, note]) => <button key={key} type="button" aria-pressed={font === key} onClick={() => setLayout({ font: key })}
        className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${font === key ? "border-primary bg-primary-soft/40" : "border-slate-200 hover:border-primary/40"}`}>
        <span className={`pp-font-${key} grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-xl text-slate-900 shadow-sm`}>Aa</span>
        <span className="min-w-0"><span className={`pp-font-${key} block truncate text-[15px] font-bold text-slate-900`}>{name}</span><span className="block truncate text-xs text-slate-500">{note}</span></span></button>)}</div>
    </div>
    <div className="flex flex-wrap gap-x-8 gap-y-4">
      <Segmented label="Text size" value={layout.fontSize || "normal"} options={SIZES} onChange={(value) => setLayout({ fontSize: value })} />
      <Segmented label="Spacing" value={layout.spacing || "normal"} options={SPACING} onChange={(value) => setLayout({ spacing: value })} />
      <Segmented label="Section titles" value={layout.titleStyle || "bold"} options={TITLES} onChange={(value) => setLayout({ titleStyle: value })} />
    </div>
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-base font-black text-slate-900"><Droplets className="h-5 w-5 text-primary" />Watermark</p>
        <Segmented label="Watermark type" value={mark.kind} options={[["none", "None"], ["text", "Text"], ["image", "Logo"]]} onChange={(kind) => setMark({ kind })} /></div>
      {mark.kind === "text" && <div className="mt-4 flex flex-wrap items-end gap-4"><label className="block min-w-56 flex-1"><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Watermark text</span>
        <span className="relative block"><Type className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${input} pl-9`} maxLength={40} value={mark.text} onChange={(e) => setMark({ text: e.target.value })} placeholder="e.g. CONFIDENTIAL or your school's name" /></span></label></div>}
      {mark.kind === "image" && <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 p-3">
        {mark.imageUrl ? <img src={mark.imageUrl} alt="Watermark" className="h-14 w-14 rounded-lg border border-slate-200 object-contain opacity-60 grayscale" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImagePlus className="h-6 w-6" /></span>}
        <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-800">Watermark logo</p><p className="text-xs text-slate-500">PNG or JPG. It prints pale and grey behind the questions.</p></div>
        <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { onUpload(e.target.files?.[0], (url) => setMark({ imageUrl: url })); e.target.value = ""; }} />
        <Button variant="secondary" loading={uploading} onClick={() => file.current?.click()}>{mark.imageUrl ? "Change" : "Upload"}</Button>
        {mark.imageUrl && <Button variant="ghost" onClick={() => setMark({ imageUrl: "" })} aria-label="Remove watermark logo"><X className="h-4 w-4" /></Button>}
      </div>}
      {mark.kind !== "none" && <div className="mt-4"><Segmented label="Strength" value={mark.strength || "light"} options={STRENGTH} onChange={(strength) => setMark({ strength })} /></div>}
      {mark.kind === "none" && <p className="mt-2 text-sm text-slate-500">Add a faint word such as "Confidential" or your school logo behind every page.</p>}
    </div>
  </div>;
}
