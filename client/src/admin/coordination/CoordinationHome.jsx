import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, CalendarCheck2, Check, ChevronRight, Clock3, Copy, Crown, Download, FilePlus2, FolderOpen, KeyRound, PenLine, Plus, Settings2, ShieldCheck, Trash2, UserPlus, Users, UsersRound } from "lucide-react";
import { AdminActionButton } from "../components/AdminUI";
import SharedSelect from "../../shared/CustomSelect";
import ImagePicker from "../../shared/ImagePicker";
import ConfirmModal from "../../shared/ConfirmModal";
import { CoordLoader, Avatar, Dialog, Field, RoleBadge, inputClass } from "./CoordUI";
import AnnouncementCenter from "./AnnouncementCenter";
import DownloadDialog from "./DownloadDialog";
import { useLiveRefresh } from "./useCoordEvent";
import SignatureDialog from "./SignatureDialog";
import InboxPanel from "./InboxPanel";
import { api, deptColour, messageOf, roleTheme } from "./coordApi";
import "./coordination.css";

const thisSession = () => { const now = new Date(); const start = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1; return `${start}-${start + 1}`; };
const TITLE_OPTIONS = [
  ["teacher", "Teacher", "Views and edits their department's files."],
  ["coordinator", "Subject Coordinator", "Also submits and signs. One per department."],
  ["sectionHead", "Section Head", "Every department. Edits, approves and signs. One for the school."],
  ["principal", "Principal", "Every department. Views, comments and downloads. One for the school."],
];
const toast = (message, type = "success") => window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type, message } }));

function NewFileDialog({ overview, onClose, onCreated }) {
  const mine = overview.me.title === "coordinator" ? overview.me.department : "";
  const [form, setForm] = useState({ departmentId: mine || (overview.departments.length === 1 ? overview.departments[0].id : ""), classLevel: "", session: thisSession(), term: 1, sections: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    setBusy(true); setError("");
    try { const d = await api.post("/files", form); onCreated(d.id); } catch (e) { setError(messageOf(e)); setBusy(false); }
  };
  const dept = overview.departments.find((d) => d.id === form.departmentId);
  return <Dialog title="New coordination file" subtitle="Each department keeps one file per class for each term. Each term's weeks start from week 1, and each week is one page." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={FilePlus2} loading={busy} disabled={!form.departmentId || !form.classLevel || !/^\d{4}-\d{4}$/.test(form.session)} onClick={create}>Create file</AdminActionButton></>}>
    {overview.departments.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Add a department first (Departments &amp; staff).</p>
      : mine ? <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Department</p><p className="mt-1 text-base font-black" style={{ color: deptColour(dept?.id) }}>{dept?.name}</p></div>
      : <SharedSelect label="Department" allowClear={false} value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} placeholder="Choose a department" options={overview.departments.map((d) => ({ value: d.id, label: d.name }))} />}
    <fieldset><legend className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Class</legend>
      <div className="grid grid-cols-2 gap-3">{[["9", "9th"], ["10", "10th"]].map(([value, label]) => <label key={value} className={`coord-classpick ${form.classLevel === value ? "is-on" : ""}`}>
        <input type="radio" name="classLevel" className="sr-only" checked={form.classLevel === value} onChange={() => setForm({ ...form, classLevel: value })} />
        <b>{label}</b><span>{dept ? `${dept.name} ${label}` : `Class ${label}`}</span>
      </label>)}</div>
    </fieldset>
    <fieldset><legend className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Term</legend>
      <div className="grid grid-cols-2 gap-3">{[[1, "1st Term"], [2, "2nd Term"]].map(([value, label]) => <label key={value} className={`coord-classpick is-term ${form.term === value ? "is-on" : ""}`}>
        <input type="radio" name="term" className="sr-only" checked={form.term === value} onChange={() => setForm({ ...form, term: value })} />
        <b>{label}</b><span>Starts from week 1</span>
      </label>)}</div>
    </fieldset>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Session" hint="For example 2026-2027"><input className={inputClass} value={form.session} maxLength={9} onChange={(e) => setForm({ ...form, session: e.target.value })} /></Field>
      <Field label="No. of sections" hint="Printed at the top of every week"><input className={inputClass} value={form.sections} maxLength={20} onChange={(e) => setForm({ ...form, sections: e.target.value })} placeholder="e.g. 5" /></Field>
    </div>
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}

