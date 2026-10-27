import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";

const btn = "inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary";

export default function PaperList() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState(null);
  const [notice, setNotice] = useState(null);
  const load = () => axiosInstance.get("/papers").then(({ data }) => setPapers(data.papers || [])).catch((err) => { setPapers([]); setNotice({ type: "error", text: err.response?.data?.message || "Could not load your papers." }); });
  useEffect(() => { load(); }, []);
  const duplicate = async (id) => { try { const { data } = await axiosInstance.post(`/papers/${id}/duplicate`); navigate(`/admin/papers/${data.paper._id}`); } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not copy the paper." }); } };
  const remove = async (paper) => {
    if (!window.confirm(`Delete "${paper.title}"? This cannot be undone.`)) return;
    try { await axiosInstance.delete(`/papers/${paper._id}`); setPapers((list) => list.filter((p) => p._id !== paper._id)); } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not delete the paper." }); }
  };
  return <div className="mx-auto max-w-5xl space-y-5">
    <AdminPageHeader icon={FileText} eyebrow="Paper Maker" title="My question papers" description="Create exam papers from the question bank and download them as PDF or Word, with answer keys." />
    {notice && <AdminAlert type={notice.type}>{notice.text}</AdminAlert>}
    <Link to="/admin/papers/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-white shadow-sm hover:brightness-110"><Plus className="h-4 w-4" />New paper</Link>
    {!papers ? <AdminLoader label="Loading papers..." /> : !papers.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No papers yet. Create your first one.</p> :
      <ul className="space-y-3">{papers.map((paper) => <li key={paper._id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-0 flex-1"><Link to={`/admin/papers/${paper._id}`} className="block truncate font-black text-slate-900 hover:text-primary">{paper.title}</Link><p className="text-xs text-slate-500">{[paper.subject, paper.school, paper.totalMarks ? `${paper.totalMarks} marks` : "", new Date(paper.updatedAt).toLocaleDateString()].filter(Boolean).join(" · ")}</p></div>
        <Link to={`/admin/papers/${paper._id}`} className={btn}><Pencil className="h-4 w-4" />Open</Link>
        <button type="button" className={btn} onClick={() => duplicate(paper._id)}><Copy className="h-4 w-4" />Copy</button>
        <button type="button" className={`${btn} hover:border-rose-300 hover:text-rose-600`} onClick={() => remove(paper)} aria-label={`Delete ${paper.title}`}><Trash2 className="h-4 w-4" /></button>
      </li>)}</ul>}
  </div>;
}
