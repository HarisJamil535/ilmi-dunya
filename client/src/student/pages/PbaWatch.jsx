import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, ExternalLink, FileText, FlaskConical, ListVideo, PlayCircle } from "lucide-react";
import axiosInstance from "../../api/axios";
import Spinner from "../../shared/Spinner";
import { pdfLinks } from "../../shared/pdfLinks";
import Breadcrumbs from "../components/Breadcrumbs";
import PbaQuestion from "../components/PbaQuestion";
import YouTubeIcon from "../components/YouTubeIcon";
import { youtubeEmbed } from "../pbaVideo";
import { useProgress } from "../pbaProgress";
import "./pba.css";

// Finds a lesson, a whole topic or a practical by id, and the list of videos it belongs to.
function locate(data, id) {
  for (const topic of data.topics) {
    const whole = topic.videoUrl ? [{ id: topic._id, title: `Complete ${topic.title} lesson`, videoUrl: topic.videoUrl, notesUrl: topic.notesUrl, summary: topic.summary }] : [];
    const lessons = topic.subtopics.map((s) => ({ id: s._id, title: s.title, videoUrl: s.videoUrl, notesUrl: s.notesUrl, summary: s.summary }));
    const list = [...whole, ...lessons].filter((entry) => entry.videoUrl);
    const current = topic._id === id ? whole[0] : lessons.find((s) => s.id === id);
    if (current || topic._id === id) return { kind: "lesson", heading: topic.title, topic, item: current || { id: topic._id, title: `Complete ${topic.title} lesson`, videoUrl: topic.videoUrl, notesUrl: topic.notesUrl, summary: topic.summary }, list };
  }
  const practical = data.practicals.find((p) => p._id === id);
  if (practical) return {
    kind: "practical", heading: "Practicals", topic: data.topics.find((t) => t._id === practical.topic) || null, category: data.categories.find((c) => c._id === practical.category) || null,
    hasQuestion: practical.hasQuestion,
    item: { id: practical._id, title: practical.title, videoUrl: practical.videoUrl, notesUrl: practical.notesUrl, summary: practical.summary, label: practical.label },
    list: data.practicals.filter((p) => p.videoUrl).map((p) => ({ id: p._id, title: p.title, videoUrl: p.videoUrl, notesUrl: p.notesUrl, summary: p.summary })),
  };
  return null;
}

