import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Trash2, Upload } from "lucide-react";
import { AdminActionButton } from "../components/AdminUI";
import { Dialog } from "./CoordUI";
import { api, messageOf } from "./coordApi";

// Draw a signature with a finger, pen or mouse, or upload a photo of it. The server removes the paper
// background so it sits cleanly on the signature line of the record.
export default function SignatureDialog({ onClose, onSaved }) {
  const [current, setCurrent] = useState("");
  const [mode, setMode] = useState("draw");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef(null);
  const drawing = useRef(null);

  useEffect(() => { api.get("/me/signature").then((d) => setCurrent(d.signatureUrl)).catch(() => {}); }, []);
  useEffect(() => {
    const c = canvas.current; if (!c || mode !== "draw") return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d"); ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#101840"; ctx.lineWidth = 2.6;
  }, [mode]);

  const point = (e) => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e) => { e.preventDefault(); canvas.current.setPointerCapture(e.pointerId); drawing.current = point(e); };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext("2d"); const p = point(e);
    ctx.beginPath(); ctx.moveTo(drawing.current.x, drawing.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    drawing.current = p; setDrawn(true);
  };
  const up = () => { drawing.current = null; };
  const clear = () => { const c = canvas.current; const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); setDrawn(false); };

  const upload = async (blob) => {
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.append("image", blob, "signature.png");
      const res = await api.post("/me/signature", data, { headers: { "Content-Type": "multipart/form-data" } });
      setCurrent(res.signatureUrl); onSaved?.(res.signatureUrl); onClose();
    } catch (e) { setError(messageOf(e, "The signature could not be saved.")); } finally { setBusy(false); }
  };
  const saveDrawing = () => canvas.current.toBlob((blob) => blob && upload(blob), "image/png");
  const remove = async () => { setBusy(true); try { await api.del("/me/signature"); setCurrent(""); onSaved?.(""); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };

  return <Dialog title="My e-signature" subtitle="Used when you submit or approve a weekly record. Only you can sign with it." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</AdminActionButton>{mode === "draw" && <AdminActionButton icon={PenLine} loading={busy} disabled={!drawn} onClick={saveDrawing}>Save signature</AdminActionButton>}</>}>
    {current && <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <img src={current} alt="Your current signature" className="h-14 max-w-[60%] object-contain" />
      <span className="flex-1 text-xs font-bold text-slate-500">Current signature</span>
      <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Remove</button>
    </div>}
    <div role="tablist" className="inline-flex rounded-xl bg-slate-100 p-1">
      {[["draw", "Draw it", PenLine], ["upload", "Upload a photo", Upload]].map((t) => { const [key, label, Icon] = t; return <button key={key} role="tab" aria-selected={mode === key} type="button" onClick={() => setMode(key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${mode === key ? "bg-white text-primary-dark shadow-sm" : "text-slate-600"}`}><Icon className="h-4 w-4" />{label}</button>; })}
    </div>
    {mode === "draw" ? <div>
      <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="h-44 w-full touch-none rounded-2xl border-2 border-dashed border-slate-300 bg-white" aria-label="Signature pad: draw your signature here" />
      <div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-500">Sign inside the box with your finger, pen or mouse.</span><button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"><Eraser className="h-3.5 w-3.5" />Clear</button></div>
    </div> : <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm font-bold text-slate-600 hover:border-primary-muted">
      <Upload className="h-6 w-6 text-primary" />Choose a photo of your signature<span className="text-xs font-medium text-slate-500">Sign with a dark pen on plain white paper. PNG or JPG, up to 5 MB.<br />The white background is removed automatically.</span>
      <input type="file" accept="image/png,image/jpeg" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
    </label>}
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}
