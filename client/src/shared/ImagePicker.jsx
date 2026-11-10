import { useId, useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { fileFromLink } from "./imageLink";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * One picture field for the whole admin: upload from the device (button or drag and drop) or paste a link.
 * `upload(file)` stores the file and resolves to its address; `onChange(address)` receives it ("" removes it).
 */
export default function ImagePicker({ value, onChange, upload, label = "picture", maxMb = 2, hint, compact = false, disabled = false, accept = TYPES, previewClass = "" }) {
  const id = useId();
  const fileInput = useRef(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const word = label.toLowerCase();
  const locked = disabled || Boolean(busy);

  const store = async (file, how) => {
    if (!file) return;
    setError("");
    if (!accept.includes(file.type)) { setError("Choose a JPG, PNG or WebP picture."); return; }
    if (file.size > maxMb * 1024 * 1024) { setError(`The picture must be under ${maxMb} MB.`); return; }
    setBusy(how);
    try {
      const address = await upload(file);
      if (address) { onChange(address); setLinkOpen(false); setLink(""); }
    } catch (failure) {
      setError(failure.response?.data?.message || failure.message || "The picture could not be uploaded.");
    } finally { setBusy(""); }
  };

  const fromLink = async (event) => {
    event?.preventDefault();
    if (!link.trim()) return;
    setError("");
    setBusy("link");
    try { const file = await fileFromLink(link); setBusy(""); await store(file, "link"); }
    catch (failure) { setError(failure.message); setBusy(""); }
  };

  const drop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (!locked) store(event.dataTransfer.files?.[0], "file");
  };

  const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";
  const height = compact ? "h-24" : "h-36";

  return <div className="ip-field space-y-2.5">
    <div
      onDragOver={(event) => { event.preventDefault(); if (!locked) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={`ip-drop relative flex ${height} w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors duration-200 ${dragging ? "border-primary bg-primary-soft" : value ? "border-transparent bg-slate-50" : "border-slate-200 bg-slate-50/60 hover:border-primary-muted"}`}
    >
      {value ? <img src={value} alt={`${label} preview`} className={`ip-img h-full w-full object-contain p-2 ${previewClass}`} />
        : <button type="button" disabled={locked} onClick={() => fileInput.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-500 disabled:cursor-not-allowed">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-primary shadow-sm"><ImagePlus className="h-5 w-5" aria-hidden="true" /></span>
          <span className="text-xs font-bold">{dragging ? "Drop the picture here" : compact ? "Add a picture" : "Drag a picture here, or click to choose"}</span>
        </button>}
      {busy && <span role="status" className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-bold text-primary"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{busy === "link" ? "Getting the picture…" : "Uploading…"}</span></span>}
    </div>

    <input ref={fileInput} id={id} type="file" accept={accept.join(",")} hidden onChange={(event) => { store(event.target.files?.[0], "file"); event.target.value = ""; }} />
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={locked} onClick={() => fileInput.current?.click()} className={`${button} bg-primary text-white hover:bg-primary-dark`}>
        {value ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}{compact ? (value ? "Change" : "Upload") : value ? `Change ${word}` : "Upload from device"}
      </button>
      <button type="button" disabled={locked} aria-expanded={linkOpen} onClick={() => { setLinkOpen((open) => !open); setError(""); }} className={`${button} border border-slate-200 bg-white text-slate-700 hover:border-primary-muted hover:text-primary`}>
        <Link2 className="h-4 w-4" aria-hidden="true" />{compact ? "Link" : "Use a link"}
      </button>
      {value && <button type="button" disabled={locked} onClick={() => onChange("")} aria-label={`Remove ${word}`} className={`${button} text-rose-600 hover:bg-rose-50`}><Trash2 className="h-4 w-4" aria-hidden="true" />{compact ? "" : "Remove"}</button>}
    </div>

    {linkOpen && <div className="ip-link flex gap-2">
      <input type="url" inputMode="url" autoFocus value={link} onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") fromLink(event); if (event.key === "Escape") setLinkOpen(false); }} placeholder="https://example.com/picture.png" aria-label={`Link to the ${word}`} disabled={locked} className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" />
      <button type="button" disabled={locked || !link.trim()} onClick={fromLink} className={`${button} bg-slate-900 text-white hover:bg-primary`}>Add</button>
      <button type="button" onClick={() => setLinkOpen(false)} aria-label="Close link box" className={`${button} px-2.5 text-slate-500 hover:bg-slate-100`}><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>}
    {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
    {error && <p role="alert" className="text-xs font-bold text-rose-600">{error}</p>}
  </div>;
}
