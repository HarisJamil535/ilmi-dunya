import { useState } from "react";
import { ChevronDown, Type } from "lucide-react";

// A small font menu for the toolbar. Each font name is shown in its own font. `keepFocus` keeps the text
// selection in the box being edited (used for "font for selected text").
export default function FontPicker({ label, fonts = [], value, onPick, keepFocus = false }) {
  const [open, setOpen] = useState(false);
  const current = fonts.find((f) => f.key === value);
  const hold = keepFocus ? (e) => e.preventDefault() : undefined;
  return <div className="relative">
    <button type="button" title={label} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onMouseDown={hold} onClick={() => setOpen(!open)} className="ce-text-btn ce-font">
      <Type className="h-4 w-4" /><span className={`truncate ff-${value || "arial"}`}>{current ? current.label : keepFocus ? "Font" : "Page font"}</span><ChevronDown className="h-3.5 w-3.5 opacity-60" />
    </button>
    {open && <>
      <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onMouseDown={hold} onClick={() => setOpen(false)} />
      <div role="listbox" aria-label={label} className="ce-menu !left-0 !right-auto z-40 w-56" onMouseDown={hold}>
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        {fonts.map((f) => <button key={f.key} type="button" role="option" aria-selected={f.key === value} onClick={() => { onPick(f.key); setOpen(false); }} className={f.key === value ? "!bg-primary-soft !text-primary-dark" : ""}><span className={`ff-${f.key} text-[15px]`}>{f.label}</span></button>)}
      </div>
    </>}
  </div>;
}
