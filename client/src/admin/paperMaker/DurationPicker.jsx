import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, X } from "lucide-react";

const PRESETS = [15, 20, 30, 40, 45, 60, 80, 90, 120, 150, 180];
const HOURS = [0, 1, 2, 3];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// "1 hour 20 mins" style text, as it prints on the paper.
const formatDuration = (total) => {
  const h = Math.floor(total / 60); const m = total % 60;
  return [h ? `${h} hour${h > 1 ? "s" : ""}` : "", m ? `${m} min${m > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
};
const parseDuration = (text) => {
  const value = String(text || "").toLowerCase();
  const h = Number(/(\d+)\s*(h|hour)/.exec(value)?.[1] || 0);
  const m = Number(/(\d+)\s*(m|min)/.exec(value)?.[1] || 0);
  return h * 60 + m;
};

// A field that opens a small panel of common exam lengths plus hour and minute choices.
export default function DurationPicker({ label, value, onChange, placeholder = "Choose the time" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState(null);
  const button = useRef(null);
  const panel = useRef(null);
  const total = parseDuration(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  const place = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(340, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    const up = below < 380 && above > below;
    // Never taller than the room on the chosen side; the panel scrolls inside if the window is very short.
    const maxHeight = Math.max(200, up ? above : below);
    return { width, maxHeight, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), ...(up ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) };
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

  const set = (next) => onChange(next > 0 ? formatDuration(next) : "");
  const chip = (active) => `h-9 rounded-lg text-sm font-bold transition ${active ? "bg-primary text-white shadow" : "bg-slate-50 text-slate-700 hover:bg-primary-soft"}`;
  return <div className="relative">
    {label && <label htmlFor={id} className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</label>}
    <div className="flex">
      <button ref={button} id={id} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setStyle(place()); setOpen(!open); }} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold shadow-sm transition hover:border-primary-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <Clock3 className="h-4 w-4 shrink-0 text-primary" /><span className={`min-w-0 flex-1 truncate ${value ? "text-slate-800" : "text-slate-400"}`}>{value || placeholder}</span>
      </button>
      {value && <button type="button" aria-label="Clear time" onClick={() => onChange("")} className="-ml-9 mr-1 grid h-11 w-8 place-items-center text-slate-400 hover:text-rose-500"><X className="h-4 w-4" /></button>}
    </div>
    {open && style && createPortal(<div ref={panel} role="dialog" aria-label="Choose the time" style={style} className="fixed z-[200] overflow-y-auto overscroll-contain space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl shadow-slate-900/15 animate-in fade-in zoom-in-95 slide-in-from-top-2">
      <div><p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">Common</p>
        <div className="grid grid-cols-4 gap-1.5">{PRESETS.map((n) => <button key={n} type="button" aria-pressed={total === n} onClick={() => { set(n); setOpen(false); }} className={chip(total === n)}>{n < 60 ? `${n}m` : `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}`}</button>)}</div></div>
      <div><p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">Hours</p>
        <div className="grid grid-cols-4 gap-1.5">{HOURS.map((h) => <button key={h} type="button" aria-pressed={hours === h} onClick={() => set(h * 60 + minutes)} className={chip(hours === h && total > 0)}>{h} h</button>)}</div></div>
      <div><p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">Minutes</p>
        <div className="grid grid-cols-6 gap-1.5">{MINUTES.map((m) => <button key={m} type="button" aria-pressed={minutes === m} onClick={() => set(hours * 60 + m)} className={chip(minutes === m && total > 0)}>{m}</button>)}</div></div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5"><span className="text-sm font-black text-slate-800">{value || "No time set"}</span><button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white">Done</button></div>
    </div>, document.body)}
  </div>;
}
