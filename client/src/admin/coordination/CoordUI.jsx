import { X } from "lucide-react";
import ModalViewport from "../../shared/ModalViewport";
import { STATUS, initials } from "./coordApi";

// A window with a title, a scrolling body and buttons at the bottom.
export function Dialog({ title, subtitle, onClose, footer, children, wide = false, busy = false }) {
  return <ModalViewport onClose={onClose} busy={busy}><div className={`flex max-h-[96dvh] w-full ${wide ? "max-w-3xl" : "max-w-lg"} flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl`}>
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
      <div><h2 className="text-lg font-black text-slate-900">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
    {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4">{footer}</div>}
  </div></ModalViewport>;
}

export const Field = ({ label, hint, children }) => <label className="block"><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>;
export const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft";

export const StatusChip = ({ status, className = "" }) => {
  const s = STATUS[status] || STATUS.draft;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${s.tone} ${className}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{s.label}</span>;
};

export const Avatar = ({ name, colour = "#7c3aed", size = 32, ring = false, title }) => (
  <span title={title || name} className={`grid shrink-0 place-items-center rounded-full font-black text-white ${ring ? "ring-2 ring-white" : ""}`} style={{ width: size, height: size, background: colour, fontSize: size * 0.38 }}>{initials(name)}</span>
);
