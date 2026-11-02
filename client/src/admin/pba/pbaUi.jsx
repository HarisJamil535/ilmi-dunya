import { ArrowDown, ArrowUp, FileText, Play, X } from "lucide-react";
import ModalViewport from "../../shared/ModalViewport";

// A centred dialog with a title, scrolling body and a footer for buttons.
export const Dialog = ({ title, hint, onClose, busy, children, footer, wide = false }) => <ModalViewport onClose={onClose} busy={busy}>
  <div className={`relative flex max-h-full w-full ${wide ? "max-w-3xl" : "max-w-xl"} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl`} role="dialog" aria-modal="true" aria-label={title}>
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
      <div><h2 className="text-lg font-black text-slate-900">{title}</h2>{hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}</div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
    {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4">{footer}</div>}
  </div>
</ModalViewport>;

// Shows at a glance whether a video and notes link has been added.
export const LinkDots = ({ videoUrl, notesUrl }) => <span className="inline-flex items-center gap-1.5">
  <span title={videoUrl ? "Video added" : "No video yet"} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${videoUrl ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}`}><Play className="h-3 w-3" />Video</span>
  <span title={notesUrl ? "Notes added" : "No notes yet"} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${notesUrl ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-400"}`}><FileText className="h-3 w-3" />Notes</span>
</span>;

// Up and down buttons that move an item one place.
export const MoveButtons = ({ index, count, onMove, label = "item" }) => <span className="inline-flex">
  <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${label} up`} title="Move up" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
  <button type="button" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${label} down`} title="Move down" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
</span>;

