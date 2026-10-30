import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminLoader } from "../components/AdminUI";
import CustomSelect from "../../shared/CustomSelect";
import { KIND_LABEL } from "./paperDefaults";
import { Button, Pill, input } from "./ui";

// Browse the bank and add questions by hand.
export default function QuestionPicker({ config, outline, section, used, onClose, onAdd, replace = false }) {
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);
  const chapters = outline?.chapters || [];
  const topics = chapters.find((c) => c._id === chapter)?.topics || [];
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      axiosInstance.get("/papers/questions", { params: { subject: config.scope.subject, kind: section.kind, chapter: chapter || undefined, topic: topic || undefined, search: search || undefined, page } })
        .then((response) => live && setData(response.data)).catch((err) => live && setError(err.response?.data?.message || "Could not load questions."));
    }, search ? 300 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [config.scope.subject, section.kind, chapter, topic, search, page]);
  const addOne = async (q) => {
    if (q.scenario) {
      try { const { data: group } = await axiosInstance.get(`/papers/scenarios/${q.scenario}`); onAdd(group.questions, q.scenario); setAdded((n) => n + group.questions.length); } catch { setError("Could not add that scenario."); }
      return;
    }
    onAdd([q]); setAdded((n) => n + 1);
  };
  return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add questions" onKeyDown={(e) => e.key === "Escape" && onClose()}>
    <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-lg font-black text-slate-900">{replace ? "Replace with a question from the bank" : `Add ${KIND_LABEL[section.kind].toLowerCase()} to ${section.name}`}</h2><p className="text-sm text-slate-500">{added ? `${added} added. ` : ""}Tap Add on each question you want.{section.kind === "mcq" && " Scenario questions come with all their linked questions."}</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
        <CustomSelect value={chapter} onChange={(value) => { setChapter(value); setTopic(""); setPage(1); }} placeholder="All chapters" searchable options={chapters.map((c) => ({ value: c._id, label: `Ch ${c.chapterNumber}: ${c.name}` }))} />
        <CustomSelect value={topic} disabled={!topics.length} onChange={(value) => { setTopic(value); setPage(1); }} placeholder="All topics" searchable options={topics.map((t) => ({ value: t._id, label: `${t.topicNumber} ${t.name}` }))} />
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${input} pl-9`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search text" aria-label="Search questions" /></div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        {!data ? <AdminLoader label="Loading questions..." /> : !data.questions.length ? <p className="py-10 text-center text-sm text-slate-500">No questions match.</p> : data.questions.map((q) => { const inPaper = used.has(q._id); return <div key={q._id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{q.questionText}</p>
            {q.scenario && <Pill tone="violet">Scenario group</Pill>}
            {q.contentType === "mcq" && <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">{q.options.map((o) => <span key={o.key} className={`rounded-md px-2 py-0.5 ${o.key === q.correctOption ? "bg-emerald-50 font-black text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{o.key}. {o.text}</span>)}</p>}</div>
          {inPaper ? <Pill tone="green">In paper</Pill> : replace && q.scenario ? <Pill>Scenario group</Pill> : <Button variant="secondary" className="min-h-9 shrink-0" icon={Plus} onClick={() => addOne(q)}>{replace ? "Use this" : "Add"}</Button>}
        </div>; })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4"><span className="text-xs font-bold text-slate-500">{data ? `${data.total} questions` : ""}</span>
        <div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" disabled={!data || page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button><Button onClick={onClose}>Done</Button></div></div>
    </div>
  </div>;
}
