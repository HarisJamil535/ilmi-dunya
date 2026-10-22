import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, GraduationCap, Pencil, Plus, School, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminActionButton, AdminAlert, AdminLoader, AdminPageHeader, DeleteButton, EditButton } from "../components/AdminUI";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";

const notify = (type, message) => window.dispatchEvent(new CustomEvent("admin-toast", { detail: { type, message } }));
const splitNames = (value) => value.split(",").map((name) => name.trim()).filter(Boolean);
const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary";

// A name that can be edited in place.
const InlineName = ({ value, onSave, onCancel, label }) => {
  const [name, setName] = useState(value);
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim() || name.trim() === value) return onCancel();
    setSaving(true);
    const saved = await onSave(name.trim());
    setSaving(false);
    if (saved) onCancel();
  };
  return <form onSubmit={submit} className="flex min-w-0 items-center gap-2">
    <input autoFocus aria-label={label} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className={`${inputClass} min-h-9 py-1`} />
    <button type="submit" disabled={saving} aria-label="Save name" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><Check className="h-4 w-4" /></button>
    <button type="button" onClick={onCancel} aria-label="Cancel" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><X className="h-4 w-4" /></button>
  </form>;
};

// Adds one or several comma separated names, e.g. "Section A, Section B".
const AddNames = ({ placeholder, buttonLabel, onAdd }) => {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    const names = splitNames(value);
    if (!names.length) return;
    setSaving(true);
    const added = await onAdd(names);
    setSaving(false);
    if (added) setValue("");
  };
  return <form onSubmit={submit} className="flex gap-2">
    <input aria-label={placeholder} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className={inputClass} />
    <AdminActionButton type="submit" variant="secondary" icon={Plus} loading={saving} disabled={saving || !value.trim()}>{buttonLabel}</AdminActionButton>
  </form>;
};

