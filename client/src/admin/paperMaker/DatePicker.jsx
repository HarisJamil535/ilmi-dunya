import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const format = (date) => `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
const parse = (text) => { const time = Date.parse(text || ""); return Number.isNaN(time) ? null : new Date(time); };
const same = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// A calendar that opens under the field; the chosen date is stored as readable text such as "14 Jan 2026".
export default function DatePicker({ label, value, onChange, placeholder = "Choose a date" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(value) || new Date());
  const [style, setStyle] = useState(null);
  const button = useRef(null);
  const panel = useRef(null);
  const selected = parse(value);
  const today = new Date();

  const place = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(320, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom;
    const up = below < 360 && rect.top > below;
    return { width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), ...(up ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!button.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    const move = () => setStyle(place());
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    window.addEventListener("resize", move); document.addEventListener("scroll", move, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", move); document.removeEventListener("scroll", move, true); };
  }, [open, place]);

  const toggle = () => { if (!open) { setView(parse(value) || new Date()); setStyle(place()); } setOpen(!open); };
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - lead + i));
  const pick = (date) => { onChange(format(date)); setOpen(false); };
  const shift = (months) => setView(new Date(view.getFullYear(), view.getMonth() + months, 1));

  return <div className="relative">
    {label && <label htmlFor={id} className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</label>}
    <div className="flex">
      <button ref={button} id={id} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={toggle} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold shadow-sm transition hover:border-primary-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" /><span className={`min-w-0 flex-1 truncate ${value ? "text-slate-800" : "text-slate-400"}`}>{value || placeholder}</span>
      </button>
      {value && <button type="button" aria-label="Clear date" onClick={() => onChange("")} className="-ml-9 mr-1 grid h-11 w-8 place-items-center text-slate-400 hover:text-rose-500"><X className="h-4 w-4" /></button>}
    </div>
    {open && style && createPortal(<div ref={panel} role="dialog" aria-label="Choose a date" style={style} className="fixed z-[200] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/15 animate-in fade-in zoom-in-95 slide-in-from-top-2">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-black text-slate-900">{MONTHS[view.getMonth()]} {view.getFullYear()}</p>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-black uppercase text-slate-400">{DAYS.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-0.5">{cells.map((date) => { const inMonth = date.getMonth() === view.getMonth(); const on = same(date, selected); return <button key={date.toISOString()} type="button" aria-label={format(date)} aria-pressed={on} onClick={() => pick(date)}
        className={`h-9 rounded-lg text-sm font-semibold transition ${on ? "bg-primary text-white shadow" : same(date, today) ? "border border-primary text-primary-dark" : inMonth ? "text-slate-800 hover:bg-primary-soft" : "text-slate-300 hover:bg-slate-50"}`}>{date.getDate()}</button>; })}</div>
      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2"><button type="button" onClick={() => pick(today)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary-soft">Today</button><button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Clear</button></div>
    </div>, document.body)}
  </div>;
}