function StaffDialog({ person, preset, departments, onClose, onSaved }) {
  const editing = Boolean(person);
  const [form, setForm] = useState({ salutation: person?.salutation || preset?.salutation || "", name: person?.plainName || person?.name || "", username: person?.username || "", password: "", title: person?.title || preset?.title || "teacher", departmentId: person?.department || preset?.departmentId || "", status: person?.status || "active" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const needsDept = ["teacher", "coordinator"].includes(form.title);
  const suggest = () => setForm((f) => ({ ...f, username: f.username || f.name.toLowerCase().replace(/^(mr|ms|mrs|miss|dr|sir)\.?\s+/i, "").trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") }));
  const randomPassword = () => setForm((f) => ({ ...f, password: Array.from(crypto.getRandomValues(new Uint32Array(3))).map((n) => n.toString(36)).join("").slice(0, 10) }));
  const save = async () => {
    setBusy(true); setError("");
    try {
      const body = { salutation: form.salutation, name: form.name, username: form.username, title: form.title, departmentId: needsDept ? form.departmentId : "", ...(form.password ? { password: form.password } : {}), ...(editing ? { status: form.status } : {}) };
      if (editing) { await api.patch(`/staff/${person.id}`, body); onSaved(); onClose(); toast("Saved."); }
      else { await api.post("/staff", body); setCreated({ username: form.username.toLowerCase(), password: form.password }); onSaved(); }
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { const d = await api.del(`/staff/${person.id}`); toast(d.deleted ? `${person.name}'s account was deleted.` : `${person.name} no longer has coordination access.`); onSaved(); onClose(); }
    catch (e) { setError(messageOf(e)); setBusy(false); setConfirm(false); }
  };
  const copy = () => { navigator.clipboard?.writeText(`Sign in at ${window.location.origin}/admin/login\nUsername: ${created.username}\nPassword: ${created.password}`); toast("Sign-in details copied."); };

  if (created) return <Dialog title={`${form.name} is added`} subtitle="Share these sign-in details with them. For safety the password is not shown again." onClose={onClose}
    footer={<><AdminActionButton variant="secondary" icon={Copy} onClick={copy}>Copy details</AdminActionButton><AdminActionButton icon={Check} onClick={onClose}>Done</AdminActionButton></>}>
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm">
      <p><span className="text-slate-500">Sign in at</span> {window.location.origin}/admin/login</p>
      <p><span className="text-slate-500">Username</span> <b>{created.username}</b></p>
      <p><span className="text-slate-500">Password</span> <b>{created.password}</b></p>
    </div>
    <p className="text-xs text-slate-500">They will see only {needsDept ? "their department's files" : "the coordination files"} when they sign in, and can add their e-signature from “My signature”.</p>
  </Dialog>;

  return <Dialog title={editing ? `Edit ${person.name}` : "Add a staff member"} subtitle={editing ? "Change their details, role, department or password." : "Create their sign-in. They will only see what their role allows."} onClose={onClose} busy={busy}
    footer={<>{editing && <AdminActionButton variant="delete" icon={Trash2} onClick={() => setConfirm(true)} className="mr-auto">Remove</AdminActionButton>}<AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={editing ? Check : UserPlus} loading={busy} disabled={!form.name.trim() || !form.username.trim() || (!editing && form.password.length < 8) || (needsDept && !form.departmentId)} onClick={save}>{editing ? "Save" : "Add person"}</AdminActionButton></>}>
    <fieldset><legend className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Title</legend>
      <div className="flex flex-wrap gap-1.5">{["Mr.", "Ms.", "Mrs.", "Miss", "Dr.", "Sir", "Madam", ""].map((t) => <button key={t || "none"} type="button" aria-pressed={form.salutation === t} onClick={() => setForm({ ...form, salutation: t })} className={`min-h-9 rounded-full border px-3.5 text-sm font-bold transition-colors ${form.salutation === t ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary-muted"}`}>{t || "None"}</button>)}</div>
    </fieldset>
    <Field label="Full name" hint={form.salutation && form.name ? `Shown as “${form.salutation} ${form.name.replace(/^(mr|ms|mrs|miss|dr|sir|madam)\.?\s+/i, "")}”` : "Without Mr./Ms. — choose that above."}><input className={inputClass} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={() => !editing && suggest()} placeholder="e.g. Ammara Khan" /></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Username" hint="Used to sign in. No spaces."><input className={inputClass} value={form.username} maxLength={60} autoCapitalize="none" spellCheck={false} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })} placeholder="e.g. ammara.khan" /></Field>
      <Field label={editing ? "New password (optional)" : "Password"} hint="At least 8 characters."><div className="flex gap-2"><input className={inputClass} value={form.password} maxLength={100} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Leave empty to keep" : ""} /><button type="button" onClick={randomPassword} title="Make a password" aria-label="Make a password" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:border-primary-muted hover:text-primary"><KeyRound className="h-4 w-4" /></button></div></Field>
    </div>
    <fieldset><legend className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Role</legend>
      <div className="grid gap-2 sm:grid-cols-2">{TITLE_OPTIONS.map(([value, label, hint]) => <label key={value} className={`cursor-pointer rounded-xl border p-3 transition-colors ${form.title === value ? "border-primary bg-primary-soft" : "border-slate-200 hover:border-primary-muted"}`}>
        <input type="radio" name="title" className="sr-only" checked={form.title === value} onChange={() => setForm({ ...form, title: value })} />
        <span className={`block text-sm font-black ${form.title === value ? "text-primary-dark" : "text-slate-800"}`}>{label}</span><span className="block text-xs text-slate-500">{hint}</span>
      </label>)}</div>
    </fieldset>
    {needsDept && <SharedSelect label="Department" allowClear={false} value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} placeholder="Choose a department" options={departments.map((d) => ({ value: d.id, label: d.name }))} />}
    {editing && <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" className="accent-[var(--brand-primary)]" checked={form.status === "active"} onChange={(e) => setForm({ ...form, status: e.target.checked ? "active" : "disabled" })} />Account active (untick to block sign-in)</label>}
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
    <ConfirmModal isOpen={confirm} tone="danger" title={`Remove ${person?.name}?`} description="They will no longer be able to open coordination files. Their past comments and signatures stay on the records." confirmLabel="Remove" isLoading={busy} onConfirm={remove} onClose={() => setConfirm(false)} />
  </Dialog>;
}

function PersonRow({ person, onEdit }) {
  return <button type="button" onClick={onEdit} className={`coord-person ${person.status !== "active" ? "is-off" : ""}`}>
    <Avatar name={person.name} size={32} />
    <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold text-slate-800">{person.name}</span><span className="block truncate text-xs text-slate-500">@{person.username}{person.status !== "active" ? " · blocked" : ""}{!person.salutation && person.title !== "sectionHead" && person.title !== "principal" ? <span className="ml-1 font-bold text-amber-600">· no Mr./Ms. set</span> : null}</span></span>
    <RoleBadge role={person.title} small />
    {person.hasSignature ? <PenLine className="h-4 w-4 text-emerald-600" aria-label="Has an e-signature" /> : null}
  </button>;
}

function StaffTab({ overview, reload }) {
  const [dialog, setDialog] = useState(null);
  const [newDept, setNewDept] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const addDept = async () => {
    setBusy(true);
    try { await api.post("/departments", { name: newDept }); setNewDept(""); reload(); toast(`${newDept} department added.`); } catch (e) { toast(messageOf(e), "error"); } finally { setBusy(false); }
  };
  const setLanguage = async (d, language) => { try { await api.patch(`/departments/${d.id}`, { language }); reload(); toast(language === "ur" ? `${d.name} records are now in Urdu (right to left, Nastaleeq).` : `${d.name} records are now in English.`); } catch (e) { toast(messageOf(e), "error"); } };
  const rename = async () => { try { await api.patch(`/departments/${renaming.id}`, { name: renaming.name }); setRenaming(null); reload(); } catch (e) { toast(messageOf(e), "error"); } };
  const removeDept = async () => { try { await api.del(`/departments/${confirm.id}`); reload(); toast("Department deleted."); } catch (e) { toast(messageOf(e), "error"); } finally { setConfirm(null); } };
  const orgSlot = (key, label, Icon, hint) => {
    const person = overview.org[key];
    return <div className="coord-org">
      <span className="coord-org-icon"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        {person ? <PersonRow person={person} onEdit={() => setDialog({ person })} /> : <p className="mt-1 text-sm text-slate-500">{hint}</p>}</div>
      {!person && <AdminActionButton variant="secondary" icon={UserPlus} onClick={() => setDialog({ preset: { title: key } })}>Add</AdminActionButton>}
    </div>;
  };
  return <div className="space-y-6">
    <section className="space-y-3"><h2 className="coord-group">School-wide</h2>
      <div className="grid gap-3 md:grid-cols-2">{orgSlot("sectionHead", "Section Head", ShieldCheck, "Sees every department; approves and signs every week.")}{orgSlot("principal", "Principal", Crown, "Sees and downloads every department's files.")}</div>
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="coord-group">Departments</h2>
        <div className="flex w-full gap-2 sm:w-auto"><input className={`${inputClass} sm:w-64`} value={newDept} maxLength={60} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newDept.trim() && addDept()} placeholder="New department, e.g. Chemistry" /><AdminActionButton icon={Plus} loading={busy} disabled={!newDept.trim()} onClick={addDept}>Add</AdminActionButton></div>
      </div>
      {overview.departments.length === 0 ? <div className="coord-empty"><Building2 className="h-10 w-10 text-primary" /><h2>Add your first department</h2><p>For example Computer Science, Chemistry or English. Then add its teachers and its Subject Coordinator.</p></div>
        : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.departments.map((d, di) => {
          const coordinator = d.staff.find((p) => p.title === "coordinator");
          const teachers = d.staff.filter((p) => p.title !== "coordinator");
          return <article key={d.id} className="coord-dept coord-stagger" style={{ "--dept": deptColour(d.id), "--i": di }}>
            <div className="flex items-start justify-between gap-2">
              {renaming?.id === d.id ? <div className="flex flex-1 gap-2"><input autoFocus className={`${inputClass} !min-h-9`} value={renaming.name} maxLength={60} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setRenaming(null); }} /><AdminActionButton className="!min-h-9" onClick={rename}>Save</AdminActionButton></div>
                : <button type="button" onClick={() => setRenaming({ id: d.id, name: d.name })} className="min-w-0 text-left" title="Rename"><h3 className="truncate text-lg font-black text-slate-900">{d.name}</h3><p className="text-xs text-slate-500">{d.staff.length} staff · {d.files} file{d.files === 1 ? "" : "s"}</p></button>}
              {renaming?.id !== d.id && <button type="button" onClick={() => setConfirm(d)} aria-label={`Delete ${d.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <div className="coord-lang" role="radiogroup" aria-label={`Record language for ${d.name}`}>
              <span>Record language</span>
              <button type="button" role="radio" aria-checked={d.language !== "ur"} onClick={() => d.language === "ur" && setLanguage(d, "en")}>English</button>
              <button type="button" role="radio" aria-checked={d.language === "ur"} onClick={() => d.language !== "ur" && setLanguage(d, "ur")} className="is-urdu">اُردو</button>
            </div>
            <div className="space-y-1"><p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-500">Subject Coordinator</p>
              {coordinator ? <PersonRow person={coordinator} onEdit={() => setDialog({ person: coordinator })} /> : <button type="button" onClick={() => setDialog({ preset: { title: "coordinator", departmentId: d.id } })} className="coord-slot"><UserPlus className="h-4 w-4" />Add the Subject Coordinator</button>}
            </div>
            <div className="space-y-1"><p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-500">Teachers</p>
              {teachers.map((p) => <PersonRow key={p.id} person={p} onEdit={() => setDialog({ person: p })} />)}
              <button type="button" onClick={() => setDialog({ preset: { title: "teacher", departmentId: d.id } })} className="coord-slot"><UserPlus className="h-4 w-4" />Add a teacher</button>
            </div>
          </article>;
        })}</div>}
    </section>
    {dialog && <StaffDialog person={dialog.person} preset={dialog.preset} departments={overview.departments} onClose={() => setDialog(null)} onSaved={reload} />}
    <ConfirmModal isOpen={Boolean(confirm)} tone="danger" title={`Delete the ${confirm?.name} department?`} description="Only an empty department (no staff and no files) can be deleted." confirmLabel="Delete" onConfirm={removeDept} onClose={() => setConfirm(null)} />
  </div>;
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
      onClose(); toast("Record settings saved.");
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  };
  return <Dialog wide title="Record settings" subtitle="The look of every coordination record: title, watermark, footer and the quick-pick lists." onClose={onClose} busy={busy}
    footer={<><AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton><AdminActionButton icon={Settings2} loading={busy} disabled={!settings} onClick={save}>Save settings</AdminActionButton></>}>
    {!settings ? <CoordLoader /> : <>
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

function FileCard({ f, departments, onMove, onDelete, onDownload, index = 0 }) {
  const pct = f.counts.total ? Math.round((f.counts.approved / f.counts.total) * 100) : 0;
  return <article className="coord-card coord-stagger" style={{ "--dept": deptColour(f.department.id), "--i": index }}>
    <Link to={`/admin/coordination/${f.id}`} className="coord-card-main">
      <div className="flex items-center gap-4">
        <span className="coord-classbig"><b>{f.subject.className || "–"}</b><small>class</small></span>
        <div className="min-w-0 flex-1"><h3 className="truncate">{f.subject.name}</h3><p><span className="coord-termtag">{f.termName}</span>{f.session}{f.sections ? ` · ${f.sections} sections` : ""}</p></div>
        <span className="coord-ring" style={{ "--pct": pct }} aria-label={`${pct}% approved`}><b>{pct}%</b></span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="coord-pill">{f.counts.total} week{f.counts.total === 1 ? "" : "s"}</span>
        <span className="coord-pill is-green"><CalendarCheck2 />{f.counts.approved} approved</span>
        {f.counts.submitted > 0 && <span className="coord-pill is-blue"><Clock3 />{f.counts.submitted} awaiting</span>}
        {f.counts.overdue > 0 && <span className="coord-pill is-red"><AlertTriangle />{f.counts.overdue} overdue</span>}
      </div>
      <div className="flex items-center justify-between gap-2"><div className="flex -space-x-2">{f.members.slice(0, 7).map((m) => <Avatar key={m.admin} name={m.name} size={26} ring title={`${m.name} — ${m.title}`} />)}</div><ChevronRight className="coord-arrow h-5 w-5" /></div>
    </Link>
    <div className="coord-card-tools">
      {f.counts.total > 0 && <button type="button" onClick={() => onDownload(f)}><Download className="h-4 w-4" />Download weeks</button>}
      {f.caps.manage && !f.department.id && <div className="flex-1 p-1.5"><SharedSelect size="sm" placeholder="Move to a department" value="" onChange={(id) => id && onMove(f, id)} options={departments.map((d) => ({ value: d.id, label: d.name }))} /></div>}
      {f.caps.manage && <button type="button" className="is-danger" onClick={() => onDelete(f)}><Trash2 className="h-4 w-4" />Delete</button>}
    </div>
  </article>;
}

export default function CoordinationHome() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [files, setFiles] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("files");
  const [dialog, setDialog] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [downloadFile, setDownloadFile] = useState(null);
  const load = () => Promise.all([api.get("/overview"), api.get("/files")]).then(([o, f]) => { setOverview(o); setFiles(f.files); setError(""); }).catch((e) => setError(messageOf(e)));
  useEffect(() => { load(); }, []);
  useLiveRefresh(load);
  const groups = useMemo(() => {
    if (!overview || !files) return [];
    const order = new Map(overview.departments.map((d, i) => [d.id, i]));
    const map = new Map();
    for (const f of files) { const key = f.department.id || ""; if (!map.has(key)) map.set(key, { id: key, name: f.department.name || "Not in a department yet", files: [] }); map.get(key).files.push(f); }
    for (const d of overview.departments) if (!map.has(d.id) && (overview.canManage || overview.me.department === d.id || ["sectionHead", "principal"].includes(overview.me.title))) map.set(d.id, { id: d.id, name: d.name, files: [] });
    return [...map.values()].sort((a, b) => (a.id ? order.get(a.id) ?? 99 : 100) - (b.id ? order.get(b.id) ?? 99 : 100));
  }, [overview, files]);
  const remove = async (file) => { try { await api.del(`/files/${file.id}`); load(); toast("File deleted."); } catch (e) { toast(messageOf(e), "error"); } finally { setConfirm(null); } };
  const move = async (file, departmentId) => { try { await api.patch(`/files/${file.id}`, { departmentId }); load(); } catch (e) { toast(messageOf(e), "error"); } };

  if (error && !overview) return <div className="mx-auto max-w-3xl"><p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p></div>;
  if (!overview || !files) return <CoordLoader label="Loading coordination..." />;
  const me = overview.me;
  const myDept = overview.departments.find((d) => d.id === me.department);
  const intro = overview.canManage ? "Add departments and staff, then create a file for each subject and class." : me.title === "principal" ? "You can open, download, approve and sign every department's records." : me.title === "sectionHead" ? "You can review, approve and sign every department's weekly records." : `${myDept?.name || "Your department"}: plan each week together, live.`;

  const totals = files.reduce((t, f) => ({ files: t.files + 1, weeks: t.weeks + f.counts.total, approved: t.approved + f.counts.approved, awaiting: t.awaiting + f.counts.submitted, overdue: t.overdue + f.counts.overdue }), { files: 0, weeks: 0, approved: 0, awaiting: 0, overdue: 0 });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const myRole = overview.canManage && !me.title ? "manager" : me.title;

  return <div className="coord-root mx-auto max-w-6xl space-y-6">
    <AnnouncementCenter left={<p className="coord-greet" style={{ "--role": roleTheme(myRole) }}>{greeting}, <b>{me.name?.split(" ").slice(0, 3).join(" ")}</b></p>} />
    <header className={`coord-hero is-vivid accent-${myRole || "manager"}`} style={{ "--dept": roleTheme(myRole) }}>
      <div className="min-w-0">
        <p className="coord-eyebrow"><UsersRound className="h-4 w-4" />Weekly Subject Coordination</p>
        <h1>{me.name || "Coordination records"}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">{myRole && <RoleBadge role={myRole} />}{myDept && <span className="coord-deptchip" style={{ "--dept": deptColour(myDept.id) }}>{myDept.name}</span>}</div>
        <p className="coord-lead">{intro}</p>
        {!me.hasSignature && ["coordinator", "sectionHead", "principal"].includes(me.title) && <button type="button" onClick={() => setDialog("signature")} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-bold text-amber-700 shadow-sm hover:bg-white"><PenLine className="h-4 w-4" />Add your e-signature now so you can sign weeks</button>}
        <div className="coord-stats">
          <span><b>{totals.files}</b>files</span><span><b>{totals.weeks}</b>weeks</span><span className="is-green"><b>{totals.approved}</b>approved</span><span className="is-blue"><b>{totals.awaiting}</b>awaiting</span>{totals.overdue > 0 && <span className="is-red"><b>{totals.overdue}</b>overdue</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="coord-hero-btn" onClick={() => setDialog("signature")}><PenLine className="h-4 w-4" />My signature</button>
        {overview.canManage && <button type="button" className="coord-hero-btn" onClick={() => setDialog("settings")}><Settings2 className="h-4 w-4" />Record settings</button>}
        {me.canCreateFiles && <button type="button" className="coord-hero-btn is-solid" onClick={() => setDialog("new")}><Plus className="h-4 w-4" />New file</button>}
      </div>
    </header>

    {(me.title || !overview.canManage) && <InboxPanel hasSignature={me.hasSignature} ink={me.title === "sectionHead" ? "pink" : "blue"} onSigned={load} />}

    {overview.canManage && <div className="coord-filters" role="tablist" aria-label="Coordination sections">
      <button type="button" role="tab" aria-selected={tab === "files"} onClick={() => setTab("files")}><FolderOpen className="h-4 w-4" />Files<span>{files.length}</span></button>
      <button type="button" role="tab" aria-selected={tab === "staff"} onClick={() => setTab("staff")}><Users className="h-4 w-4" />Departments &amp; staff<span>{overview.departments.length}</span></button>
    </div>}

    {tab === "staff" && overview.canManage ? <StaffTab overview={overview} reload={load} /> : groups.length === 0 ? <div className="coord-empty">
      <FolderOpen className="h-10 w-10 text-primary" />
      <h2>{overview.canManage ? "Start with your departments" : "No coordination files yet"}</h2>
      <p>{overview.canManage ? "Add departments and their staff, then create a file for each subject and class." : me.title ? "When a file is created for your department, it will appear here." : "Ask the super admin to add you to a department."}</p>
      {overview.canManage && <AdminActionButton icon={Building2} onClick={() => setTab("staff")}>Set up departments</AdminActionButton>}
    </div> : groups.map((g) => <section key={g.id || "none"} className="space-y-3">
      <h2 className="coord-group flex items-center gap-2" style={{ "--dept": deptColour(g.id) }}><span className="coord-dot" />{g.name}<span className="font-bold normal-case tracking-normal text-slate-400">· {g.files.length} file{g.files.length === 1 ? "" : "s"}</span></h2>
      {g.files.length ? <div className="grid gap-3 md:grid-cols-2">{g.files.map((f, i) => <FileCard index={i} key={f.id} f={f} departments={overview.departments} onMove={move} onDelete={setConfirm} onDownload={setDownloadFile} />)}</div>
        : <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">No files yet.{me.canCreateFiles && <> <button type="button" onClick={() => setDialog("new")} className="font-bold text-primary hover:underline">Create one</button>.</>}</p>}
    </section>)}

    {downloadFile && <DownloadDialog fileId={downloadFile.id} title={`${downloadFile.subject.name} ${downloadFile.subject.className}`} onClose={() => setDownloadFile(null)} />}
    {dialog === "new" && <NewFileDialog overview={overview} onClose={() => setDialog("")} onCreated={(id) => { setDialog(""); navigate(`/admin/coordination/${id}`); }} />}
    {dialog === "settings" && <SettingsDialog onClose={() => setDialog("")} />}
    {dialog === "signature" && <SignatureDialog ink={me.title === "sectionHead" ? "pink" : "blue"} onClose={() => setDialog("")} onSaved={load} />}
    <ConfirmModal isOpen={Boolean(confirm)} tone="danger" title="Delete this coordination file?" description={confirm ? `${confirm.subject.name} ${confirm.subject.className} (${confirm.session}) and all its weeks, comments and history will be deleted. This cannot be undone.` : ""} confirmLabel="Delete file" onConfirm={() => remove(confirm)} onClose={() => setConfirm(null)} />
  </div>;
}
