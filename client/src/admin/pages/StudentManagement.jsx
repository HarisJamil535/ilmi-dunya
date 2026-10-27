import { useCallback, useEffect, useState } from "react";
import { Ban, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminAlert, AdminLoader, AdminPageHeader, AdminActionButton } from "../components/AdminUI";
import EmailDeliveryCheck from "../components/EmailDeliveryCheck";

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const titleCase = (value) => value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not provided";
const STATUS_TABS = [["", "All"], ["active", "Active"], ["blocked", "Blocked"]];

// Explains exactly what each action does before the admin confirms it.
const ActionDialog = ({ action, busy, onCancel, onConfirm }) => {
  const [mode, setMode] = useState("delete");
  if (!action) return null;
  const { type, student } = action;
  const blocked = student.status === "blocked";
  const copy = {
    block: { title: `Block ${student.name}?`, confirm: "Block student", tone: "bg-rose-600 hover:bg-rose-700", points: ["They are signed out on every device straight away.", "They cannot sign in, reset the password or sign up again with this email or number.", "They see a message saying they are blocked and should contact support.", "Their results stay. You can unblock them at any time."] },
    unblock: { title: `Unblock ${student.name}?`, confirm: "Unblock student", tone: "bg-emerald-600 hover:bg-emerald-700", points: ["They can sign in again with their existing password.", "Their email and number can be used again."] },
    delete: { title: `Delete ${student.name}'s account?`, confirm: mode === "block-delete" && !blocked ? "Block and delete" : "Delete account", tone: "bg-rose-600 hover:bg-rose-700", points: ["The account, its test attempts and results are removed permanently. This cannot be undone."] },
  }[type];
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="student-action-title" onKeyDown={(event) => event.key === "Escape" && !busy && onCancel()}>
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <h2 id="student-action-title" className="text-lg font-black text-slate-950">{copy.title}</h2>
        <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <p className="mt-1 text-sm text-slate-500">{student.email} · {student.phone}</p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">{copy.points.map((point) => <li key={point} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{point}</li>)}</ul>
      {type === "delete" && (blocked
        ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">This student is blocked, so their email and number stay blocked after deletion. You can lift that later under "Blocked emails and numbers".</p>
        : <fieldset className="mt-4 space-y-2">
            <legend className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">After deleting</legend>
            {[["delete", "Delete only", "They can sign up again with the same email and number."], ["block-delete", "Block and delete", "They cannot sign up again with this email or number, and see the blocked message."]].map(([value, label, hint]) => <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === value ? "border-primary bg-primary-soft/50" : "border-slate-200"}`}>
              <input type="radio" name="delete-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-primary" />
              <span><span className="block text-sm font-black text-slate-900">{label}</span><span className="block text-xs text-slate-500">{hint}</span></span>
            </label>)}
          </fieldset>)}
      <div className="mt-6 flex justify-end gap-2">
        <AdminActionButton variant="secondary" onClick={onCancel} disabled={busy}>Cancel</AdminActionButton>
        <button type="button" disabled={busy} onClick={() => onConfirm(type === "delete" ? mode : type)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition disabled:opacity-55 ${copy.tone}`}>{busy ? "Working..." : copy.confirm}</button>
      </div>
    </div>
  </div>;
};

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [blockedList, setBlockedList] = useState([]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (query) params.set("search", query);
      if (status) params.set("status", status);
      const response = await axiosInstance.get(`/admin/students?${params}`);
      setStudents(response.data.students || []);
      setTotal(response.data.pagination?.total || 0);
      setPages(response.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load student records.");
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  const loadBlocked = useCallback(() => axiosInstance.get("/admin/blocked-identities").then((response) => setBlockedList(response.data.items || [])).catch(() => {}), []);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadBlocked(); }, [loadBlocked]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const confirmAction = async (kind) => {
    const student = action.student;
    setBusy(true);
    setError("");
    try {
      if (kind === "block-delete") await axiosInstance.post(`/admin/students/${student._id}/block`);
      if (kind === "block" || kind === "unblock") await axiosInstance.post(`/admin/students/${student._id}/${kind}`);
      else await axiosInstance.delete(`/admin/students/${student._id}`);
      setNotice({
        block: `${student.name} is blocked and has been signed out.`,
        unblock: `${student.name} is unblocked and can sign in again.`,
        delete: student.status === "blocked" ? `${student.name}'s account was deleted. The email and number stay blocked.` : `${student.name}'s account was deleted. They can sign up again.`,
        "block-delete": `${student.name}'s account was deleted and the email and number are blocked.`,
      }[kind]);
      setAction(null);
      await Promise.all([loadStudents(), loadBlocked()]);
    } catch (err) {
      setError(err.response?.data?.message || "That change could not be saved. Please try again.");
      setAction(null);
    } finally {
      setBusy(false);
    }
  };

  const liftBlock = async (item) => {
    setError("");
    try {
      await axiosInstance.delete(`/admin/blocked-identities/${item._id}`);
      setNotice(`${item.value} can be used to sign up again.`);
      await loadBlocked();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove this block.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader icon={Users} eyebrow="Super admin · Student accounts" title="Students" description="Browse student profiles, block or unblock accounts, and delete accounts. Passwords and private authentication data are never shown here." statLabel="Registered students" statValue={total.toLocaleString()} />
      {error && <AdminAlert type="error">{error}</AdminAlert>}
      {notice && <AdminAlert type="success">{notice}</AdminAlert>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-black text-slate-900">Student directory</h2><p className="mt-1 text-sm text-slate-500">Email, WhatsApp/phone, gender, location and academic profile.</p></div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <div role="tablist" aria-label="Account status" className="flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1">
              {STATUS_TABS.map(([value, label]) => <button key={label} type="button" role="tab" aria-selected={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-black transition ${status === value ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}
            </div>
            <form onSubmit={submitSearch} className="flex w-full gap-2 sm:max-w-md">
              <label className="relative min-w-0 flex-1"><span className="sr-only">Search students</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, city or school" className="min-h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
              <AdminActionButton type="submit">Search</AdminActionButton>
            </form>
          </div>
        </div>
        {loading ? <div className="p-5"><AdminLoader label="Loading student records..." /></div> : students.length ? <>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[1300px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="admin-sno px-4 py-3">#</th>{["Student", "Contact", "Gender", "City", "School / candidate", "Study profile", "Sign in", "Account", "Joined", "Last active", "Actions"].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, index) => <tr key={student._id} data-tone={student.status === "blocked" ? "blocked" : undefined} className={`align-top hover:bg-slate-50/70 ${student.status === "blocked" ? "bg-rose-50/40" : ""}`}>
                  <td className="admin-sno px-4 py-4">{(page - 1) * 25 + index + 1}</td>
                  <td className="px-4 py-4"><p className="font-black text-slate-900">{student.name}</p><p className="mt-1 text-xs text-slate-500">{student.email}</p></td>
                  <td className="px-4 py-4">{student.phone || "—"}</td>
                  <td className="px-4 py-4">{titleCase(student.gender)}</td>
                  <td className="px-4 py-4">{student.city || "—"}</td>
                  <td className="max-w-48 px-4 py-4"><p className="truncate" title={student.school}>{student.school || "—"}</p>{(student.schoolClass || student.schoolSection) && <p className="mt-1 text-xs text-slate-500">{[student.schoolClass, student.schoolSection].filter(Boolean).join(" · ")}</p>}</td>
                  <td className="px-4 py-4"><p>{[student.board?.name, student.class?.name || (student.class?.classNumber ? `Class ${student.class.classNumber}` : ""), student.group?.name].filter(Boolean).join(" · ") || "—"}</p><p className="mt-1 max-w-56 truncate text-xs text-slate-500" title={(student.enrolledSubjects || []).map((subject) => subject.name).join(", ")}>{(student.enrolledSubjects || []).map((subject) => subject.name).join(", ") || "No subjects selected"}</p></td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${student.signInMethod === "google" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{student.signInMethod === "google" ? "Google" : "Password"}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${student.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{titleCase(student.status)}</span><p className="mt-2 text-xs text-slate-500">{student.isEmailVerified ? "Email verified" : "Email not verified"}</p></td>
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(student.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(student.lastLoginAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {student.status === "blocked"
                        ? <button type="button" onClick={() => setAction({ type: "unblock", student })} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100"><ShieldCheck className="h-4 w-4" />Unblock</button>
                        : <button type="button" onClick={() => setAction({ type: "block", student })} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-xs font-black text-amber-700 hover:bg-amber-100"><Ban className="h-4 w-4" />Block</button>}
                      <button type="button" onClick={() => setAction({ type: "delete", student })} aria-label={`Delete ${student.name}`} title="Delete account" className="grid h-9 w-9 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            <span>Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, total)} of {total}</span>
            <div className="flex gap-2"><AdminActionButton variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</AdminActionButton><AdminActionButton variant="secondary" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</AdminActionButton></div>
          </footer>
        </> : <div className="p-12 text-center"><Users className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-black text-slate-800">No students found</p><p className="mt-1 text-sm text-slate-500">{status === "blocked" ? "No student is blocked." : "Try another search or check back when students register."}</p></div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Blocked emails and numbers</h2>
        <p className="mt-1 text-sm text-slate-500">From accounts that were blocked and then deleted. They cannot be used to sign up until you remove the block.</p>
        {blockedList.length ? <ul className="mt-4 divide-y divide-slate-100">
          {blockedList.map((item) => <li key={item._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="break-all font-bold text-slate-900">{item.value}</p><p className="text-xs text-slate-500">{item.kind === "email" ? "Email" : "Phone"}{item.studentName ? ` · ${item.studentName}` : ""} · blocked {formatDate(item.blockedAt)}</p></div>
            <button type="button" onClick={() => liftBlock(item)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100"><ShieldCheck className="h-4 w-4" />Allow sign-up again</button>
          </li>)}
        </ul> : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Nothing is blocked from deleted accounts.</p>}
      </section>

      <EmailDeliveryCheck />

      <ActionDialog key={action ? `${action.type}-${action.student._id}` : "none"} action={action} busy={busy} onCancel={() => setAction(null)} onConfirm={confirmAction} />
    </div>
  );
};

export default StudentManagement;
