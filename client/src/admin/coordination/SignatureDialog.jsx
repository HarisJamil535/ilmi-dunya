import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, ImageUp, PenLine, RotateCcw, Trash2, Undo2, Upload } from "lucide-react";
import { AdminActionButton } from "../components/AdminUI";
import { Dialog } from "./CoordUI";
import { api, messageOf } from "./coordApi";

// Draw a signature with a finger, pen or mouse, or use a photo of it. The line thickness can be changed at
// any time (even after drawing), and the preview shows the ink the record uses: blue for department
// members, pink for the Section Head. The server removes the paper and stores the signature once.
const INK = { blue: "#1d4ed8", pink: "#db2777" };
const WEIGHTS = [
  { key: "thin", label: "Thin", pen: 1.7, grow: -1 },
  { key: "normal", label: "Normal", pen: 2.7, grow: 0 },
  { key: "bold", label: "Bold", pen: 4, grow: 1 },
  { key: "heavy", label: "Extra bold", pen: 5.6, grow: 2 },
];
const STORE_INK = "#101840"; // dark ink on white is what the server expects; it recolours when printing
const WEIGHT_KEY = "coord-signature-weight";
const savedWeight = () => { try { return localStorage.getItem(WEIGHT_KEY) || "normal"; } catch { return "normal"; } };
const inkUrl = (url, ink) => { const m = /^\/api\/media\/images\/([a-f\d]{24})$/.exec(url || ""); return m ? `/api/media/signatures/${m[1]}/${ink}.png` : url; };

