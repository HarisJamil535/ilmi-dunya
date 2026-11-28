import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trash2, ArrowLeft, CalendarClock, CheckCircle2, Download, FileText, FileUp, MessageSquare, PenLine, Plus, QrCode, Search } from "lucide-react";
import { AdminActionButton } from "../components/AdminUI";
import SharedSelect from "../../shared/CustomSelect";
import { CoordLoader, Avatar, Dialog, Field, RoleBadge, StatusChip, inputClass } from "./CoordUI";
import SignatureDialog from "./SignatureDialog";
import ConfirmModal from "../../shared/ConfirmModal";
import DownloadDialog from "./DownloadDialog";
import AnnouncementCenter from "./AnnouncementCenter";
import { useLiveRefresh } from "./useCoordEvent";
import { ROLE_LABEL, api, messageOf, roleTheme, timeAgo } from "./coordApi";
import "./coordination.css";

// 1st Term | 2nd Term: each term is its own file (weeks start from 1 again). Opens the other term's file,
// or starts it with the same department, class, session and sections.
function TermSwitch({ file, navigate }) {
  const [busy, setBusy] = useState(false);
  if (!file.classLevel || !file.otherTerm) return null;
  const canStart = file.caps.manage || ["coordinator", "sectionHead"].includes(file.role);
  const start = async () => {
    setBusy(true);
    try {
      const d = await api.post("/files", { departmentId: file.department.id, classLevel: file.classLevel, session: file.session, term: file.otherTerm.term, sections: file.sections });
      navigate(`/admin/coordination/${d.id}`);
    } catch (e) { window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type: "error", message: messageOf(e) } })); }
    setBusy(false);
  };
  const tabs = [1, 2].map((term) => {
    const name = term === 1 ? "1st Term" : "2nd Term";
    if (term === file.term) return <span key={term} className="is-on" aria-current="page">{name}</span>;
    if (file.otherTerm.id) return <Link key={term} to={`/admin/coordination/${file.otherTerm.id}`}>{name}</Link>;
    if (canStart) return <button key={term} type="button" disabled={busy} onClick={start}><Plus className="h-3.5 w-3.5" />{busy ? "Starting…" : `Start ${name}`}</button>;
    return <span key={term} className="is-off" title={`The ${name} file has not been started yet`}>{name}</span>;
  });
  return <nav className="coord-terms" aria-label="Term">{tabs}</nav>;
}