export default function PbaWatch() {
  const [params] = useSearchParams();
  const subjectId = params.get("subjectId") || "";
  const itemId = params.get("item") || "";
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [done, toggleDone] = useProgress(subjectId);

  useEffect(() => {
    if (!subjectId) return undefined;
    const controller = new AbortController();
    axiosInstance.get(`/pba/${subjectId}`, { signal: controller.signal })
      .then(({ data: response }) => { setData(response); setState(response.enabled ? "ready" : "off"); })
      .catch((error) => { if (!controller.signal.aborted) setState(error.response?.status === 404 ? "none" : "error"); });
    return () => controller.abort();
  }, [subjectId]);

  const found = useMemo(() => (data?.enabled && itemId ? locate(data, itemId) : null), [data, itemId]);
  const view = !subjectId || (state === "ready" && !found) ? "none" : state;
  const index = found ? found.list.findIndex((entry) => entry.id === found.item.id) : -1;
  const prev = index > 0 ? found.list[index - 1] : null;
  const next = index >= 0 && index < found.list.length - 1 ? found.list[index + 1] : null;
  const embed = found ? youtubeEmbed(found.item.videoUrl) : "";

  useEffect(() => {
    document.title = found ? `${found.item.title}: ${data.subject.name} PBA lecture | IlmiDunya` : "PBA lecture | IlmiDunya";
    window.scrollTo({ top: 0 });
  }, [found, data]);

  const withItem = (id) => { const nextParams = new URLSearchParams(params); nextParams.set("item", id); return `/pba/watch?${nextParams.toString()}`; };
  const backParams = new URLSearchParams(params); backParams.delete("item");
  const pbaLink = (hash) => `/pba?${backParams.toString()}#${hash}`;
  const chaptersLink = `/chapters?${backParams.toString()}`;
  const finishedInList = found ? found.list.filter((entry) => done.has(entry.id)).length : 0;
  const isDone = found ? done.has(found.item.id) : false;

  return <main className="pba-page">
    <div className="pba-wrap">
      {view === "ready" && found && <Breadcrumbs items={[{ label: "Subjects", to: "/subjects" }, { label: data.subject.name, to: chaptersLink }, { label: "Prepare PBA", to: pbaLink(found.kind === "practical" ? "pba-practicals" : "pba-topics") }, { label: found.item.title }]} />}
      {view === "loading" && <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>}
      {view === "error" && <div className="pba-empty"><p role="alert">This lecture could not be loaded right now.</p><button type="button" onClick={() => window.location.reload()} className="pba-btn pba-btn-notes">Try again</button></div>}
      {(view === "none" || view === "off") && <div className="pba-empty"><FlaskConical size={34} /><h1>This lecture could not be found</h1><p>It may have been moved or removed.</p><Link to={subjectId ? pbaLink("pba-topics") : "/subjects"} className="pba-btn pba-btn-notes">{subjectId ? "Back to Prepare PBA" : "Browse subjects"}</Link></div>}

      {view === "ready" && found && <div className="pba-watch">
        <div className="pba-watch-main">
          <div className="pba-player">
            {embed ? <iframe key={found.item.id} title={found.item.title} src={embed} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              : <div className="pba-player-fallback"><YouTubeIcon size={44} /><p>This video opens on YouTube.</p><a href={found.item.videoUrl} target="_blank" rel="noopener noreferrer" className="pba-btn pba-btn-notes"><ExternalLink size={16} />Watch on YouTube</a></div>}
          </div>

          <section className="pba-watch-info" aria-labelledby="pba-watch-title">
            <div className="pba-tags">
              <span className="pba-tag pba-tag-cat"><FlaskConical size={13} />{found.kind === "practical" ? "Practical" : "Lesson"}</span>
              {found.topic && <span className="pba-tag pba-tag-label">{found.topic.title}</span>}
              {found.category && <span className="pba-tag pba-tag-label">{found.category.name}</span>}
              {found.item.label && <span className="pba-tag pba-tag-label">{found.item.label}</span>}
            </div>
            <h1 id="pba-watch-title">{found.item.title}</h1>
            <p className="pba-watch-sub">{data.subject.name} · {data.subject.class} · {data.subject.board}</p>
            {found.item.summary && <p className="pba-watch-summary">{found.item.summary}</p>}
            <div className="pba-watch-actions">
              <button type="button" className={`pba-done ${isDone ? "is-done" : ""}`} aria-pressed={isDone} onClick={() => toggleDone(found.item.id)}><CheckCircle2 size={18} />{isDone ? "Done" : "Mark as done"}</button>
              {found.item.notesUrl && <a href={pdfLinks(found.item.notesUrl).download} target="_blank" rel="noopener noreferrer" className="pba-btn pba-btn-notes pba-btn-lg"><Download size={17} />Download notes</a>}
              {embed && <a href={found.item.videoUrl} target="_blank" rel="noopener noreferrer" className="pba-btn pba-btn-video pba-btn-lg"><ExternalLink size={16} />YouTube</a>}
            </div>
          </section>

          {found.kind === "practical" && found.hasQuestion && <section className="pba-watch-question" aria-label="The question"><PbaQuestion subjectId={subjectId} id={found.item.id} /></section>}

          <nav className="pba-watch-nav" aria-label="Previous and next lecture">
            {prev ? <Link to={withItem(prev.id)} className="pba-nav-card"><span><ArrowLeft size={14} />Previous</span><strong>{prev.title}</strong></Link> : <span />}
            {next ? <Link to={withItem(next.id)} className="pba-nav-card is-next" onClick={() => { if (!isDone) toggleDone(found.item.id, true); }}><span>Next<ArrowRight size={14} /></span><strong>{next.title}</strong></Link>
              : <Link to={pbaLink(found.kind === "practical" ? "pba-practicals" : "pba-topics")} className="pba-nav-card is-next"><span>All done here<ArrowRight size={14} /></span><strong>Back to Prepare PBA</strong></Link>}
          </nav>
        </div>

        <aside className="pba-playlist" aria-label={`Videos in ${found.heading}`}>
          <div className="pba-playlist-head"><ListVideo size={18} /><div><h2>{found.heading}</h2><p>{finishedInList} of {found.list.length} watched</p></div></div>
          <ol>{found.list.map((entry, i) => <li key={entry.id}>
            <Link to={withItem(entry.id)} className={`pba-play-row ${entry.id === found.item.id ? "is-current" : ""}`} aria-current={entry.id === found.item.id ? "true" : undefined}>
              <span className={`pba-play-num ${done.has(entry.id) ? "is-done" : ""}`}>{done.has(entry.id) ? <Check size={13} strokeWidth={3} /> : entry.id === found.item.id ? <PlayCircle size={15} /> : i + 1}</span>
              <span className="pba-play-title">{entry.title}</span>
              {entry.notesUrl && <FileText size={14} className="pba-play-notes" aria-label="Has notes" />}
            </Link>
          </li>)}</ol>
          <Link to={pbaLink(found.kind === "practical" ? "pba-practicals" : "pba-topics")} className="pba-playlist-back"><ArrowLeft size={14} />All of Prepare PBA</Link>
        </aside>
      </div>}
    </div>
  </main>;
}