const SchoolCard = ({ school, onChange, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const base = `/schools/${school._id}`;

  // Runs one change and swaps in the school the server returns.
  const apply = async (request, success) => {
    try {
      const response = await request();
      onChange(response.data.school);
      if (success) notify("success", success);
      return true;
    } catch (err) {
      if (![401, 403, 409].includes(err.response?.status) && !(err.response?.status >= 500)) notify("error", err.response?.data?.message || "Unable to save this change. Please try again.");
      return false;
    }
  };

  const sectionCount = school.classes.reduce((sum, grade) => sum + grade.sections.length, 0);

  return <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${school.isActive ? "border-slate-200" : "border-amber-200"}`}>
    <header className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-[14rem] flex-1 items-center gap-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><School className="h-5 w-5" /></span>
        <span className="min-w-0">
          <span className="block truncate text-base font-black text-slate-900">{school.name}</span>
          <span className="mt-0.5 block text-xs font-semibold text-slate-500">{school.classes.length} {school.classes.length === 1 ? "class" : "classes"} · {sectionCount} {sectionCount === 1 ? "section" : "sections"} · {school.studentCount} {school.studentCount === 1 ? "student" : "students"}</span>
        </span>
        <ChevronDown className={`ml-auto h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${school.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{school.isActive ? "Shown at signup" : "Hidden"}</span>
        <EditButton onClick={() => { setRenaming("school"); setOpen(true); }} aria-label={`Rename ${school.name}`} />
        <DeleteButton onClick={() => onDelete({ kind: "school", school })} aria-label={`Delete ${school.name}`} />
      </div>
    </header>

    {open && <div className="space-y-5 border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
      {renaming === "school" && <div><p className="mb-1.5 text-xs font-black uppercase tracking-wider text-slate-500">School name</p><InlineName label="School name" value={school.name} onCancel={() => setRenaming(null)} onSave={(name) => apply(() => axiosInstance.put(base, { name }), "School renamed.")} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-sm text-slate-600">{school.isActive ? "Students can choose this school when they sign up." : "Hidden from signup. Existing students and their results are kept."}</p>
        <AdminActionButton variant="secondary" onClick={() => apply(() => axiosInstance.put(base, { isActive: !school.isActive }), school.isActive ? "School hidden from signup." : "School is now shown at signup.")}>{school.isActive ? "Hide from signup" : "Show at signup"}</AdminActionButton>
      </div>

      {school.classes.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">No classes yet. Students of this school will not be asked for a class until you add one.</p>}
      {school.classes.map((grade) => <section key={grade._id} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {renaming === grade._id
            ? <InlineName label="Class name" value={grade.name} onCancel={() => setRenaming(null)} onSave={(name) => apply(() => axiosInstance.put(`${base}/classes/${grade._id}`, { name }), "Class renamed.")} />
            : <h3 className="flex items-center gap-2 font-black text-slate-900"><GraduationCap className="h-4 w-4 text-primary" />{grade.name}</h3>}
          {renaming !== grade._id && <div className="flex gap-2">
            <EditButton className="!h-9 !w-9 !rounded-xl !px-0" onClick={() => setRenaming(grade._id)} aria-label={`Rename ${grade.name}`} />
            <DeleteButton className="!h-9 !w-9 !rounded-xl !px-0" onClick={() => onDelete({ kind: "class", school, grade })} aria-label={`Delete ${grade.name}`} />
          </div>}
        </div>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Sections of ${grade.name}`}>
          {grade.sections.length === 0 && <li className="text-sm text-slate-500">No sections. Students choose only the class.</li>}
          {grade.sections.map((section) => <li key={section._id} className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-sm font-bold text-slate-700">
            {renaming === section._id
              ? <InlineName label="Section name" value={section.name} onCancel={() => setRenaming(null)} onSave={(name) => apply(() => axiosInstance.put(`${base}/classes/${grade._id}/sections/${section._id}`, { name }), "Section renamed.")} />
              : <>
                {section.name}
                <button type="button" onClick={() => setRenaming(section._id)} aria-label={`Rename ${section.name}`} className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onDelete({ kind: "section", school, grade, section })} aria-label={`Delete ${section.name}`} className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
              </>}
          </li>)}
        </ul>
        <div className="mt-3"><AddNames placeholder="Add sections, e.g. Section A, Section B" buttonLabel="Add" onAdd={(names) => apply(() => axiosInstance.post(`${base}/classes/${grade._id}/sections`, { names }), names.length > 1 ? "Sections added." : "Section added.")} /></div>
      </section>)}
      <AddNames placeholder="Add classes, e.g. Class 9, Class 10" buttonLabel="Add classes" onAdd={(names) => apply(() => axiosInstance.post(`${base}/classes`, { names }), names.length > 1 ? "Classes added." : "Class added.")} />
    </div>}
  </article>;
};

const SchoolManagement = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.get("/schools/manage");
      setSchools(response.data.schools || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load schools. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const replaceSchool = (school) => setSchools((current) => current.map((item) => item._id === school._id ? { ...school, studentCount: item.studentCount } : item));

  const addSchool = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const response = await axiosInstance.post("/schools", { name: name.trim() });
      setSchools((current) => [...current, response.data.school].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })));
      setName("");
      notify("success", "School added. Now add its classes and sections.");
    } catch (err) {
      if (![401, 403, 409].includes(err.response?.status) && !(err.response?.status >= 500)) setError(err.response?.data?.message || "Unable to add the school.");
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = async () => {
    if (!target) return;
    const { kind, school, grade, section } = target;
    setDeleting(true);
    try {
      if (kind === "school") {
        await axiosInstance.delete(`/schools/${school._id}`);
        setSchools((current) => current.filter((item) => item._id !== school._id));
      } else {
        const path = kind === "class" ? `/schools/${school._id}/classes/${grade._id}` : `/schools/${school._id}/classes/${grade._id}/sections/${section._id}`;
        const response = await axiosInstance.delete(path);
        replaceSchool(response.data.school);
      }
      notify("success", `${kind === "school" ? "School" : kind === "class" ? "Class" : "Section"} removed.`);
      setTarget(null);
    } catch (err) {
      setTarget(null);
      if (![401, 403, 409].includes(err.response?.status) && !(err.response?.status >= 500)) setError(err.response?.data?.message || "Unable to remove this item.");
    } finally {
      setDeleting(false);
    }
  };

  const targetName = target ? (target.section?.name || target.grade?.name || target.school.name) : "";

  return <div className="mx-auto max-w-5xl space-y-6">
    <AdminPageHeader icon={School} eyebrow="Schools" title="Schools, Classes & Sections" description="Add the schools your students attend. Students choose their school, class and section when they sign up, and results can be downloaded per school." statLabel="Schools" statValue={schools.length.toLocaleString()} />
    {error && <AdminAlert type="error">{error}</AdminAlert>}
    <form onSubmit={addSchool} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:p-5">
      <label className="flex-1"><span className="sr-only">School name</span><input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} maxLength={120} placeholder="School name, e.g. APS Boys and Girls DHA" className={inputClass} /></label>
      <AdminActionButton type="submit" icon={Plus} loading={adding} disabled={adding || !name.trim()}>Add school</AdminActionButton>
    </form>
    {loading ? <AdminLoader label="Loading schools..." /> : schools.length ? <div className="space-y-3">
      {schools.map((school) => <SchoolCard key={school._id} school={school} onChange={replaceSchool} onDelete={setTarget} />)}
    </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><School className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black text-slate-800">No schools yet</p><p className="mt-1 text-sm text-slate-500">Add your first school above. Students can still choose "My school is not listed" or "Private Student".</p></div>}
    <DeleteConfirmationModal
      isOpen={Boolean(target)}
      onClose={() => setTarget(null)}
      onConfirm={confirmDelete}
      itemName={targetName}
      entityName={target?.kind === "school" ? "School" : target?.kind === "class" ? "Class" : "Section"}
      isDeleting={deleting}
      description={target?.kind === "school" ? "This removes the school and its classes and sections. A school with students cannot be deleted; hide it from signup instead." : "A class or section that students belong to cannot be removed."}
    />
  </div>;
};

export default SchoolManagement;