function NewWeekDialog({ file, weeks, onClose, onCreated }) {
  const next = (weeks.reduce((max, w) => Math.max(max, w.week), 0) || 0) + 1;
  const [form, setForm] = useState({ week: String(Math.min(60, next)), dueDate: "", start: weeks.length ? "previous" : "blank", copyFrom: "" });
  const [sources, setSources] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get(`/files/${file.id}/copy-sources`).then((d) => setSources(d.weeks)).catch(() => setSources([])); }, [file.id]);
  const create = async () => {
    setBusy(true); setError("");
    const copyFrom = form.start === "previous" ? weeks.at(-1)?.id : form.start === "other" ? form.copyFrom : "";
    try { const d = await api.post(`/files/${file.id}/weeks`, { week: Number(form.week), dueDate: form.dueDate || undefined, copyFrom: copyFrom || undefined }); onCreated(d.id); }
    catch (e) { setError(messageOf(e)); setBusy(false); }
  };
  const starts = [["blank", "Blank page"], ...(weeks.length ? [["previous", `Copy of week ${weeks.at(-1).week}`]] : []), ["other", "Copy another week (also earlier sessions)"]];
  return <Dialog title="Add a week" onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={Plus} loading={busy} disabled={!form.week || (form.start === "other" && !form.copyFrom)} onClick={create}>Add week</AdminActionButton></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Week number" hint={`${file.termName}: weeks start from 1`}><input className={inputClass} type="number" min="1" max="60" value={form.week} onChange={(e) => setForm({ ...form, week: e.target.value })} /></Field>
      <Field label="Due date (optional)"><input className={inputClass} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
    </div>
    <fieldset><legend className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Start from</legend>
      <div className="grid gap-2">{starts.map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold transition-colors ${form.start === value ? "border-primary bg-primary-soft text-primary-dark" : "border-slate-200 text-slate-700 hover:border-primary-muted"}`}><input type="radio" name="start" className="accent-[var(--brand-primary)]" checked={form.start === value} onChange={() => setForm({ ...form, start: value })} />{label}</label>)}</div>
    </fieldset>
    {form.start === "other" && <SharedSelect label="Week to copy" searchable isLoading={!sources} value={form.copyFrom} onChange={(copyFrom) => setForm({ ...form, copyFrom })} placeholder="Choose a week" options={(sources || []).map((s) => ({ value: s.id, label: s.label }))} />}
    <p className="text-xs text-slate-500">A copy brings over the plan (topics, methods, resources, AFL, work). Dates and signatures always start empty.</p>
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

// Import from Word: one file with every week, or many files at once (one per week), chosen or dropped together.
function ImportDialog({ file, onClose, onDone }) {
  const [picked, setPicked] = useState([]);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const add = (list) => {
    const files = [...(list || [])];
    const words = files.filter((f) => /\.docx$/i.test(f.name));
    setError(words.length < files.length ? `${files.length - words.length} file(s) were not Word (.docx) files and were left out. In Word, use Save As > Word Document (.docx).` : "");
    setPicked((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      return [...current, ...words.filter((f) => !seen.has(`${f.name}:${f.size}`))].slice(0, 60);
    });
  };
  const run = async () => {
    setBusy(true); setError("");
    try {
      const data = new FormData(); picked.forEach((f) => data.append("files", f)); data.append("replace", String(replace));
      const d = await api.post(`/files/${file.id}/import`, data, { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 });
      setResult(d.results); onDone();
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  const total = picked.reduce((sum, f) => sum + f.size, 0);
  const imported = result ? result.filter((r) => r.result === "imported").length : 0;
  return <Dialog title="Import from Word" subtitle="Upload one Word file with all the weeks, or select many files at once (one per week). Every week table becomes a week here, with its formatting." onClose={onClose} busy={busy}
    footer={result ? <AdminActionButton onClick={onClose}>Done</AdminActionButton> : <><AdminActionButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</AdminActionButton><AdminActionButton icon={FileUp} loading={busy} disabled={!picked.length} onClick={run}>{busy ? "Importing…" : picked.length > 1 ? `Import ${picked.length} files` : "Import"}</AdminActionButton></>}>
    {result ? <>
      <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{imported} week{imported === 1 ? "" : "s"} imported{result.length > imported ? ` · ${result.length - imported} not imported (see below)` : ""}</p>
      <ul className="max-h-80 space-y-2 overflow-y-auto">{result.map((r, i) => <li key={`${r.week}-${r.source}-${i}`} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${r.error ? "bg-rose-50" : "bg-slate-50"}`}><CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${r.result === "imported" ? "text-emerald-600" : r.error ? "text-rose-500" : "text-slate-400"}`} /><span className="min-w-0">{r.week ? <b>Week {r.week} </b> : null}<span className="text-slate-600">{r.result}</span>{r.source && <span className="block truncate text-xs text-slate-400">{r.source}</span>}</span></li>)}</ul>
    </> : <>
      <label onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-7 text-center text-sm font-bold text-slate-600 transition ${dragging ? "border-primary bg-primary-soft" : "border-slate-300 bg-slate-50 hover:border-primary-muted"}`}>
        <FileUp className="h-7 w-7 text-primary" />{picked.length ? "Add more Word files" : "Choose Word files (.docx), or drop them here"}
        <span className="text-xs font-medium text-slate-500">One file with the whole term, or many files at once (select them together). Up to 60 files, 10 MB each.</span>
        <input type="file" multiple accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {picked.length > 0 && <div className="rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-500"><span>{picked.length} file{picked.length === 1 ? "" : "s"} · {(total / 1048576).toFixed(1)} MB</span><button type="button" onClick={() => setPicked([])} className="text-rose-600 hover:underline">Remove all</button></div>
        <ul className="max-h-48 overflow-y-auto">{picked.map((f, i) => <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 border-t border-slate-50 px-3 py-2 text-sm first:border-t-0"><FileText className="h-4 w-4 shrink-0 text-sky-600" /><span className="min-w-0 flex-1 truncate">{f.name}</span><button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPicked((all) => all.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></li>)}</ul>
      </div>}
      <p className="text-xs text-slate-500">Week numbers come from each file's "Week:" line, or from the file name (for example <b>week_16.docx</b>).</p>
      <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" className="mt-1 accent-[var(--brand-primary)]" checked={replace} onChange={(e) => setReplace(e.target.checked)} /><span><b>Replace weeks that already exist</b><br /><span className="text-xs text-slate-500">Only draft weeks are replaced; the old content stays in each week's history. Submitted and approved weeks are never touched.</span></span></label>
    </>}
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

export default function CoordinationFile() {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState(null);
  const load = () => api.get(`/files/${fileId}`).then(setData).catch((e) => setError(messageOf(e)));
  useEffect(() => { load(); }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(load, fileId); // other people's edits, new weeks and signatures appear without a refresh
  const weeks = useMemo(() => (data?.weeks || []).filter((w) => (filter === "all" || (filter === "overdue" ? w.status !== "approved" && w.dueDate && new Date(w.dueDate) < new Date() : filter === "comments" ? w.openComments > 0 : w.status === filter)) && (!query || `week ${w.week} ${w.term}`.toLowerCase().includes(query.toLowerCase()))), [data, filter, query]);
  const removeWeek = async (w) => {
    try { await api.del(`/weeks/${w.id}`); window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type: "success", message: `Week ${w.week} deleted.` } })); load(); }
    catch (e) { setError(messageOf(e)); } finally { setDeleting(null); }
  };
  const toggleQr = async () => { try { await api.patch(`/files/${fileId}`, { showQr: !data.file.showQr }); load(); } catch (e) { setError(messageOf(e)); } };
  const saveSections = async (sections) => { try { await api.patch(`/files/${fileId}`, { sections }); load(); } catch (e) { setError(messageOf(e)); } };

  if (error && !data) return <div className="mx-auto max-w-3xl"><p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p><Link to="/admin/coordination" className="mt-3 inline-block text-sm font-bold text-primary">Back to coordination files</Link></div>;
  if (!data) return <CoordLoader label="Loading the file..." />;
  const { file } = data;
  const counts = file.counts;
  const filters = [["all", "All", data.weeks.length], ["draft", "Drafts", counts.draft], ["submitted", "Awaiting approval", counts.submitted], ["approved", "Approved", counts.approved], ["overdue", "Overdue", counts.overdue], ["comments", "Open comments", data.weeks.filter((w) => w.openComments).length]];

  return <div className="coord-root mx-auto max-w-6xl space-y-5">
    <AnnouncementCenter left={<Link to="/admin/coordination" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-primary"><ArrowLeft className="h-4 w-4" />All coordination files</Link>} />
    <header className="coord-hero is-vivid" style={{ "--dept": roleTheme(file.role) }}>
      <div className="min-w-0">
        <p className="coord-eyebrow">{file.department.name || "No department"} · {file.session} · {file.termName}</p>
        <h1 className="flex flex-wrap items-center gap-3">{file.subject.name}<span className="coord-class">{file.subject.className || "–"}</span></h1>
        <TermSwitch file={file} navigate={navigate} />
        <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-white/80">You are</span><RoleBadge role={file.role} />{file.role === "principal" && <span className="text-sm text-white/80">view and download</span>}</div>
        <div className="coord-stats">
          <span><b>{counts.total}</b>weeks</span><span className="is-green"><b>{counts.approved}</b>approved</span><span className="is-blue"><b>{counts.submitted}</b>awaiting</span><span className="is-amber"><b>{counts.draft}</b>drafts</span>{counts.overdue > 0 && <span className="is-red"><b>{counts.overdue}</b>overdue</span>}
        </div>
        {file.members.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2">{file.members.map((m) => <span key={m.admin} className="coord-member"><Avatar name={m.name} size={24} />{m.name}<RoleBadge role={m.role === "coordinator" ? "coordinator" : "teacher"} small /></span>)}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminActionButton variant="secondary" icon={PenLine} onClick={() => setDialog("signature")}>My signature</AdminActionButton>
        <AdminActionButton variant="secondary" icon={Download} disabled={!data.weeks.length} onClick={() => setDialog("download")}>Download</AdminActionButton>
        {file.caps.deleteWeek && data.weeks.length > 0 && <AdminActionButton variant="secondary" icon={Trash2} onClick={() => setDialog("delete")}>Delete weeks</AdminActionButton>}
        {file.caps.edit && <AdminActionButton variant="secondary" icon={FileUp} onClick={() => setDialog("import")}>Import Word</AdminActionButton>}
        {file.caps.edit && <AdminActionButton icon={Plus} onClick={() => setDialog("new")}>Add week</AdminActionButton>}
      </div>
    </header>

    {(file.caps.manage || file.caps.signCoordinator || file.caps.signSectionHead) && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
      <label className="flex items-center gap-2 font-bold text-slate-600">No. of sections <input className={`${inputClass} !min-h-9 w-24`} defaultValue={file.sections} maxLength={20} onBlur={(e) => e.target.value !== file.sections && saveSections(e.target.value)} /></label>
      <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-600"><input type="checkbox" className="accent-[var(--brand-primary)]" checked={file.showQr} onChange={toggleQr} /><QrCode className="h-4 w-4" />Verification QR code on approved weeks</label>
    </div>}

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="coord-filters" role="tablist" aria-label="Show weeks">{filters.map(([key, label, n]) => <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>{label}<span>{n}</span></button>)}</div>
      <label className="relative block sm:w-56"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={`${inputClass} pl-9`} placeholder="Find a week" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    </div>
    {error && <p role="alert" className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}

    {data.weeks.length === 0 ? <div className="coord-empty">
      <CalendarClock className="h-10 w-10 text-primary" />
      <h2>No weeks yet</h2>
      <p>Add the first week, or import a ready coordination file from Word.</p>
      {file.caps.edit && <div className="flex flex-wrap justify-center gap-2"><AdminActionButton variant="secondary" icon={FileUp} onClick={() => setDialog("import")}>Import Word</AdminActionButton><AdminActionButton icon={Plus} onClick={() => setDialog("new")}>Add week</AdminActionButton></div>}
    </div> : <div className="coord-weeks">{weeks.map((w, wi) => {
      const overdue = w.status !== "approved" && w.dueDate && new Date(w.dueDate) < new Date();
      return <Link key={w.id} to={`/admin/coordination/week/${w.id}`} className={`coord-week coord-stagger is-${w.status}`} style={{ "--i": Math.min(wi, 14) }}>
        <div className="flex items-start justify-between gap-2"><span className="coord-week-no">Week<b>{w.week}</b></span><StatusChip status={w.status} /></div>
        {w.term && <p className="text-xs font-bold text-slate-500">{w.term}</p>}
        <div className="mt-auto space-y-1.5 text-xs text-slate-500">
          {w.dueDate && <p className={overdue ? "font-bold text-rose-600" : ""}><CalendarClock className="mr-1 inline h-3.5 w-3.5" />Due {new Date(w.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{overdue ? " · overdue" : ""}</p>}
          {w.openComments > 0 && <p className="font-bold text-amber-700"><MessageSquare className="mr-1 inline h-3.5 w-3.5" />{w.openComments} open comment{w.openComments > 1 ? "s" : ""}</p>}
          <p>{w.lastEditBy ? `${w.lastEditBy} · ` : ""}{timeAgo(w.lastEditAt)}</p>
          <p className="flex gap-2"><span className={w.signed.coordinator ? "text-emerald-700" : ""}>{w.signed.coordinator ? "✓" : "○"} Coordinator</span><span className={w.signed.sectionHead ? "text-emerald-700" : ""}>{w.signed.sectionHead ? "✓" : "○"} SH</span></p>
        </div>
        {file.caps.deleteWeek && <button type="button" className="coord-week-del" aria-label={`Delete week ${w.week}`} title={`Delete week ${w.week}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleting(w); }}><Trash2 className="h-4 w-4" /></button>}
      </Link>;
    })}{weeks.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No weeks match.</p>}</div>}

    {dialog === "new" && <NewWeekDialog file={file} weeks={data.weeks} onClose={() => setDialog("")} onCreated={(id) => navigate(`/admin/coordination/week/${id}`)} />}
    {dialog === "import" && <ImportDialog file={file} onClose={() => setDialog("")} onDone={load} />}
    {dialog === "delete" && <DownloadDialog mode="delete" fileId={file.id} title={`${file.subject.name} ${file.subject.className}`} weeks={data.weeks} onClose={() => setDialog("")} onDeleted={load} />}
    {deleting && <ConfirmModal isOpen tone="danger" title={`Delete week ${deleting.week}?`} description="Its content, comments and history will be deleted for everyone. This cannot be undone." confirmLabel="Delete week" onConfirm={() => removeWeek(deleting)} onClose={() => setDeleting(null)} />}
    {dialog === "download" && <DownloadDialog fileId={file.id} title={`${file.subject.name} ${file.subject.className}`} weeks={data.weeks} onClose={() => setDialog("")} />}
    {dialog === "signature" && <SignatureDialog ink={file.caps.signSectionHead ? "pink" : "blue"} onClose={() => setDialog("")} />}
  </div>;
}
