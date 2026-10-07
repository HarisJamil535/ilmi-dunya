import { useCallback, useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminAlert, AdminLoader, AdminPageHeader, AdminActionButton } from "../components/AdminUI";

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const titleCase = (value) => value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not provided";

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (query) params.set("search", query);
      const response = await axiosInstance.get(`/admin/students?${params}`);
      setStudents(response.data.students || []);
      setTotal(response.data.pagination?.total || 0);
      setPages(response.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load student records.");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader icon={Users} eyebrow="Super admin · Student accounts" title="Students" description="Browse registered student profiles. Passwords and private authentication data are never shown here." statLabel="Registered students" statValue={total.toLocaleString()} />
      {error && <AdminAlert type="error">{error}</AdminAlert>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-black text-slate-900">Student directory</h2><p className="mt-1 text-sm text-slate-500">Email, WhatsApp/phone, gender, location and academic profile.</p></div>
          <form onSubmit={submitSearch} className="flex w-full gap-2 sm:max-w-md">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Search students</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, city or school" className="min-h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
            <AdminActionButton type="submit">Search</AdminActionButton>
          </form>
        </div>
        {loading ? <div className="p-5"><AdminLoader label="Loading student records..." /></div> : students.length ? <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Student", "Contact", "Gender", "City", "School / candidate", "Study profile", "Sign in", "Account", "Joined", "Last active"].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => <tr key={student._id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-4"><p className="font-black text-slate-900">{student.name}</p><p className="mt-1 text-xs text-slate-500">{student.email}</p></td>
                  <td className="px-4 py-4">{student.phone || "—"}</td>
                  <td className="px-4 py-4">{titleCase(student.gender)}</td>
                  <td className="px-4 py-4">{student.city || "—"}</td>
                  <td className="max-w-48 truncate px-4 py-4" title={student.school}>{student.school || "—"}</td>
                  <td className="px-4 py-4"><p>{[student.board?.name, student.class?.name || (student.class?.classNumber ? `Class ${student.class.classNumber}` : ""), student.group?.name].filter(Boolean).join(" · ") || "—"}</p><p className="mt-1 max-w-56 truncate text-xs text-slate-500" title={(student.enrolledSubjects || []).map((subject) => subject.name).join(", ")}>{(student.enrolledSubjects || []).map((subject) => subject.name).join(", ") || "No subjects selected"}</p></td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${student.signInMethod === "google" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{student.signInMethod === "google" ? "Google" : "Password"}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${student.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{titleCase(student.status)}</span><p className="mt-2 text-xs text-slate-500">{student.isEmailVerified ? "Email verified" : "Email not verified"}</p></td>
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(student.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(student.lastLoginAt)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            <span>Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, total)} of {total}</span>
            <div className="flex gap-2"><AdminActionButton variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</AdminActionButton><AdminActionButton variant="secondary" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</AdminActionButton></div>
          </footer>
        </> : <div className="p-12 text-center"><Users className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black text-slate-800">No students found</p><p className="mt-1 text-sm text-slate-500">Try another search or check back when students register.</p></div>}
      </section>
    </div>
  );
};

export default StudentManagement;
