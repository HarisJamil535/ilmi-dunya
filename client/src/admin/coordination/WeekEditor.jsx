import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, FileUp, Highlighter, Italic, LayoutTemplate, List, ListOrdered, Loader2, MessageSquare, PanelRight, PenLine, Redo2, RemoveFormatting, RotateCcw, Send, ShieldCheck, Strikethrough, Underline, Undo2, Wifi, WifiOff, X } from "lucide-react";
import { AdminActionButton, AdminLoader } from "../components/AdminUI";
import { Avatar, Dialog, StatusChip } from "./CoordUI";
import SignatureDialog from "./SignatureDialog";
import FontPicker from "./FontPicker";
import AnnouncementCenter from "./AnnouncementCenter";
import SidePanel from "./SidePanel";
import { FormView, PageView } from "./PageView";
import { LABELS } from "./pageLayout";
import { useLiveWeek } from "./useLiveWeek";
import { HIGHLIGHTS, TEXT_COLOURS, addPick, clearHighlight, run, size } from "./editorCommands";
import { api, download, messageOf } from "./coordApi";
import "./coordination.css";

const toast = (message, type = "error") => window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type, message } }));
const PICK_GROUP = (key) => (key?.endsWith(".methods") ? "methods" : key?.endsWith(".afl") ? "afl" : key?.endsWith(".resources") ? "resources" : "");
const SAVE_DELAY = 500;

function ToolButton({ icon, label, onClick, active = false, disabled = false }) {
  const Icon = icon;
  return <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`ce-tool ${active ? "is-active" : ""}`}><Icon className="h-4 w-4" /></button>;
}

function Swatches({ colours, onPick, onClear, label, disabled }) {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button type="button" title={label} aria-label={label} aria-expanded={open} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)} className="ce-tool">{label === "Highlight" ? <Highlighter className="h-4 w-4" /> : <span className="text-[15px] font-black underline decoration-[3px] decoration-rose-600 underline-offset-2">A</span>}</button>
    {open && <div className="ce-swatches" onMouseDown={(e) => e.preventDefault()}>
      {colours.map(([hex, name]) => <button key={hex} type="button" title={name} aria-label={name} style={{ background: hex }} onClick={() => { onPick(hex); setOpen(false); }} />)}
      {onClear && <button type="button" title="No highlight" aria-label="No highlight" className="is-clear" onClick={() => { onClear(); setOpen(false); }}><X className="h-3.5 w-3.5" /></button>}
    </div>}
  </div>;
}

