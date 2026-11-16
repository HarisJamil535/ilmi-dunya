import { useEffect, useState } from "react";
import { CheckCircle2, CircleHelp, History, MessageSquare, PencilLine, RotateCcw, Save, Send, Trash2, Zap } from "lucide-react";
import { AdminActionButton } from "../components/AdminUI";
import { Avatar, Dialog } from "./CoordUI";
import { api, mentionIds, messageOf, timeAgo } from "./coordApi";
import MentionInput from "./MentionInput";
import MentionText from "./mentionText";
import { LABELS } from "./pageLayout";

const KINDS = { comment: ["Comment", MessageSquare, "text-slate-600 bg-slate-100"], question: ["Question", CircleHelp, "text-sky-700 bg-sky-50"], change: ["Change request", PencilLine, "text-amber-700 bg-amber-50"] };

function Thread({ comment, me, caps, onUpdated, focusCell, people, flash }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [Kind, Icon, tone] = [KINDS[comment.kind][0], KINDS[comment.kind][1], KINDS[comment.kind][2]];
  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type: "error", message: messageOf(e) } })); } finally { setBusy(false); } };
  const send = () => act(async () => { const d = await api.post(`/comments/${comment.id}/replies`, { text: reply, mentions: mentionIds(reply, people) }); setReply(""); onUpdated(d.comment); });
  return <article id={`comment-${comment.id}`} className={`cp-thread ${comment.resolved ? "is-resolved" : ""} ${flash ? "is-flash" : ""}`}>
    <div className="flex items-center gap-2">
      <Avatar name={comment.authorName} size={26} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{comment.authorName}</p><p className="text-[11px] text-slate-500">{timeAgo(comment.at)}</p></div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}><Icon className="h-3 w-3" />{Kind}</span>
    </div>
    {comment.cell && <button type="button" onClick={() => focusCell(comment.cell)} className="mt-2 max-w-full truncate rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-dark hover:underline">{comment.cellLabel}</button>}
    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700"><MentionText text={comment.text} people={people} me={me} /></p>
    {comment.replies.map((r) => <div key={r.id} className="mt-2 border-l-2 border-slate-200 pl-3"><p className="text-xs"><b className="text-slate-700">{r.authorName}</b> <span className="text-slate-400">{timeAgo(r.at)}</span></p><p className="whitespace-pre-wrap text-sm text-slate-700"><MentionText text={r.text} people={people} me={me} /></p></div>)}
    {comment.resolved && <p className="mt-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Resolved{comment.resolvedByName ? ` by ${comment.resolvedByName}` : ""}</p>}
    {caps.comment && <div className="mt-2 flex items-center gap-1.5">
      {!comment.resolved && <MentionInput value={reply} onChange={setReply} people={people} onEnter={() => reply.trim() && send()} maxLength={1000} placeholder="Reply… (type @ to mention)" className="min-h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-primary" />}
      {!comment.resolved && reply.trim() && <button type="button" disabled={busy} onClick={send} aria-label="Send reply" className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white"><Send className="h-4 w-4" /></button>}
      <button type="button" disabled={busy} onClick={() => act(async () => onUpdated((await api.patch(`/comments/${comment.id}`, { resolved: !comment.resolved })).comment))} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">{comment.resolved ? "Reopen" : "Resolve"}</button>
      {(comment.author === me || caps.manage) && <button type="button" disabled={busy} onClick={() => act(async () => { await api.del(`/comments/${comment.id}`); onUpdated({ ...comment, deleted: true }); })} aria-label="Delete comment" className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>}
  </article>;
}

function Comments({ weekId, comments, setComments, me, caps, activeCell, onlyCell, setOnlyCell, focusCell, people, flashId }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("comment");
  const [aboutCell, setAboutCell] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const cell = aboutCell ? activeCell || onlyCell : "";
  const post = async () => {
    setBusy(true);
    try { const d = await api.post(`/weeks/${weekId}/comments`, { text, kind, cell, mentions: mentionIds(text, people) }); setComments((list) => (list.some((c) => c.id === d.comment.id) ? list : [...list, d.comment])); setText(""); }
    catch (e) { window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type: "error", message: messageOf(e) } })); } finally { setBusy(false); }
  };
  const updated = (c) => setComments((list) => (c.deleted ? list.filter((x) => x.id !== c.id) : list.map((x) => (x.id === c.id ? c : x))));
  const visible = comments.filter((c) => (!onlyCell || c.cell === onlyCell) && (showResolved || !c.resolved)).sort((a, b) => Number(a.resolved) - Number(b.resolved) || new Date(b.at) - new Date(a.at));
  const resolvedCount = comments.filter((c) => c.resolved && (!onlyCell || c.cell === onlyCell)).length;
  return <div className="space-y-3">
    {caps.comment && <div className="cp-compose">
      <div className="flex flex-wrap gap-1">{Object.entries(KINDS).map(([key, kindInfo]) => { const [label, Icon] = kindInfo; return <button key={key} type="button" onClick={() => setKind(key)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${kind === key ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}><Icon className="h-3 w-3" />{label}</button>; })}</div>
      <div className="mt-2"><MentionInput multiline value={text} onChange={setText} people={people} maxLength={1000} rows={3} placeholder={kind === "question" ? "Ask the team a question… (type @ to mention)" : kind === "change" ? "Describe the change you want… (type @ to mention)" : "Write a comment… type @ to mention someone"} className="w-full resize-y rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" /></div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={aboutCell} onChange={(e) => setAboutCell(e.target.checked)} className="accent-[var(--brand-primary)]" /><span className="truncate">{cell ? <>About <b>{LABELS[cell]}</b></> : "About the selected box (click a box first)"}</span></label>
        <AdminActionButton icon={Send} loading={busy} disabled={!text.trim()} onClick={post} className="!min-h-9 !px-3">Post</AdminActionButton>
      </div>
    </div>}
    {onlyCell && <button type="button" onClick={() => setOnlyCell("")} className="w-full rounded-lg bg-primary-soft px-3 py-2 text-left text-xs font-bold text-primary-dark">Showing comments on {LABELS[onlyCell]} · show all</button>}
    {visible.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No open comments. Ask questions or suggest changes here; everyone sees them at once.</p>
      : visible.map((c) => <Thread key={c.id} comment={c} me={me} caps={caps} onUpdated={updated} focusCell={focusCell} people={people} flash={c.id === flashId} />)}
    {resolvedCount > 0 && <button type="button" onClick={() => setShowResolved(!showResolved)} className="w-full text-center text-xs font-bold text-slate-500 hover:text-primary">{showResolved ? "Hide" : "Show"} {resolvedCount} resolved</button>}
  </div>;
}

