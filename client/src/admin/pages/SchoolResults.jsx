import { useEffect, useMemo, useState } from "react";
import { Award, FileBadge2, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import axiosInstance from "@/api/axios";
import SmartSelect from "../../shared/CustomSelect";
import { AdminActionButton, AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";

const PAGE_SIZE = 25;
const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: true });
const duration = (value) => {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
const inputClass = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-primary";

const queryFor = (filters, extra = {}) => {
  const params = new URLSearchParams(extra);
  for (const key of ["classId", "sectionId", "subjectId", "from", "to"]) if (filters[key]) params.set(key, filters[key]);
  return params.toString();
};

// Failed file downloads come back as a Blob; read the server's message from it.
const blobMessage = async (error, fallback) => {
  try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { return fallback; }
};

// The three files an admin can download for the current selection.
const DOWNLOADS = [
  { key: "report", icon: Award, title: "Result report", format: "PDF", description: "Key results, grade spread, subject, chapter and topic analysis, and the merit list with stamp and QR verification.", path: "pdf", query: { kind: "report" }, fallback: "IlmiDunya-Result-Report.pdf" },
  { key: "cards", icon: FileBadge2, title: "Student report cards", format: "PDF", description: "A detailed card for every student: each attempt with topic, try number, time, right/wrong/skipped, marks, grade and remarks.", path: "pdf", query: { kind: "cards" }, fallback: "IlmiDunya-Report-Cards.pdf" },
  { key: "excel", icon: FileSpreadsheet, title: "Excel workbook", format: "XLSX", description: "Summary, students and every attempt in sheets you can sort and filter.", path: "export", query: {}, fallback: "school-results.xlsx" },
];

const Stat = ({ label, value }) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-2xl font-black text-slate-950">{value}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p></div>;

const SchoolResults = () => {
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [form, setForm] = useState({ schoolId: "", classId: "", sectionId: "", subjectId: "", from: "", to: "" });
  const [subjects, setSubjects] = useState([]);
  const [applied, setApplied] = useState(null);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    axiosInstance.get("/schools/manage")
      .then((response) => setSchools(response.data.schools || []))
      .catch((err) => setError(err.response?.data?.message || "Unable to load schools."))
      .finally(() => setLoadingSchools(false));
  }, []);

  const school = useMemo(() => schools.find((item) => item._id === form.schoolId), [schools, form.schoolId]);
  const grade = school?.classes.find((item) => item._id === form.classId);
  const dateError = form.from && form.to && form.from > form.to ? "The end date must not be before the start date." : "";

  // Subjects that the chosen students have taken tests in.
  useEffect(() => {
    const { schoolId, classId, sectionId, from, to } = form;
    if (!schoolId || dateError) { setSubjects([]); return undefined; }
    const controller = new AbortController();
    axiosInstance.get(`/schools/${schoolId}/results/subjects?${queryFor({ classId, sectionId, from, to })}`, { signal: controller.signal })
      .then((response) => {
        const list = response.data.subjects || [];
        setSubjects(list);
        setForm((current) => (current.subjectId && !list.some((item) => item._id === current.subjectId) ? { ...current, subjectId: "" } : current));
      })
      .catch(() => { if (!controller.signal.aborted) setSubjects([]); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the selection changes, not the chosen subject
  }, [form.schoolId, form.classId, form.sectionId, form.from, form.to, dateError]);

  useEffect(() => {
    if (!applied) return undefined;
    const controller = new AbortController();
    axiosInstance.get(`/schools/${applied.schoolId}/results?${queryFor(applied, { page: String(page), limit: String(PAGE_SIZE) })}`, { signal: controller.signal })
      .then((response) => { setReport(response.data); setError(""); })
      .catch((err) => { if (!controller.signal.aborted) { setReport(null); setError(err.response?.data?.message || "Unable to load results. Please try again."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied, page]);

  const change = (patch) => { setForm((current) => ({ ...current, ...patch })); setError(""); };

  const show = (event) => {
    event.preventDefault();
    if (!form.schoolId || dateError) return;
    setLoading(true);
    setPage(1);
    setApplied({ ...form });
  };

  const download = async (item) => {
    if (!form.schoolId || dateError || downloading) return;
    setDownloading(item.key);
    setError("");
    try {
      const response = await axiosInstance.get(`/schools/${form.schoolId}/results/${item.path}?${queryFor(form, item.query)}`, { responseType: "blob", timeout: 180000 });
      const fileName = /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || item.fallback;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(await blobMessage(err, `The ${item.title.toLowerCase()} could not be created. Please try again.`));
    } finally {
      setDownloading("");
    }
  };

  const summary = report?.summary;
  const filters = report?.filters;
  const scopeLabel = filters ? [filters.school.name, filters.className, filters.sectionName, filters.subject?.name].filter(Boolean).join(" · ") : "";

  return <div className="mx-auto max-w-7xl space-y-6">
    <AdminPageHeader icon={FileSpreadsheet} eyebrow="Schools · Reports" title="School Results" description="Review and download the test results of students from a school, a class or a single section. Choose a subject or dates to narrow the report." />
    {error && <AdminAlert type="error">{error}</AdminAlert>}
    <form onSubmit={show} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {loadingSchools ? <AdminLoader label="Loading schools..." /> : schools.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No schools have been added yet. Add schools under Schools first.</p> : <>
        <div className="grid gap-4 md:grid-cols-3">
          <SmartSelect label="School" searchable value={form.schoolId} onChange={(schoolId) => change({ schoolId, classId: "", sectionId: "", subjectId: "" })} options={schools.map((item) => ({ value: item._id, label: item.isActive ? item.name : `${item.name} (hidden)` }))} placeholder="Choose a school" />
          <SmartSelect label="Class" value={form.classId} onChange={(classId) => change({ classId, sectionId: "" })} options={(school?.classes || []).map((item) => ({ value: item._id, label: item.name }))} placeholder="All classes" disabled={!school} />
          <SmartSelect label="Section" value={form.sectionId} onChange={(sectionId) => change({ sectionId })} options={(grade?.sections || []).map((item) => ({ value: item._id, label: item.name }))} placeholder="All sections" disabled={!grade} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><SmartSelect label="Subject" searchable value={form.subjectId} onChange={(subjectId) => change({ subjectId })} options={subjects.map((item) => ({ value: item._id, label: item.className ? `${item.name} (${item.className})` : item.name }))} placeholder={subjects.length ? "All subjects" : "No subjects attempted yet"} disabled={!subjects.length} /></div>
          <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">From date</span><input type="date" value={form.from} max={form.to || today()} onChange={(event) => change({ from: event.target.value })} className={inputClass} /></label>
          <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">To date</span><input type="date" value={form.to} min={form.from || undefined} max={today()} onChange={(event) => change({ to: event.target.value })} className={inputClass} /></label>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <AdminActionButton type="submit" icon={Search} className="min-h-12 w-full sm:w-auto sm:min-w-56" disabled={!form.schoolId || Boolean(dateError) || loading} loading={loading}>Show results</AdminActionButton>
          </div>
        </div>
        {dateError && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{dateError}</p>}

        <div className="mt-5 border-t border-slate-100 pt-5">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Download for this selection</p>
          <div className="grid gap-3 md:grid-cols-3">
            {DOWNLOADS.map((item) => {
              const Icon = item.icon;
              const busy = downloading === item.key;
              return <button key={item.key} type="button" onClick={() => download(item)} disabled={!form.schoolId || Boolean(dateError) || Boolean(downloading)}
                className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.format === "PDF" ? "bg-primary/10 text-primary" : "bg-emerald-50 text-emerald-700"}`}>{busy ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2"><span className="font-black text-slate-900">{item.title}</span><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-slate-500">{item.format}</span></span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{busy ? "Preparing your file. Large classes can take a little while…" : item.description}</span>
                </span>
              </button>;
            })}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500"><FileText size={14} className="mt-0.5 shrink-0" />Dates use Pakistan time and include both days. Only students who chose this school from the signup list are included. Every PDF carries a reference and QR code that anyone can check at ilmidunya.org/verify.</p>
        </div>
      </>}
    </form>

    {loading && !report ? <AdminLoader label="Loading results..." /> : report && <section className="space-y-4" aria-label="Results">
      <div><h2 className="text-lg font-black text-slate-900">{scopeLabel}</h2><p className="text-sm text-slate-500">{filters.from || filters.to ? "Attempts in the chosen dates." : "All completed attempts."}</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Students" value={summary.students.toLocaleString()} />
        <Stat label="Students who attempted" value={summary.studentsAttempted.toLocaleString()} />
        <Stat label="Completed attempts" value={summary.attempts.toLocaleString()} />
        <Stat label="Average score" value={`${summary.averagePercentage}%`} />
      </div>
      <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${loading ? "opacity-60" : ""}`}>
        {report.rows.length ? <>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[940px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="admin-sno px-4 py-3">#</th>{["Student", "Class", "Test", "Date", "Time", "Duration", "Score", "Result"].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row, index) => <tr key={row._id} className="align-top hover:bg-slate-50/70">
                  <td className="admin-sno px-4 py-3">{(report.pagination.page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="px-4 py-3 font-black text-slate-900">{row.student.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{[row.student.class, row.student.section].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3"><p className="font-bold text-slate-800">{row.test.title}</p><p className="text-xs text-slate-500">{[row.test.subject, row.test.type, row.isPartialPractice ? "Practice set" : ""].filter(Boolean).join(" · ")}</p></td>
                  <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(new Date(row.startedAt))}</td>
                  <td className="whitespace-nowrap px-4 py-3">{timeFormat.format(new Date(row.startedAt)).toUpperCase()}</td>
                  <td className="whitespace-nowrap px-4 py-3">{duration(row.timeTakenSeconds)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{row.score}/{row.totalMarks} <span className="text-slate-400">({row.percentage}%)</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.passStatus === "pass" ? "bg-emerald-50 text-emerald-700" : row.passStatus === "fail" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>{row.passStatus === "pass" ? "Pass" : row.passStatus === "fail" ? "Fail" : "—"}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            <span>Showing {((report.pagination.page - 1) * PAGE_SIZE) + 1}–{Math.min(report.pagination.page * PAGE_SIZE, report.pagination.total)} of {report.pagination.total.toLocaleString()} attempts</span>
            <div className="flex gap-2"><AdminActionButton variant="secondary" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }}>Previous</AdminActionButton><AdminActionButton variant="secondary" disabled={page >= report.pagination.pages || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }}>Next</AdminActionButton></div>
          </footer>
        </> : <div className="p-12 text-center"><FileSpreadsheet className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black text-slate-800">No attempts found</p><p className="mt-1 text-sm text-slate-500">{summary.students ? "None of these students has completed a test in the chosen dates." : "No students have joined this class or section yet."}</p></div>}
      </div>
    </section>}
  </div>;
};

export default SchoolResults;
