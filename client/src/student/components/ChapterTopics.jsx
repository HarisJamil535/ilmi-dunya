import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, ListChecks, Loader2 } from "lucide-react";
import { IoLogoYoutube } from "react-icons/io5";

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
  return <div className="chapter-topics-wrap">
    <div className="chapter-topics-intro"><div><p>Chapter topics</p><h3>Choose what you want to study</h3></div><span>{state.topics.length} {state.topics.length === 1 ? "topic" : "topics"}</span></div>
    <ol className="chapter-topics-list">{state.topics.map(topic => {
    const params = new URLSearchParams(context);
    params.set("chapterId", chapter._id);
    params.set("topic", topic._id);
    return <li key={topic._id} className="topic-row">
      <Link to={`/topic-questions?${params}`} className="topic-question-link" title={`Open important long and short questions for ${topic.name}`}>
        <span className="topic-number">{topic.topicNumber}</span>
        <span className="topic-copy"><strong>{topic.name}</strong><small><ListChecks size={14} /> Open important long & short questions</small></span>
        <ArrowRight className="topic-link-arrow" size={18} />
      </Link>
      <div className="topic-actions">
        <Link title={`Watch video lessons for ${topic.name}`} to={`/topics?${params}`} className="topic-video-action"><IoLogoYoutube size={18} /><span>Video</span></Link>
        <Link title={`Take the MCQ test for ${topic.name}`} to={`/tests/start?topic=${topic._id}`} className="topic-test-action"><FileText size={16} /><span>Test</span></Link>
      </div>
    </li>;
  })}</ol></div>;
}
