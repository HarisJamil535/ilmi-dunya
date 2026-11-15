import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, FilePlus2, PenLine, Plus, Settings2, Trash2, Users, UsersRound } from "lucide-react";
import { AdminActionButton, AdminLoader } from "../components/AdminUI";
import SharedSelect from "../../shared/CustomSelect";
import ImagePicker from "../../shared/ImagePicker";
import ConfirmModal from "../../shared/ConfirmModal";
import { Avatar, Dialog, Field, inputClass } from "./CoordUI";
import SignatureDialog from "./SignatureDialog";
import { ROLE_HINT, ROLE_LABEL, api, messageOf } from "./coordApi";
import "./coordination.css";

const thisSession = () => { const now = new Date(); const start = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1; return `${start}-${start + 1}`; };

function NewFileDialog({ onClose, onCreated }) {
  const [subjects, setSubjects] = useState(null);
  const [form, setForm] = useState({ subjectId: "", session: thisSession(), sections: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/subjects").then((d) => setSubjects(d.subjects || [])).catch((e) => { setSubjects([]); setError(messageOf(e, "The subject list could not be loaded. Close this window and try again.")); }); }, []);
  const create = async () => {
    setBusy(true); setError("");
    try { const d = await api.post("/files", form); onCreated(d.file); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return <Dialog title="New coordination file" subtitle="One file per subject and class for a session. Each week of the session is one page." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={FilePlus2} loading={busy} disabled={!form.subjectId || !/^\d{4}-\d{4}$/.test(form.session)} onClick={create}>Create file</AdminActionButton></>}>
    <SharedSelect label="Subject and class" searchable isLoading={!subjects} value={form.subjectId} onChange={(subjectId) => setForm({ ...form, subjectId })} placeholder="Choose a subject"
      options={(subjects || []).map((s) => ({ value: s.id, label: `${s.name} — ${s.className}${s.group ? ` (${s.group})` : ""} · ${s.board}` }))} />
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Session" hint="For example 2026-2027"><input className={inputClass} value={form.session} maxLength={9} onChange={(e) => setForm({ ...form, session: e.target.value })} /></Field>
      <Field label="No. of sections" hint="Printed at the top of every week"><input className={inputClass} value={form.sections} maxLength={20} onChange={(e) => setForm({ ...form, sections: e.target.value })} placeholder="e.g. 5" /></Field>
    </div>
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

function MembersDialog({ file, onClose, onSaved }) {
  const [people, setPeople] = useState(null);
  const [members, setMembers] = useState(file.members.map((m) => ({ admin: m.admin, role: m.role })));
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/people").then((d) => setPeople(d.people || [])).catch((e) => { setPeople([]); setError(messageOf(e)); }); }, []);
  const byId = useMemo(() => new Map((people || []).map((p) => [p.id, p])), [people]);
  const add = (id) => { if (id && !members.some((m) => m.admin === id)) setMembers([...members, { admin: id, role: "editor" }]); setAdding(""); };
  const save = async () => {
    setBusy(true); setError("");
    try { const d = await api.patch(`/files/${file.id}`, { members }); onSaved(d.file); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  const roleOptions = Object.keys(ROLE_HINT).map((value) => ({ value, label: ROLE_LABEL[value] }));
  return <Dialog wide title={`People — ${file.subject.name} ${file.subject.classLabel ? `(Class ${file.subject.classLabel})` : ""}`} subtitle="Only the people listed here can open this file. Choose what each person may do." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={Users} loading={busy} onClick={save}>Save people</AdminActionButton></>}>
    <SharedSelect label="Add a person" searchable isLoading={!people} value={adding} onChange={add} placeholder="Choose someone to add"
      options={(people || []).filter((p) => !members.some((m) => m.admin === p.id)).map((p) => ({ value: p.id, label: `${p.name} · ${p.email}` }))} />
    <p className="text-xs text-slate-500">Not in the list? In <Link to="/admin/admin-management" className="font-bold text-primary underline">Admin Management</Link>, create the account (or edit an existing one) and tick “Coordination records”.</p>
    {members.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No one is added yet.</p>
      : <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">{members.map((m, i) => {
        const p = byId.get(m.admin) || file.members.find((x) => x.admin === m.admin) || {};
        return <li key={m.admin} className="flex flex-wrap items-center gap-3 p-3">
          <Avatar name={p.name} size={36} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{p.name || "Unknown"}</p><p className="truncate text-xs text-slate-500">{p.email}</p></div>
          <div className="w-full sm:w-56"><SharedSelect size="sm" allowClear={false} value={m.role} onChange={(role) => setMembers(members.map((x, j) => (j === i ? { ...x, role } : x)))} options={roleOptions} /><p className="mt-1 text-[11px] text-slate-500">{ROLE_HINT[m.role]}</p></div>
          <button type="button" onClick={() => setMembers(members.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`} className="grid h-9 w-9 place-items-center rounded-xl text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
        </li>;
      })}</ul>}
    {members.length > 0 && !members.some((m) => m.role === "coordinator") && <p className="flex items-center gap-2 text-xs font-bold text-amber-700"><AlertTriangle className="h-4 w-4" />Add a Subject Coordinator so weeks can be submitted.</p>}
    {members.length > 0 && !members.some((m) => m.role === "sectionHead") && <p className="flex items-center gap-2 text-xs font-bold text-amber-700"><AlertTriangle className="h-4 w-4" />Add a Section Head so weeks can be approved.</p>}
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

function SettingsDialog({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/settings").then((d) => setSettings({ ...d.settings, picks: Object.fromEntries(Object.entries(d.settings.quickPicks || {}).map(([k, v]) => [k, (v || []).join("\n")])) })).catch((e) => setError(messageOf(e))); }, []);
  const set = (patch) => setSettings({ ...settings, ...patch });
  const uploadWatermark = async (file) => {
    const data = new FormData(); data.append("image", file);
    return (await api.post("/settings/watermark", data, { headers: { "Content-Type": "multipart/form-data" } })).imageUrl;
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      await api.put("/settings", { title: settings.title, footerText: settings.footerText, caption: settings.caption, watermarkUrl: settings.watermarkUrl, watermarkOpacity: settings.watermarkOpacity, quickPicks: Object.fromEntries(Object.entries(settings.picks).map(([k, v]) => [k, v.split("\n").map((x) => x.trim()).filter(Boolean)])) });
      onClose();
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return <Dialog wide title="Record settings" subtitle="The look of every coordination record: title, watermark, footer and the quick-pick lists." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={Settings2} loading={busy} disabled={!settings} onClick={save}>Save settings</AdminActionButton></>}>
    {!settings ? <AdminLoader /> : <>
      <Field label="Title" hint="{session} is replaced with the file's session, e.g. 2026-2027."><input className={inputClass} maxLength={140} value={settings.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Footer text"><input className={inputClass} maxLength={140} value={settings.footerText} onChange={(e) => set({ footerText: e.target.value })} /></Field>
        <Field label="Caption under the signatures" hint="Leave empty to hide it."><input className={inputClass} maxLength={140} value={settings.caption} onChange={(e) => set({ caption: e.target.value })} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div><p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Watermark (school crest)</p>
          <ImagePicker value={settings.watermarkUrl} onChange={(watermarkUrl) => set({ watermarkUrl })} upload={uploadWatermark} label="Watermark" maxMb={5} accept={["image/png", "image/jpeg"]} hint="PNG or JPG. It is printed pale and grey in the middle of every page." /></div>
        <Field label={`Strength ${Math.round((settings.watermarkOpacity || 0.12) * 100)}%`} hint="How visible the watermark is."><input type="range" min="0.05" max="0.3" step="0.01" value={settings.watermarkOpacity || 0.12} onChange={(e) => set({ watermarkOpacity: Number(e.target.value) })} className="w-full accent-[var(--brand-primary)]" /></Field>
      </div>
      <div><p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Quick picks (one per line)</p>
        <p className="mb-2 text-xs text-slate-500">Teachers tap these to add them while editing, instead of typing them every week.</p>
        <div className="grid gap-3 sm:grid-cols-3">{[["methods", "Methodologies"], ["afl", "AFL Strategies"], ["resources", "Resources"]].map(([key, name]) => <Field key={key} label={name}><textarea className={`${inputClass} min-h-40 py-2`} value={settings.picks[key] || ""} onChange={(e) => set({ picks: { ...settings.picks, [key]: e.target.value } })} /></Field>)}</div>
      </div>
    </>}
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

export default function CoordinationHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const load = () => api.get("/files").then(setData).catch((e) => setError(messageOf(e)));
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => {
    const map = new Map();
    for (const f of data?.files || []) { const key = `${f.session} · ${f.subject.className || "Other"}`; if (!map.has(key)) map.set(key, []); map.get(key).push(f); }
    return [...map.entries()];
  }, [data]);
  const remove = async (file) => { try { await api.del(`/files/${file.id}`); load(); } catch (e) { setError(messageOf(e)); } finally { setConfirm(null); } };

  return <div className="coord-root mx-auto max-w-6xl space-y-6">
    <header className="coord-hero">
      <div className="min-w-0">
        <p className="coord-eyebrow"><UsersRound className="h-4 w-4" />Weekly Subject Coordination</p>
        <h1>Coordination records</h1>
        <p className="coord-lead">Plan each week together, live. Comment, sign and download the finished record in Word or PDF.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminActionButton variant="secondary" icon={PenLine} onClick={() => setDialog({ type: "signature" })}>My signature</AdminActionButton>
        {data?.canManage && <AdminActionButton variant="secondary" icon={Settings2} onClick={() => setDialog({ type: "settings" })}>Record settings</AdminActionButton>}
        {data?.canManage && <AdminActionButton icon={Plus} onClick={() => setDialog({ type: "new" })}>New file</AdminActionButton>}
      </div>
    </header>
    {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>}
    {!data ? <AdminLoader label="Loading coordination files..." /> : data.files.length === 0 ? <div className="coord-empty">
      <UsersRound className="h-10 w-10 text-primary" />
      <h2>{data.canManage ? "Create the first coordination file" : "No coordination files yet"}</h2>
      <p>{data.canManage ? "Choose a subject and class, then add the people who will plan, sign and approve it." : "When a manager adds you to a subject's file, it will appear here."}</p>
      {data.canManage && <AdminActionButton icon={Plus} onClick={() => setDialog({ type: "new" })}>New file</AdminActionButton>}
    </div> : groups.map(([group, files]) => <section key={group} className="space-y-3">
      <h2 className="coord-group">{group}</h2>
      <div className="grid gap-3 md:grid-cols-2">{files.map((f) => {
        const pct = f.counts.total ? Math.round((f.counts.approved / f.counts.total) * 100) : 0;
        return <article key={f.id} className="coord-card">
          <Link to={`/admin/coordination/${f.id}`} className="coord-card-main">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3>{f.subject.name}</h3><p>{[f.subject.className, f.subject.group, f.subject.board].filter(Boolean).join(" · ")}</p></div>
              <span className="coord-role">{ROLE_LABEL[f.role] || f.role}</span>
            </div>
            <div className="coord-progress" aria-label={`${f.counts.approved} of ${f.counts.total} weeks approved`}><span style={{ width: `${pct}%` }} /></div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
              <span><b className="text-slate-800">{f.counts.total}</b> weeks</span>
              <span className="text-emerald-700">{f.counts.approved} approved</span>
              {f.counts.submitted > 0 && <span className="text-sky-700">{f.counts.submitted} awaiting approval</span>}
              {f.counts.overdue > 0 && <span className="text-rose-600">{f.counts.overdue} overdue</span>}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">{f.members.slice(0, 6).map((m) => <Avatar key={m.admin} name={m.name} size={28} ring title={`${m.name} — ${ROLE_LABEL[m.role]}`} />)}{f.members.length > 6 && <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-[10px] font-black text-slate-600 ring-2 ring-white">+{f.members.length - 6}</span>}</div>
              <ChevronRight className="coord-arrow h-5 w-5" />
            </div>
          </Link>
          {f.caps.manage && <div className="coord-card-tools">
            <button type="button" onClick={() => setDialog({ type: "members", file: f })}><Users className="h-4 w-4" />People ({f.members.length})</button>
            <button type="button" className="is-danger" onClick={() => setConfirm(f)}><Trash2 className="h-4 w-4" />Delete</button>
          </div>}
        </article>;
      })}</div>
    </section>)}

    {dialog?.type === "new" && <NewFileDialog onClose={() => setDialog(null)} onCreated={(file) => { load(); setDialog({ type: "members", file }); }} />}
    {dialog?.type === "members" && <MembersDialog file={dialog.file} onClose={() => setDialog(null)} onSaved={() => { load(); setDialog(null); }} />}
    {dialog?.type === "settings" && <SettingsDialog onClose={() => setDialog(null)} />}
    {dialog?.type === "signature" && <SignatureDialog onClose={() => setDialog(null)} />}
    <ConfirmModal isOpen={Boolean(confirm)} tone="danger" title="Delete this coordination file?" description={confirm ? `${confirm.subject.name} (${confirm.session}) and all its weeks, comments and history will be deleted. This cannot be undone.` : ""} confirmLabel="Delete file" onConfirm={() => remove(confirm)} onClose={() => setConfirm(null)} />
  </div>;
}
