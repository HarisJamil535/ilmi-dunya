import Spinner from "../../shared/Spinner";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ClipboardCheck, MessageSquareText } from "lucide-react";
import YouTubeIcon from "./YouTubeIcon";

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
  if (state.loading) return <div className="topics-state"><Spinner /></div>;
  if (state.error) return <p role="alert" className="topics-state is-error">{state.error}</p>;
  if (!state.topics.length) return <p className="topics-state">No topics added yet.</p>;
  return <div className="chapter-topics-wrap">
    <ol className="chapter-topics-list">{state.topics.map(topic => {
    const params = new URLSearchParams(context);
    params.set("chapterId", chapter._id);
    params.set("topic", topic._id);
    return <li key={topic._id} className="topic-row">
      <Link to={`/topic-questions?${params}`} className="topic-question-link" title={`Open important long and short questions for ${topic.name}`}>
        <span className="topic-number">{topic.topicNumber}</span>
        <span className="topic-copy"><strong>{topic.name}</strong><small><MessageSquareText size={13} aria-hidden="true" />Important long & short questions</small></span>
        <ChevronRight className="topic-link-arrow" size={18} aria-hidden="true" />
      </Link>
      <div className="topic-actions">
        <Link title={`Watch video lessons for ${topic.name}`} to={`/topics?${params}`} className="topic-video-action"><YouTubeIcon size={20} /><span>Video</span></Link>
        <Link title={`Take the MCQ test for ${topic.name}`} to={`/tests/start?topic=${topic._id}`} className="topic-test-action"><ClipboardCheck size={17} aria-hidden="true" /><span>Test</span></Link>
      </div>
    </li>;
  })}</ol></div>;
}
