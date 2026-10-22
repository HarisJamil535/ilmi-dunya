import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
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
  for (const key of ["classId", "sectionId", "from", "to"]) if (filters[key]) params.set(key, filters[key]);
  return params.toString();
};

// Failed file downloads come back as a Blob; read the server's message from it.
const blobMessage = async (error, fallback) => {
  try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { return fallback; }
};

const Stat = ({ label, value }) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-2xl font-black text-slate-950">{value}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p></div>;

const SchoolResults = () => {
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [form, setForm] = useState({ schoolId: "", classId: "", sectionId: "", from: "", to: "" });
  const [applied, setApplied] = useState(null);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  const download = async () => {
    if (!form.schoolId || dateError) return;
    setDownloading(true);
    setError("");
    try {
      const response = await axiosInstance.get(`/schools/${form.schoolId}/results/export?${queryFor(form)}`, { responseType: "blob", timeout: 180000 });
      const fileName = /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || "school-results.xlsx";
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(await blobMessage(err, "The Excel file could not be created. Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  const summary = report?.summary;
  const filters = report?.filters;
  const scopeLabel = filters ? [filters.school.name, filters.className, filters.sectionName].filter(Boolean).join(" · ") : "";

  return <div className="mx-auto max-w-7xl space-y-6">
    <AdminPageHeader icon={FileSpreadsheet} eyebrow="Schools · Reports" title="School Results" description="Review and download the test results of students from a school, a class or a single section. Choose dates to see attempts from a particular period." />
    {error && <AdminAlert type="error">{error}</AdminAlert>}
    <form onSubmit={show} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {loadingSchools ? <AdminLoader label="Loading schools..." /> : schools.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No schools have been added yet. Add schools under Schools first.</p> : <>
        <div className="grid gap-4 md:grid-cols-3">
          <SmartSelect label="School" searchable value={form.schoolId} onChange={(schoolId) => change({ schoolId, classId: "", sectionId: "" })} options={schools.map((item) => ({ value: item._id, label: item.isActive ? item.name : `${item.name} (hidden)` }))} placeholder="Choose a school" />
          <SmartSelect label="Class" value={form.classId} onChange={(classId) => change({ classId, sectionId: "" })} options={(school?.classes || []).map((item) => ({ value: item._id, label: item.name }))} placeholder="All classes" disabled={!school} />
          <SmartSelect label="Section" value={form.sectionId} onChange={(sectionId) => change({ sectionId })} options={(grade?.sections || []).map((item) => ({ value: item._id, label: item.name }))} placeholder="All sections" disabled={!grade} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">From date</span><input type="date" value={form.from} max={form.to || today()} onChange={(event) => change({ from: event.target.value })} className={inputClass} /></label>
          <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">To date</span><input type="date" value={form.to} min={form.from || undefined} max={today()} onChange={(event) => change({ to: event.target.value })} className={inputClass} /></label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
            <AdminActionButton type="submit" icon={Search} className="min-h-12 flex-1" disabled={!form.schoolId || Boolean(dateError) || loading} loading={loading}>Show results</AdminActionButton>
            <AdminActionButton variant="dark" icon={Download} className="min-h-12 flex-1" onClick={download} disabled={!form.schoolId || Boolean(dateError) || downloading} loading={downloading}>Download Excel</AdminActionButton>
          </div>
        </div>
        {dateError && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{dateError}</p>}
        <p className="mt-3 text-xs text-slate-500">Dates use Pakistan time and include both days. The Excel file has a summary, a sheet of students and a sheet with every attempt. Only students who chose this school from the signup list are included.</p>
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Student", "Class", "Test", "Date", "Time", "Duration", "Score", "Result"].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row) => <tr key={row._id} className="align-top hover:bg-slate-50/70">
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