function Activity({ activity, focusCell }) {
  return activity.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">No activity yet.</p> : <ol className="space-y-1">{activity.map((a) => <li key={a.id} className="flex gap-2.5 rounded-xl p-2 hover:bg-slate-50">
    <Avatar name={a.byName} size={24} />
    <p className="min-w-0 flex-1 text-sm text-slate-700"><b>{a.byName}</b> {a.action}{a.cell && <> <button type="button" onClick={() => focusCell(a.cell)} className="font-bold text-primary hover:underline">{a.cellLabel}</button></>}{a.detail && <span className="block truncate text-xs text-slate-500">“{a.detail}”</span>}<span className="block text-[11px] text-slate-400">{timeAgo(a.at)}</span></p>
  </li>)}</ol>;
}

function VersionDialog({ weekId, version, caps, status, onClose, onRestored }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get(`/weeks/${weekId}/versions/${version.id}`).then(setData).catch((e) => setError(messageOf(e))); }, [weekId, version.id]);
  const restore = async () => { setBusy(true); try { await api.post(`/weeks/${weekId}/versions/${version.id}/restore`); onRestored(); onClose(); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };
  return <Dialog wide title={version.note || "Saved version"} subtitle={`${version.byName ? `${version.byName} · ` : ""}${new Date(version.at).toLocaleString("en-GB")}`} onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Close</AdminActionButton>{caps.edit && <AdminActionButton icon={RotateCcw} loading={busy} disabled={status !== "draft" || !data?.changed.length} onClick={restore}>Restore this version</AdminActionButton>}</>}>
    {status !== "draft" && caps.edit && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Reopen the week to restore an older version.</p>}
    {!data ? <p className="text-sm text-slate-500">{error || "Loading…"}</p> : data.changed.length === 0 ? <p className="text-sm text-slate-500">This version is the same as the week now.</p> : <div className="space-y-3">
      <p className="text-sm text-slate-600">{data.changed.length} box{data.changed.length > 1 ? "es are" : " is"} different from now:</p>
      {data.changed.map((c) => <div key={c.key} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{c.label}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900"><span className="mb-1 block text-[11px] font-bold uppercase text-rose-700">In this version</span><span className="whitespace-pre-wrap">{c.then || "(empty)"}</span></div><div className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900"><span className="mb-1 block text-[11px] font-bold uppercase text-emerald-700">Now</span><span className="whitespace-pre-wrap">{c.now || "(empty)"}</span></div></div></div>)}
    </div>}
    {error && data && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

function Versions({ weekId, versions, caps, status, onRestored, onSaved }) {
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api.post(`/weeks/${weekId}/versions`, { note }); setNote(""); onSaved(); } catch (e) { window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type: "error", message: messageOf(e) } })); } finally { setBusy(false); } };
  return <div className="space-y-3">
    {caps.edit && <div className="flex gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Name this version (optional)" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary" /><AdminActionButton icon={Save} loading={busy} onClick={save} className="!min-h-10 !px-3">Save</AdminActionButton></div>}
    <p className="text-xs text-slate-500">A copy is also kept automatically every 10 minutes while people edit, and at every submit, approval and reopen.</p>
    <ol className="space-y-1.5">{versions.map((v) => <li key={v.id}><button type="button" onClick={() => setOpen(v)} className="w-full rounded-xl border border-slate-200 p-2.5 text-left transition-colors hover:border-primary-muted hover:bg-slate-50"><p className="truncate text-sm font-bold text-slate-800">{v.note || "Saved version"}</p><p className="text-xs text-slate-500">{v.byName ? `${v.byName} · ` : ""}{new Date(v.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></button></li>)}</ol>
    {versions.length === 0 && <p className="text-center text-sm text-slate-500">No saved versions yet.</p>}
    {open && <VersionDialog weekId={weekId} version={open} caps={caps} status={status} onClose={() => setOpen(null)} onRestored={onRestored} />}
  </div>;
}

export default function SidePanel({ tab, setTab, data, comments, setComments, activity, onReload, activeCell, onlyCell, setOnlyCell, focusCell, flashId }) {
  const open = comments.filter((c) => !c.resolved).length;
  const tabs = [["comments", "Comments", MessageSquare, open], ["activity", "Activity", Zap], ["history", "History", History]];
  return <aside className="cp-panel">
    <div role="tablist" className="cp-tabs">{tabs.map((t) => { const [key, label, Icon, n] = t; return <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}><Icon className="h-4 w-4" />{label}{n ? <span>{n}</span> : null}</button>; })}</div>
    <div className="cp-body">
      {tab === "comments" && <Comments weekId={data.week.id} comments={comments} setComments={setComments} me={data.me.id} caps={data.caps} activeCell={activeCell} onlyCell={onlyCell} setOnlyCell={setOnlyCell} focusCell={focusCell} people={data.people || []} flashId={flashId} />}
      {tab === "activity" && <Activity activity={activity} focusCell={focusCell} />}
      {tab === "history" && <Versions weekId={data.week.id} versions={data.versions} caps={data.caps} status={data.week.status} onRestored={onReload} onSaved={onReload} />}
    </div>
  </aside>;
}