// Smooth strokes: each segment is a curve through the midpoints, so fast finger movements stay round.
function paintStrokes(ctx, strokes, width, color) {
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  for (const s of strokes) {
    if (s.length === 1) { ctx.beginPath(); ctx.arc(s[0].x, s[0].y, width / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length - 1; i++) { const mx = (s[i].x + s[i + 1].x) / 2, my = (s[i].y + s[i + 1].y) / 2; ctx.quadraticCurveTo(s[i].x, s[i].y, mx, my); }
    const last = s[s.length - 1]; ctx.lineTo(last.x, last.y); ctx.stroke();
  }
}

// A photo becomes an ink mask (paper removed), made thinner or thicker by shrinking or growing the ink.
function photoMask(img) {
  const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let paper = 0;
  for (let i = 0; i < data.length; i += 4 * 13) paper = Math.max(paper, (data[i] + data[i + 1] + data[i + 2]) / 3);
  paper = Math.max(160, paper);
  const mask = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) { const light = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3; mask[p] = Math.round(Math.max(0, Math.min(1, (paper - 25 - light) / (paper - 85))) * 255); }
  return { w, h, mask };
}
function reshape({ w, h, mask }, grow) {
  if (!grow) return mask;
  const r = Math.abs(grow), out = new Uint8ClampedArray(mask.length), pick = grow > 0 ? Math.max : Math.min;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = mask[y * w + x];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const xx = x + dx, yy = y + dy;
      v = pick(v, xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : mask[yy * w + xx]);
    }
    out[y * w + x] = v;
  }
  return out;
}
function maskCanvas({ w, h }, mask, color, background) {
  const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let p = 0; p < w * h; p++) {
    const a = mask[p] / 255;
    if (background) { img.data[p * 4] = 255 - (255 - r) * a; img.data[p * 4 + 1] = 255 - (255 - g) * a; img.data[p * 4 + 2] = 255 - (255 - b) * a; img.data[p * 4 + 3] = 255; }
    else { img.data[p * 4] = r; img.data[p * 4 + 1] = g; img.data[p * 4 + 2] = b; img.data[p * 4 + 3] = mask[p]; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const toBlob = (c) => new Promise((resolve) => c.toBlob(resolve, "image/png"));

export default function SignatureDialog({ onClose, onSaved, signLabel = "", ink = "blue", onRemove }) {
  const color = INK[ink] || INK.blue;
  const [current, setCurrent] = useState("");
  const [mode, setMode] = useState("draw");
  const [weight, setWeight] = useState(savedWeight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [strokes, setStrokes] = useState([]);
  const [photo, setPhoto] = useState(null); // { w, h, mask }
  const canvas = useRef(null);
  const preview = useRef(null);
  const live = useRef(null); // the stroke being drawn
  const w = WEIGHTS.find((x) => x.key === weight) || WEIGHTS[1];

  useEffect(() => { api.get("/me/signature").then((d) => setCurrent(d.signatureUrl)).catch(() => {}); }, []);
  useEffect(() => { try { localStorage.setItem(WEIGHT_KEY, weight); } catch { /* private mode */ } }, [weight]);

  // The pad is redrawn from the saved strokes, so turning the phone or changing the thickness keeps the drawing.
  const repaint = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const cw = Math.round(c.clientWidth * ratio), ch = Math.round(c.clientHeight * ratio);
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const ctx = c.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    paintStrokes(ctx, live.current ? [...strokes, live.current] : strokes, w.pen, color);
  }, [strokes, w.pen, color]);
  useEffect(() => { if (mode === "draw") repaint(); }, [mode, repaint]);
  useEffect(() => {
    const c = canvas.current; if (!c || mode !== "draw" || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => repaint()); ro.observe(c); return () => ro.disconnect();
  }, [mode, repaint]);

  useEffect(() => {
    const c = preview.current; if (!c || !photo) return;
    const shaped = maskCanvas(photo, reshape(photo, w.grow), color, false);
    c.width = photo.w; c.height = photo.h;
    const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(shaped, 0, 0);
  }, [photo, w.grow, color]);

  const point = (e) => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e) => { e.preventDefault(); canvas.current.setPointerCapture?.(e.pointerId); live.current = [point(e)]; repaint(); };
  const move = (e) => {
    if (!live.current) return;
    const p = point(e), last = live.current[live.current.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
    live.current.push(p); repaint();
  };
  const up = () => { if (!live.current) return; const s = live.current; live.current = null; setStrokes((all) => [...all, s]); };

  const upload = async (blob, after) => {
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.append("image", blob, "signature.png");
      const res = await api.post("/me/signature", data, { headers: { "Content-Type": undefined }, timeout: 60000 });
      setCurrent(res.signatureUrl); onSaved?.(res.signatureUrl); after?.(); onClose();
    } catch (e) { setError(messageOf(e, "The signature could not be saved. Please try again.")); } finally { setBusy(false); }
  };

  const saveDrawing = async () => {
    const src = canvas.current;
    const out = Object.assign(document.createElement("canvas"), { width: src.clientWidth * 2, height: src.clientHeight * 2 });
    const ctx = out.getContext("2d"); ctx.scale(2, 2); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, src.clientWidth, src.clientHeight);
    paintStrokes(ctx, strokes, w.pen, STORE_INK);
    const blob = await toBlob(out); if (blob) upload(blob);
  };
  const savePhoto = async () => { const blob = await toBlob(maskCanvas(photo, reshape(photo, w.grow), STORE_INK, true)); if (blob) upload(blob); };

  // Phone photos can be very large or in HEIC format; the browser reads them and only the ink is uploaded.
  const choosePhoto = async (file) => {
    setError("");
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
      const m = photoMask(img); URL.revokeObjectURL(url);
      if (!m.mask.some((v) => v > 60)) { setError("No signature was found in this photo. Sign with a dark pen on plain white paper, or draw it instead."); return; }
      setPhoto(m);
    } catch { setError("This photo could not be opened. Take a new photo (JPG or PNG) or draw your signature instead."); }
  };
  const removeSaved = async () => { setBusy(true); try { await api.del("/me/signature"); setCurrent(""); onSaved?.(""); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };

  const ready = mode === "draw" ? strokes.length > 0 : Boolean(photo);
  const saveLabel = signLabel ? `Save & ${signLabel}` : "Save signature";

  return <Dialog title="My e-signature" subtitle={signLabel ? "Your signature goes on this week's record as soon as you save it." : "Used whenever you sign a weekly record. Only you can sign with it."} onClose={onClose} busy={busy}
    footer={<>
      <AdminActionButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</AdminActionButton>
      {current && signLabel && !ready && <AdminActionButton icon={PenLine} disabled={busy} onClick={() => { onSaved?.(current); onClose(); }}>Use my signature &amp; {signLabel}</AdminActionButton>}
      {(ready || !current || !signLabel) && <AdminActionButton icon={PenLine} loading={busy} disabled={!ready} onClick={mode === "draw" ? saveDrawing : savePhoto}>{saveLabel}</AdminActionButton>}
    </>}>
    {current && <div className="sig-current" style={{ "--ink": color }}>
      <img src={inkUrl(current, ink)} alt="Your current signature" />
      <span>Current signature<small>{ink === "pink" ? "Pink ink (Section Head)" : "Blue ink"}</small></span>
      {onRemove && <button type="button" onClick={onRemove} disabled={busy} className="sig-link is-danger"><RotateCcw className="h-3.5 w-3.5" />Remove from this week</button>}
      {!onRemove && <button type="button" onClick={removeSaved} disabled={busy} className="sig-link is-danger"><Trash2 className="h-3.5 w-3.5" />Delete</button>}
    </div>}
    {current && signLabel && <p className="text-xs font-semibold text-slate-500">Use your current signature, or draw a new one below to replace it.</p>}

    <div className="sig-toolbar">
      <div role="tablist" className="sig-tabs">
        {[["draw", "Draw", PenLine], ["upload", "Photo", ImageUp]].map((tab) => { const [key, label, Icon] = tab; return <button key={key} role="tab" aria-selected={mode === key} type="button" onClick={() => setMode(key)}><Icon className="h-4 w-4" />{label}</button>; })}
      </div>
      <div className="sig-weights" role="radiogroup" aria-label="Line thickness">
        {WEIGHTS.map((x) => <button key={x.key} type="button" role="radio" aria-checked={weight === x.key} title={x.label} onClick={() => setWeight(x.key)} style={{ "--ink": color }}><i style={{ height: Math.max(1.5, x.pen) }} /><span>{x.label}</span></button>)}
      </div>
    </div>

    {mode === "draw" ? <div>
      <div className="sig-pad">
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label="Signature pad: draw your signature here" />
        {!strokes.length && <span className="sig-hint">Sign here</span>}
        <span className="sig-baseline" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Use your finger, a stylus or the mouse. Change the thickness any time.</span>
        <span className="flex gap-1">
          <button type="button" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length} className="sig-link"><Undo2 className="h-3.5 w-3.5" />Undo</button>
          <button type="button" onClick={() => setStrokes([])} disabled={!strokes.length} className="sig-link"><Eraser className="h-3.5 w-3.5" />Clear</button>
        </span>
      </div>
    </div> : photo ? <div>
      <div className="sig-pad is-photo"><canvas ref={preview} aria-label="Your signature from the photo" /></div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">The paper is removed. Pick the thickness that looks right.</span>
        <button type="button" onClick={() => setPhoto(null)} className="sig-link"><Upload className="h-3.5 w-3.5" />Another photo</button>
      </div>
    </div> : <label className="sig-drop">
      <ImageUp className="h-7 w-7 text-primary" />Choose a photo of your signature
      <span>Sign with a dark pen on plain white paper, then take a photo. The background is removed automatically.</span>
      <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) choosePhoto(f); }} />
    </label>}
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}
