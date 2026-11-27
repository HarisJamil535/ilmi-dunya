import { useCallback, useEffect, useRef, useState } from "react";
import { acquireSocket, releaseSocket } from "./liveSocket";
import { AlertTriangle, AtSign, Bell, Check, CheckCheck, Clock3, Eye, Megaphone, MessageSquare, RotateCcw, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminActionButton } from "../components/AdminUI";
import { Dialog, Field, inputClass } from "./CoordUI";
import { api, messageOf, timeAgo } from "./coordApi";

const toast = (message, type = "success") => window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type, message } }));

function ComposeDialog({ onClose, onSent }) {
  const [form, setForm] = useState({ title: "", body: "", audience: "all", important: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    setBusy(true); setError("");
    try { await api.post("/announcements", form); toast("Announcement sent."); onSent(); onClose(); } catch (e) { setError(messageOf(e)); setBusy(false); }
  };
  return <Dialog title="New announcement" subtitle="It appears at once for everyone you choose, with a notification." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={Send} loading={busy} disabled={!form.title.trim()} onClick={send} className={form.important ? "!bg-rose-600 hover:!bg-rose-700" : ""}>Send{form.important ? " as important" : ""}</AdminActionButton></>}>
    <fieldset><legend className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Send to</legend>
      <div className="grid grid-cols-2 gap-2">{[["all", "All staff", "Every department, Section Head and Principal"], ["coordinators", "Subject Coordinators only", "Plus the Section Head and Principal"]].map(([value, label, hint]) => <label key={value} className={`cursor-pointer rounded-xl border p-3 transition-colors ${form.audience === value ? "border-primary bg-primary-soft" : "border-slate-200 hover:border-primary-muted"}`}>
        <input type="radio" name="audience" className="sr-only" checked={form.audience === value} onChange={() => setForm({ ...form, audience: value })} />
        <span className={`block text-sm font-black ${form.audience === value ? "text-primary-dark" : "text-slate-800"}`}>{label}</span><span className="block text-xs text-slate-500">{hint}</span>
      </label>)}</div>
    </fieldset>
    <Field label="Title"><input className={inputClass} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Submit week 17 plans by Thursday" autoFocus /></Field>
    <Field label="Message (optional)"><textarea className={`${inputClass} min-h-28 py-2`} maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${form.important ? "border-rose-300 bg-rose-50" : "border-slate-200"}`}>
      <input type="checkbox" className="h-4 w-4 accent-rose-600" checked={form.important} onChange={(e) => setForm({ ...form, important: e.target.checked })} />
      <AlertTriangle className={`h-5 w-5 ${form.important ? "text-rose-600" : "text-slate-400"}`} />
      <span><b className={form.important ? "text-rose-700" : "text-slate-800"}>Mark as important</b><span className="block text-xs text-slate-500">Shows a red alert at the top of everyone's screen until they read it.</span></span>
    </label>
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

// "Seen by 5 of 8" — opens the names of who has read the announcement and who has not yet.
function Readers({ id }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const toggle = (e) => {
    e.stopPropagation();
    if (!open && !data) api.get(`/announcements/${id}/readers`).then(setData).catch(() => setData({ read: [], unread: [] }));
    setOpen(!open);
  };
  const total = data ? data.read.length + data.unread.length : 0;
  return <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
    <button type="button" onClick={toggle} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-primary-soft hover:text-primary-dark"><Eye className="h-3 w-3" />{data ? `Seen by ${data.read.length} of ${total}` : "Who has read it"}</button>
    {open && data && <div className="ann-readers">
      <p className="ann-readers-h is-read"><CheckCheck className="h-3.5 w-3.5" />Read ({data.read.length})</p>
      {data.read.length ? <ul>{data.read.map((p) => <li key={p.id}>{p.name}<span>{p.department || (p.title === "principal" ? "Principal" : p.title === "sectionHead" ? "Section Head" : "")}</span></li>)}</ul> : <p className="ann-readers-empty">No one yet</p>}
      <p className="ann-readers-h"><Clock3 className="h-3.5 w-3.5" />Not yet ({data.unread.length})</p>
      {data.unread.length ? <ul>{data.unread.map((p) => <li key={p.id}>{p.name}<span>{p.department || (p.title === "principal" ? "Principal" : p.title === "sectionHead" ? "Section Head" : "")}</span></li>)}</ul> : <p className="ann-readers-empty">Everyone has read it</p>}
    </div>}
  </div>;
}

// The bell, the red alert for important notices, and the list of announcements. Updates arrive live.
export default function AnnouncementCenter({ compact = false, left = null }) {
  const [state, setState] = useState({ items: [], canAnnounce: false, canSeeReaders: false });
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState(false);
  const [notes, setNotes] = useState({ items: [], unread: 0 });
  const [tab, setTab] = useState("you");
  const navigate = useNavigate();
  const panel = useRef(null);
  const loadNotes = useCallback(() => api.get("/notifications").then((d) => setNotes({ items: d.notifications || [], unread: d.unread || 0 })).catch(() => {}), []);
  useEffect(() => { loadNotes(); }, [loadNotes]);
  const load = useCallback(() => api.get("/announcements").then((d) => setState({ items: d.announcements || [], canAnnounce: d.canAnnounce, canSeeReaders: d.canSeeReaders })).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const socket = acquireSocket();
    const arrived = (a) => { load(); toast(`${a.important ? "Important: " : "New announcement: "}${a.title}`, a.important ? "error" : "success"); };
    // Mentions, replies and approvals arrive here live, on every open tab.
    const personal = (n) => { setNotes((s) => ({ items: [n, ...s.items.filter((x) => x.id !== n.id)].slice(0, 60), unread: s.unread + 1 })); toast(n.title, "success"); };
    socket.on("announcement", arrived);
    socket.on("announcement-deleted", load);
    socket.on("notification", personal);
    // After a dropped connection, catch up on anything missed.
    socket.on("connect", loadNotes);
    return () => { socket.off("announcement", arrived); socket.off("announcement-deleted", load); socket.off("notification", personal); socket.off("connect", loadNotes); releaseSocket(); };
  }, [load, loadNotes]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!panel.current?.contains(e.target)) setOpen(false); };
    const escape = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const markRead = async (item) => { setState((s) => ({ ...s, items: s.items.map((x) => (x.id === item.id ? { ...x, read: true } : x)) })); await api.post(`/announcements/${item.id}/read`).catch(() => {}); };
  const remove = async (item) => { try { await api.del(`/announcements/${item.id}`); load(); } catch (e) { toast(messageOf(e), "error"); } };
  const unread = state.items.filter((a) => !a.read);
  const alerts = unread.filter((a) => a.important);
  const total = unread.length + notes.unread;
  const openNote = (n) => {
    if (!n.read) { setNotes((s) => ({ items: s.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unread: Math.max(0, s.unread - 1) })); api.post(`/notifications/${n.id}/read`).catch(() => {}); }
    setOpen(false);
    if (n.week) navigate(`/admin/coordination/week/${n.week}${n.cell || n.comment ? `?${new URLSearchParams({ ...(n.cell ? { cell: n.cell } : {}), ...(n.comment ? { comment: n.comment } : {}) })}` : ""}`);
  };
  const readAll = () => { setNotes((s) => ({ items: s.items.map((x) => ({ ...x, read: true })), unread: 0 })); api.post("/notifications/read-all").catch(() => {}); };
  const NOTE_ICON = { mention: AtSign, reply: MessageSquare, submitted: Send, approved: ShieldCheck, reopened: RotateCcw };

  const bell = <div ref={panel} className="relative">
      <button type="button" onClick={() => { if (!open) setTab(notes.unread || !unread.length ? "you" : "ann"); setOpen(!open); }} aria-label={`Notifications${total ? `, ${total} unread` : ""}`} aria-expanded={open} className={`ann-bell ${alerts.length ? "is-alert" : total ? "is-new" : ""}`}>
        <Bell className="h-5 w-5" />{total > 0 && <span>{total > 9 ? "9+" : total}</span>}
      </button>
      {open && <div className="ann-panel">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-2">
          <div role="tablist" className="ann-tabs"><button type="button" role="tab" aria-selected={tab === "you"} onClick={() => setTab("you")}><AtSign className="h-3.5 w-3.5" />For you{notes.unread ? <span>{notes.unread}</span> : null}</button><button type="button" role="tab" aria-selected={tab === "ann"} onClick={() => setTab("ann")}><Megaphone className="h-3.5 w-3.5" />Announcements{unread.length ? <span>{unread.length}</span> : null}</button></div>
          <div className="flex items-center gap-1">{tab === "ann" && state.canAnnounce && <AdminActionButton icon={Send} className="!min-h-8 !px-3 !text-xs" onClick={() => { setOpen(false); setCompose(true); }}>New</AdminActionButton>}{tab === "you" && notes.unread > 0 && <button type="button" onClick={readAll} className="rounded-lg px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary-soft">Mark all read</button>}<button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div></div>
        {tab === "you" ? <div className="max-h-[60vh] overflow-y-auto p-2">{notes.items.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Nothing yet. When someone @mentions you, replies to you, or a week is submitted or approved, it appears here.</p> : notes.items.map((n) => { const Icon = NOTE_ICON[n.kind] || Bell; return <button key={n.id} type="button" onClick={() => openNote(n)} className={`ann-item w-full text-left ${n.read ? "" : "is-unread"}`}>
          <div className="flex items-start gap-2.5"><span className={`ann-note-icon is-${n.kind}`}><Icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{n.title}</p>{n.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{n.body}</p>}<p className="mt-1 text-[11px] text-slate-500">{timeAgo(n.at)}</p></div>
            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}</div>
        </button>; })}</div> : <div className="max-h-[60vh] overflow-y-auto p-2">
          {state.items.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No announcements yet.</p> : state.items.map((a) => <article key={a.id} onClick={() => !a.read && markRead(a)} className={`ann-item ${a.important ? "is-important" : ""} ${a.read ? "" : "is-unread"}`}>
            <div className="flex items-start gap-2">
              {a.important ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
              <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">{a.title}</p>{a.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>}
                <p className="mt-1 text-[11px] text-slate-500">{a.byName} · {timeAgo(a.at)} · {a.audience === "coordinators" ? "Subject Coordinators" : "All staff"}</p>
                {(state.canSeeReaders || a.mine) && <Readers id={a.id} />}</div>
              {!a.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              {a.mine && <button type="button" onClick={(e) => { e.stopPropagation(); remove(a); }} aria-label="Delete announcement" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          </article>)}
        </div>}
      </div>}
    </div>;
  const alertList = alerts.length > 0 && !compact ? <div className="ann-alerts">{alerts.slice(0, 3).map((a) => <div key={a.id} role="alert" className="ann-alert">
      <span className="ann-alert-icon"><AlertTriangle className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-rose-500">Important · {a.byName}{a.byTitle && a.byTitle !== a.byName ? `, ${a.byTitle}` : ""} · {timeAgo(a.at)}</p><p className="text-base font-black">{a.title}</p>{a.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-rose-800">{a.body}</p>}</div>
      <button type="button" onClick={() => markRead(a)} className="ann-alert-btn"><Check className="h-4 w-4" />Got it</button>
    </div>)}</div> : null;
  return <>
    {compact ? bell : <div className="space-y-3"><div className="flex items-center justify-between gap-3">{left}{bell}</div>{alertList}</div>}
    {compose && <ComposeDialog onClose={() => setCompose(false)} onSent={load} />}
  </>;
}