function ImportWeekDialog({ weekId, onClose, onDone }) {
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.append("file", picked);
      const d = await api.post(`/weeks/${weekId}/import`, data, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      toast(`Imported ${d.imported} boxes from Word.${d.notes?.length ? " Some rows did not match the format and were left out." : ""}`, "success");
      onDone(); onClose();
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return <Dialog title="Fill this week from Word" subtitle="The boxes are filled from the Word file's record table. The current content is kept in History, so you can undo this." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={FileUp} loading={busy} disabled={!picked} onClick={go}>Import</AdminActionButton></>}>
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-600 hover:border-primary-muted">
      <FileUp className="h-7 w-7 text-primary" />{picked ? picked.name : "Choose a Word file (.docx)"}<span className="text-xs font-medium text-slate-500">If it has several weeks, the one with this week's number is used.</span>
      <input type="file" accept=".docx" className="sr-only" onChange={(e) => setPicked(e.target.files?.[0] || null)} />
    </label>
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

export default function WeekEditor() {
  const { weekId } = useParams();
  return <WeekEditorView key={weekId} weekId={weekId} />;
}

function WeekEditorView({ weekId }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cells, setCells] = useState({});
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activeCell, setActiveCell] = useState("");
  const [onlyCell, setOnlyCell] = useState("");
  const [tab, setTab] = useState("comments");
  const [panel, setPanel] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1280 : true));
  const [zoom, setZoom] = useState("fit");
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.innerWidth < 900 ? "form" : "page"));
  const [saving, setSaving] = useState("saved"); // saved | saving | offline
  const [fit, setFit] = useState(null);
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState("");
  const [menu, setMenu] = useState(false);
  const activeEl = useRef(null);
  const timers = useRef({});
  const pending = useRef(new Map());
  const fitTimer = useRef(null);

  const load = useCallback(() => api.get(`/weeks/${weekId}`)
    .then((d) => { setData(d); setCells(d.week.cells); setComments(d.comments); setActivity(d.activity); setFit(d.fit); setError(""); })
    .catch((e) => setError(messageOf(e))), [weekId]);
  useEffect(() => { load(); }, [load]);

  const refreshFit = () => { clearTimeout(fitTimer.current); fitTimer.current = setTimeout(() => api.get(`/weeks/${weekId}/fit`).then((d) => setFit(d.fit)).catch(() => {}), 2500); };

  const live = useLiveWeek(weekId, {
    onCell: ({ cell, html }) => { if (activeEl.current?.dataset.cell !== cell) setCells((c) => ({ ...c, [cell]: html })); refreshFit(); },
    onComment: (comment) => setComments((list) => (list.some((c) => c.id === comment.id) ? list.map((c) => (c.id === comment.id ? comment : c)) : [...list, comment])),
    onCommentDeleted: ({ id }) => setComments((list) => list.filter((c) => c.id !== id)),
    onActivity: (entry) => setActivity((list) => [entry, ...list.filter((a) => a.id !== entry.id)].slice(0, 80)),
    onStatus: ({ by }) => { load(); toast(`${by} changed the week's status.`, "success"); },
    onReload: ({ by, note }) => { load(); if (by) toast(`${by}: ${note || "updated the week"}`, "success"); },
    onMeta: ({ font, by } = {}) => { load(); if (font && by) toast(`${by} changed the page font.`, "success"); },
    onDeleted: ({ by }) => { toast(`${by} deleted this week.`); navigate(-1); },
    onEnded: (message) => toast(message),
    onJoined: () => { if (pending.current.size) flushAll(); },
  });

  // Saves one box: through the live connection, or with an ordinary request if it is down.
  const save = async (cell, html) => {
    setSaving("saving");
    const reply = await live.emit("edit", { cell, html });
    if (reply.ok) { pending.current.delete(cell); setSaving(pending.current.size ? "saving" : "saved"); refreshFit(); return; }
    if (reply.offline) {
      pending.current.set(cell, html);
      try { await api.put(`/weeks/${weekId}/cells`, { cells: [{ key: cell, html }] }); pending.current.delete(cell); setSaving("saved"); refreshFit(); }
      catch (e) { setSaving("offline"); if (e.response) { pending.current.delete(cell); toast(messageOf(e)); } }
      return;
    }
    pending.current.delete(cell);
    setSaving("saved");
    toast(reply.message || "This change could not be saved.");
    if (reply.status === 409) load();
  };
  const flushAll = () => { for (const [cell, html] of pending.current) save(cell, html); };
  const schedule = (cell, el) => {
    pending.current.set(cell, el.innerHTML);
    setSaving("saving");
    clearTimeout(timers.current[cell]);
    timers.current[cell] = setTimeout(() => save(cell, el.innerHTML), SAVE_DELAY);
  };

  const editable = Boolean(data?.caps.edit && data?.week.status === "draft");
  const holders = useMemo(() => {
    const map = {};
    for (const p of live.people) if (p.cell && p.socketId !== live.me && p.adminId !== data?.me.id) map[p.cell] = p;
    return map;
  }, [live.people, live.me, data]);
  const openCounts = useMemo(() => { const m = {}; for (const c of comments) if (!c.resolved && c.cell) m[c.cell] = (m[c.cell] || 0) + 1; return m; }, [comments]);

  const onFocusCell = async (cell, el) => {
    activeEl.current = el; setActiveCell(cell);
    if (!editable) return;
    const reply = await live.emit("focus", { cell });
    if (reply && !reply.ok && reply.holder) { el.blur(); toast(`${reply.holder} is editing this box. Try again in a moment.`); }
  };
  const onBlurCell = (cell, el) => {
    if (pending.current.has(cell)) { clearTimeout(timers.current[cell]); save(cell, el.innerHTML); }
    live.send("blur");
    setTimeout(() => { if (activeEl.current === el && document.activeElement !== el) { activeEl.current = null; setActiveCell(""); } }, 150);
  };
  const cell = (key) => ({
    cellKey: key, label: LABELS[key], html: cells[key] || "", editable, holder: holders[key], comments: openCounts[key] || 0,
    placeholder: data?.defaults?.[key] ? `${data.defaults[key]} (automatic)` : "",
    onFocusCell, onInputCell: schedule, onBlurCell,
    onComments: (k) => { setOnlyCell(k); setTab("comments"); setPanel(true); },
  });
  const focusCell = (key) => { const el = document.querySelector(`[data-cell="${CSS.escape(key)}"]`); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus({ preventScroll: true }); } };
  const applyFormat = (fn) => { const el = activeEl.current; if (!el || !editable) return; fn(); schedule(el.dataset.cell, el); };

  const setPageFont = async (font) => {
    try { await api.patch(`/weeks/${weekId}`, { font }); await load(); refreshFit(); } catch (e) { toast(messageOf(e)); }
  };
  const pick = (item) => {
    const el = activeEl.current; if (!el || !editable) return;
    addPick(el, item, PICK_GROUP(el.dataset.cell) !== "resources");
    schedule(el.dataset.cell, el);
    el.focus();
  };

  const act = async (action) => {
    if ((action === "submit" || action === "approve") && !data.me.hasSignature) { setDialog(`sign:${action}`); return; }
    setBusy(action);
    try {
      // Anything still being typed is saved first.
      for (const [c, html] of pending.current) await save(c, html);
      await api.post(`/weeks/${weekId}/${action}`);
      toast({ submit: "Submitted and signed. The Section Head can now approve it.", approve: "Approved and signed. The record is final.", reopen: "Reopened for changes. Signatures were removed." }[action], "success");
      await load();
    } catch (e) { toast(messageOf(e)); } finally { setBusy(""); }
  };
  const get = async (fmt) => { setMenu(false); setBusy(fmt); try { for (const [c, html] of pending.current) await save(c, html); await download(`/weeks/${weekId}/export?format=${fmt}`); } catch (e) { toast(messageOf(e)); } finally { setBusy(""); } };

  useEffect(() => {
    const leave = (e) => { if (pending.current.size) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, []);

  if (error && !data) return <div className="mx-auto max-w-3xl"><p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p><Link to="/admin/coordination" className="mt-3 inline-block text-sm font-bold text-primary">Back to coordination files</Link></div>;
  if (!data) return <AdminLoader label="Opening the week..." />;
  const { week, file, caps } = data;
  const index = data.siblings.findIndex((s) => s.id === week.id);
  const prev = data.siblings[index - 1], next = data.siblings[index + 1];
  const group = PICK_GROUP(activeCell);
  const picks = group ? data.settings.quickPicks?.[group] || [] : [];
  const others = live.people.filter((p, i, all) => p.adminId !== data.me.id && all.findIndex((x) => x.adminId === p.adminId) === i);
  const fitText = !fit ? "" : fit.overflow ? "Too long for one page — shorten some boxes" : fit.size < 7 ? `Fits on one page (small text, ${fit.size} pt)` : `Fits on one page · ${fit.size} pt`;

  return <div className="coord-root ce-root">
    {/* Top bar */}
    <div className="ce-bar">
      <div className="flex min-w-0 items-center gap-2">
        <Link to={`/admin/coordination/${file.id}`} className="ce-icon" aria-label="Back to the file"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-500">{file.subject.name} · {file.subject.className} · {file.session}</p>
          <div className="flex items-center gap-2"><h1 className="text-lg font-black text-slate-900">Week {week.week}{week.term ? <span className="font-bold text-slate-500"> · {week.term}</span> : null}</h1><StatusChip status={week.status} /></div>
        </div>
        <div className="ml-1 hidden items-center sm:flex">
          <button type="button" disabled={!prev} onClick={() => navigate(`/admin/coordination/week/${prev.id}`)} className="ce-icon" aria-label="Previous week"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" disabled={!next} onClick={() => navigate(`/admin/coordination/week/${next.id}`)} className="ce-icon" aria-label="Next week"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center -space-x-1.5" aria-label="People here now">{others.slice(0, 5).map((p) => <Avatar key={p.adminId} name={p.name} colour={p.colour} size={30} ring title={`${p.name}${p.cell ? ` — editing ${LABELS[p.cell]}` : " — viewing"}`} />)}</div>
        <span className={`ce-live is-${live.status}`} title={live.status === "live" ? "Changes from others appear instantly" : "Reconnecting; your changes are still saved"}>{live.status === "live" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{live.status === "live" ? "Live" : live.status === "connecting" ? "Connecting" : "Offline"}</span>
        <span className="ce-saved">{saving === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : saving === "offline" ? <span className="text-rose-600">Not saved — check connection</span> : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Saved</>}</span>
        <div className="relative">
          <AdminActionButton variant="secondary" icon={Download} loading={busy === "pdf" || busy === "docx"} onClick={() => setMenu(!menu)} className="!min-h-9">Download</AdminActionButton>
          {menu && <div className="ce-menu"><button type="button" onClick={() => get("docx")}><FileText className="h-4 w-4" />Word (.docx)</button><button type="button" onClick={() => get("pdf")}><Download className="h-4 w-4" />PDF</button></div>}
        </div>
        {caps.signCoordinator && week.status === "draft" && <AdminActionButton icon={Send} loading={busy === "submit"} onClick={() => act("submit")} className="!min-h-9">Submit &amp; sign</AdminActionButton>}
        {caps.signSectionHead && week.status === "submitted" && <AdminActionButton icon={ShieldCheck} loading={busy === "approve"} onClick={() => act("approve")} className="!min-h-9">Approve &amp; sign</AdminActionButton>}
        {caps.reopen && week.status !== "draft" && <AdminActionButton variant="secondary" icon={RotateCcw} loading={busy === "reopen"} onClick={() => setDialog("reopen")} className="!min-h-9">Reopen</AdminActionButton>}
        <AnnouncementCenter compact />
        <button type="button" onClick={() => setPanel(!panel)} className={`ce-icon ${panel ? "is-on" : ""}`} aria-label="Comments, activity and history" aria-pressed={panel}><PanelRight className="h-5 w-5" />{comments.some((c) => !c.resolved) && <span className="ce-dot" />}</button>
      </div>
    </div>

    {/* Status banner */}
    {week.status !== "draft" && <div className={`ce-banner is-${week.status}`}>{week.status === "submitted" ? <>Submitted by {week.signatures.coordinator?.name}. Editing is paused while the Section Head reviews it.{caps.signSectionHead && " Approve it, or reopen it and comment on what to change."}</> : <>Approved and signed by {week.signatures.sectionHead?.name}. {file.showQr ? "The download carries a QR code anyone can scan to check it is genuine." : ""}</>}</div>}
    {!caps.edit && <div className="ce-banner is-view">You can view, download and comment on this week. Ask the coordinator if you need to edit it.</div>}

    {/* Toolbar */}
    {editable && <div className="ce-toolbar" role="toolbar" aria-label="Text formatting">
      <ToolButton icon={Undo2} label="Undo" onClick={() => applyFormat(() => run("undo"))} />
      <ToolButton icon={Redo2} label="Redo" onClick={() => applyFormat(() => run("redo"))} />
      <span className="ce-sep" />
      <ToolButton icon={Bold} label="Bold" onClick={() => applyFormat(() => run("bold"))} />
      <ToolButton icon={Italic} label="Italic" onClick={() => applyFormat(() => run("italic"))} />
      <ToolButton icon={Underline} label="Underline" onClick={() => applyFormat(() => run("underline"))} />
      <ToolButton icon={Strikethrough} label="Strikethrough" onClick={() => applyFormat(() => run("strikeThrough"))} />
      <span className="ce-sep" />
      <Swatches label="Text colour" colours={TEXT_COLOURS} onPick={(hex) => applyFormat(() => run("foreColor", hex))} />
      <Swatches label="Highlight" colours={HIGHLIGHTS} onPick={(hex) => applyFormat(() => run("hiliteColor", hex))} onClear={() => applyFormat(clearHighlight)} />
      <FontPicker label="Page font" fonts={data.fonts} value={week.font} onPick={setPageFont} />
      <FontPicker label="Font for selected text" fonts={data.fonts} value="" onPick={(key) => applyFormat(() => run("fontName", `Coord ${data.fonts.find((f) => f.key === key)?.label || "Arial"}`))} keepFocus />
      <div className="ce-size" role="group" aria-label="Text size">{[["s", "Small"], ["m", "Normal"], ["l", "Large"]].map(([v, l]) => <button key={v} type="button" title={`${l} text`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(() => size(v))}>{v === "s" ? "A-" : v === "m" ? "A" : "A+"}</button>)}</div>
      <span className="ce-sep" />
      <ToolButton icon={List} label="Bullet list" onClick={() => applyFormat(() => run("insertUnorderedList"))} />
      <ToolButton icon={ListOrdered} label="Numbered list" onClick={() => applyFormat(() => run("insertOrderedList"))} />
      <ToolButton icon={AlignLeft} label="Align left" onClick={() => applyFormat(() => run("justifyLeft"))} />
      <ToolButton icon={AlignCenter} label="Centre" onClick={() => applyFormat(() => run("justifyCenter"))} />
      <ToolButton icon={AlignRight} label="Align right" onClick={() => applyFormat(() => run("justifyRight"))} />
      <ToolButton icon={RemoveFormatting} label="Clear formatting" onClick={() => applyFormat(() => run("removeFormat"))} />
      <span className="ce-sep" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setView(view === "page" ? "form" : "page")} className="ce-text-btn"><LayoutTemplate className="h-4 w-4" />{view === "page" ? "Form view" : "Page view"}</button>
      {view === "page" && <div className="ce-size" role="group" aria-label="Zoom">{[["fit", "Fit"], ["1", "100%"], ["1.25", "125%"]].map(([v, l]) => <button key={v} type="button" aria-pressed={zoom === v} className={zoom === v ? "is-on" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => setZoom(v)}>{l}</button>)}</div>}
      <button type="button" onClick={() => setDialog("import")} className="ce-text-btn"><FileUp className="h-4 w-4" />Fill from Word</button>
      <button type="button" onClick={() => setDialog("signature")} className="ce-text-btn"><PenLine className="h-4 w-4" />My signature</button>
      {activeCell && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOnlyCell(activeCell); setTab("comments"); setPanel(true); }} className="ce-text-btn"><MessageSquare className="h-4 w-4" />Comment on this box</button>}
    </div>}
    {!editable && <div className="ce-toolbar"><button type="button" onClick={() => setView(view === "page" ? "form" : "page")} className="ce-text-btn"><LayoutTemplate className="h-4 w-4" />{view === "page" ? "Form view" : "Page view"}</button><button type="button" onClick={() => setDialog("signature")} className="ce-text-btn"><PenLine className="h-4 w-4" />My signature</button></div>}

    {/* Quick picks and fit meter */}
    <div className="ce-subbar">
      {editable && picks.length > 0 ? <div className="ce-picks" onMouseDown={(e) => e.preventDefault()}><span>Quick add:</span>{picks.map((p) => <button key={p} type="button" onClick={() => pick(p)}>+ {p}</button>)}</div>
        : <p className="text-xs text-slate-500">{editable ? (activeCell ? `Editing: ${LABELS[activeCell]}` : "Click any box to type. Changes save automatically and appear for everyone at once.") : ""}</p>}
      {fit && <span className={`ce-fit ${fit.overflow ? "is-over" : fit.size < 7 ? "is-tight" : ""}`} title="The record is always one A4 landscape page; text gets smaller as boxes fill up."><span style={{ width: `${Math.min(100, Math.round((fit.fullness || 0) * 100))}%` }} />{fitText}</span>}
    </div>

    <div className={`ce-main ${panel ? "with-panel" : ""}`}>
      <div className="ce-canvas">{view === "page" ? <PageView cell={cell} settings={data.settings} signatures={week.signatures} fontPt={fit?.size} zoom={zoom} attendees={file.department?.id ? data.attendees : null} font={week.font} /> : <FormView cell={cell} signatures={week.signatures} attendees={file.department?.id ? data.attendees : null} />}</div>
      {panel && <><button type="button" className="cp-scrim" aria-label="Close panel" onClick={() => setPanel(false)} /><SidePanel tab={tab} setTab={setTab} data={data} comments={comments} setComments={setComments} activity={activity} onReload={load} activeCell={activeCell} onlyCell={onlyCell} setOnlyCell={setOnlyCell} focusCell={focusCell} /></>}
    </div>

    {dialog === "import" && <ImportWeekDialog weekId={weekId} onClose={() => setDialog("")} onDone={load} />}
    {(dialog === "signature" || dialog.startsWith("sign:")) && <SignatureDialog onClose={() => setDialog("")} onSaved={(url) => { const after = dialog.startsWith("sign:") ? dialog.slice(5) : ""; setData((d) => ({ ...d, me: { ...d.me, hasSignature: Boolean(url), signatureUrl: url } })); setDialog(""); if (url && after) setTimeout(() => act(after), 50); }} />}
    {dialog === "reopen" && <Dialog title="Reopen this week?" subtitle="Both signatures are removed and the week becomes editable again. It will need to be submitted and approved again." onClose={() => setDialog("")}
      footer={<><AdminActionButton variant="secondary" onClick={() => setDialog("")}>Cancel</AdminActionButton><AdminActionButton icon={RotateCcw} onClick={() => { setDialog(""); act("reopen"); }}>Reopen</AdminActionButton></>}>
      <p className="text-sm text-slate-600">Tip: add a comment or change request first so the team knows what to change.</p>
    </Dialog>}
  </div>;
}
