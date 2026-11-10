import { useState } from "react";
import { Link2, Loader2, X } from "lucide-react";
import { fileFromLink } from "./imageLink";

// A small "Link" button for compact picture fields: it opens a box for a picture address, downloads the
// picture and passes it on as a File (the same as a file chosen from the device).
export default function LinkImageButton({ onFile, disabled = false, label = "picture", accept }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (event) => {
    event?.preventDefault();
    if (!link.trim()) return;
    setBusy(true); setError("");
    try {
      const file = await fileFromLink(link);
      if (accept && !accept.includes(file.type)) throw new Error("This needs a PNG or JPG picture.");
      await onFile(file);
      setOpen(false); setLink("");
    } catch (failure) { setError(failure.message || "The picture could not be added."); }
    finally { setBusy(false); }
  };
  if (!open) return <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-primary-muted hover:text-primary disabled:opacity-50"><Link2 className="h-4 w-4" aria-hidden="true" />Link</button>;
  return <div className="flex w-full basis-full flex-col gap-1.5">
    <div className="flex gap-2">
      <input type="url" autoFocus value={link} onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(event); if (event.key === "Escape") setOpen(false); }} placeholder="https://example.com/logo.png" aria-label={`Link to the ${label}`} disabled={busy} className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" />
      <button type="button" disabled={busy || !link.trim()} onClick={add} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-sm font-bold text-white transition-colors hover:bg-primary disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Add</button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Close link box" className="rounded-xl px-2.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>
    {error && <p role="alert" className="text-xs font-bold text-rose-600">{error}</p>}
  </div>;
}
