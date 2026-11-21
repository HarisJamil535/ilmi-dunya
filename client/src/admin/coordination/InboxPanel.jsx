import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AtSign, CalendarPlus, CheckCircle2, ClipboardCheck, Inbox, PenLine, Send, Sparkles } from "lucide-react";
import SignatureDialog from "./SignatureDialog";
import { useLiveRefresh } from "./useCoordEvent";
import { api, messageOf, timeAgo } from "./coordApi";

// "Waiting on me": the person's next steps in one list, each one a single tap away.
const KIND = {
  approve: { icon: ClipboardCheck, tone: "is-blue", label: "Approve & sign" },
  submit: { icon: Send, tone: "is-violet", label: "Submit & sign" },
  reply: { icon: AtSign, tone: "is-pink", label: "Reply" },
  fill: { icon: PenLine, tone: "is-amber", label: "Continue" },
  start: { icon: CalendarPlus, tone: "is-green", label: "Start week" },
};
const due = (d) => d ? new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";

export default function InboxPanel({ hasSignature, onSigned }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sign, setSign] = useState(null); // task waiting for a signature
  const [showAll, setShowAll] = useState(false);
  const load = useCallback(() => api.get("/inbox").then(setData).catch((e) => setError(messageOf(e))), []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const open = (t, cell) => {
    const q = new URLSearchParams({ ...(cell ? { cell } : {}), ...(t.commentId ? { comment: t.commentId } : {}) }).toString();
    navigate(`/admin/coordination/week/${t.weekId}${q ? `?${q}` : ""}`);
  };
  const sendStatus = async (t, signed = false) => {
    if (!hasSignature && !signed) { setSign(t); return; }
    setBusy(t.weekId); setError("");
    try { await api.post(`/weeks/${t.weekId}/${t.kind}`); await load(); }
    catch (e) { if (e?.response?.status === 409 && /e-signature/i.test(messageOf(e))) setSign(t); else setError(messageOf(e)); }
    finally { setBusy(""); }
  };
  const start = async (t, copy) => {
    setBusy(`start:${t.fileId}`); setError("");
    try { const r = await api.post(`/files/${t.fileId}/weeks`, { week: t.week, ...(copy && t.copyFrom ? { copyFrom: t.copyFrom } : {}) }); navigate(`/admin/coordination/week/${r.id}`); }
    catch (e) { setError(messageOf(e)); setBusy(""); }
  };

  if (!data) return null;
  const tasks = data.tasks;
  const list = showAll ? tasks : tasks.slice(0, 6);
  const urgent = tasks.filter((t) => t.overdue).length;

  return <section className="coord-inbox" aria-labelledby="inbox-title">
    <div className="coord-inbox-head">
      <span className="coord-inbox-icon"><Inbox className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="inbox-title">Waiting on me</h2>
        <p>{tasks.length === 0 ? "You're all caught up." : `${tasks.length} thing${tasks.length > 1 ? "s" : ""} to do${urgent ? ` · ${urgent} overdue` : ""}`}</p>
      </div>
    </div>
    {tasks.length === 0 ? <div className="coord-inbox-done"><Sparkles className="h-6 w-6" />Nothing is waiting on you. Nice work!</div> :
      <ul className="coord-inbox-list">
        {list.map((t) => {
          const k = KIND[t.kind]; const Icon = k.icon;
          const key = `${t.kind}:${t.weekId || t.fileId}:${t.commentId || ""}`;
          return <li key={key} className={`coord-task ${k.tone} ${t.overdue ? "is-overdue" : ""}`}>
            <span className="coord-task-icon"><Icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="coord-task-title">{{
                approve: `Week ${t.week} is waiting for your approval`,
                submit: `Week ${t.week} is ${t.percent}% filled — submit when ready`,
                reply: `${t.by} mentioned you`,
                fill: t.mine ? `Continue Week ${t.week} (${t.percent}% filled)` : `Add your part to Week ${t.week}`,
                start: `Start Week ${t.week}`,
              }[t.kind]}</p>
              <p className="coord-task-sub">{t.file}{t.dueDate ? ` · due ${due(t.dueDate)}` : ""}{t.overdue ? " · overdue" : ""}{t.kind === "reply" ? ` · ${timeAgo(t.at)}` : ""}</p>
              {t.kind === "reply" && <p className="coord-task-quote">“{t.text}”</p>}
              {t.days && <div className="coord-days" aria-label="Days filled">
                {t.days.map((d) => <button key={d.day} type="button" onClick={() => open(t, `${d.day}.subTopics`)} className={d.done === d.total ? "is-full" : d.done ? "is-part" : ""} title={`${d.label}: ${d.done} of ${d.total} boxes filled`}>{d.label.slice(0, 3)}{d.done === d.total && <CheckCircle2 className="h-3 w-3" />}</button>)}
              </div>}
            </div>
            <div className="coord-task-actions">
              {t.kind === "start" ? <>
                {t.copyFrom && <button type="button" className="coord-task-btn" disabled={Boolean(busy)} onClick={() => start(t, true)}>{busy === `start:${t.fileId}` ? "Starting…" : "Copy last week"}</button>}
                <button type="button" className="coord-task-btn is-ghost" disabled={Boolean(busy)} onClick={() => start(t, false)}>Blank</button>
              </> : t.kind === "approve" || t.kind === "submit" ? <>
                <button type="button" className="coord-task-btn is-ghost" onClick={() => open(t)}>Review</button>
                <button type="button" className="coord-task-btn" disabled={busy === t.weekId} onClick={() => sendStatus(t)}>{busy === t.weekId ? "Signing…" : k.label}</button>
              </> : <button type="button" className="coord-task-btn" onClick={() => open(t, t.kind === "fill" ? t.nextCell : t.cell)}>{k.label}</button>}
            </div>
          </li>;
        })}
      </ul>}
    {tasks.length > 6 && <button type="button" className="coord-inbox-more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${tasks.length}`}</button>}
    {error && <p role="alert" className="mt-2 text-sm font-bold text-rose-600">{error}</p>}
    {sign && <SignatureDialog onClose={() => setSign(null)} onSaved={(url) => { const t = sign; setSign(null); if (url) { onSigned?.(); sendStatus(t, true); } }} />}
  </section>;
}
