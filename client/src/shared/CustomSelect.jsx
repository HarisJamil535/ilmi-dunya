import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const CustomSelect = ({ label, value = "", onChange, options = [], placeholder = "Select an option", disabled = false, id, className = "" }) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return <div ref={ref} className={`relative ${className}`}>
    {label && <label htmlFor={selectId} className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</label>}
    <button id={selectId} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-slate-700 shadow-sm transition hover:border-primary-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50">
      <span className={selected ? "truncate text-slate-800" : "truncate text-slate-400"}>{selected?.label || placeholder}</span>
      <ChevronDown className={`ml-3 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
    </button>
    {open && <div role="listbox" aria-label={label || placeholder} className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/10 animate-in fade-in slide-in-from-top-2">
      <button type="button" role="option" aria-selected={!selected} onClick={() => { onChange(""); setOpen(false); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-primary-soft">{placeholder}</button>
      {options.length ? options.map((option) => <button type="button" role="option" aria-selected={String(option.value) === String(value)} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${String(option.value) === String(value) ? "bg-primary-soft font-bold text-primary-dark" : "text-slate-700 hover:bg-slate-50"}`}><span className="truncate">{option.label}</span>{String(option.value) === String(value) && <Check className="h-4 w-4 shrink-0 text-primary" />}</button>) : <p className="px-3 py-2.5 text-sm text-slate-400">No options available</p>}
    </div>}
  </div>;
};

export default CustomSelect;
