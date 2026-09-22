import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Video, Loader2 } from "lucide-react";

import axiosInstance from "../../api/axios";

export default function ChapterTopics({ chapter, context }) {
  const [state, setState] = useState({ loading: true, topics: [], error: "" });
  useEffect(() => {
    const controller = new AbortController();
    axiosInstance.get(`/topics/chapter/${chapter._id}`, { signal: controller.signal })
      .then(({ data }) => setState({ loading: false, error: "", topics: [...(data.topics || [])].sort((a, b) => String(a.topicNumber).localeCompare(String(b.topicNumber), undefined, { numeric: true })) }))
      .catch(() => { if (!controller.signal.aborted) setState({ loading: false, topics: [], error: "Topics could not be loaded. Close and reopen this chapter to retry." }); });
    return () => controller.abort();
  }, [chapter._id]);
  if (state.loading) return <p className="flex items-center gap-2 p-5 text-sm"><Loader2 size={16} className="animate-spin" />Loading topics...</p>;
  if (state.error) return <p role="alert" className="p-5 text-sm text-red-600">{state.error}</p>;
  if (!state.topics.length) return <p className="p-5 text-sm text-slate-500">No topics added yet.</p>;
  return <ol className="divide-y divide-slate-100">{state.topics.map(topic => {
    const params = new URLSearchParams(context);
    params.set("chapterId", chapter._id);
    params.set("topic", topic._id);
    return <li key={topic._id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
      <Link to={`/topic-questions?${params}`} className="flex min-w-0 flex-1 items-center gap-3 text-sm font-semibold text-slate-800 hover:text-primary">
        <span className="shrink-0 rounded-md bg-primary-soft px-2 py-1.5 text-primary">{topic.topicNumber}</span>
        <span className="break-words">{topic.name}</span>
      </Link>
      <div className="ml-auto flex shrink-0 gap-2">
        <Link title={`Watch ${topic.name}`} to={`/topics?${params}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-red-600"><Video size={16} />Video</Link>
        <Link title={`Test MCQs from ${topic.name} only`} to={`/tests/start?topic=${topic._id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white"><FileText size={16} />Test</Link>
      </div>
    </li>;
  })}</ol>;
}
