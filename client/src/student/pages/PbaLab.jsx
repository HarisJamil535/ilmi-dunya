import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppWindow, Atom, Braces, Briefcase, Check, ChevronDown, Cpu, Dna, Download, ExternalLink, FileCode2, FlaskConical, GraduationCap, Landmark, Layers, ListChecks, Microscope, Network, Palette, PlayCircle, Search, SearchX, Sparkles, Workflow, X } from "lucide-react";
import axiosInstance from "../../api/axios";
import Spinner from "../../shared/Spinner";
import CustomSelect from "../../shared/CustomSelect";
import { pdfLinks } from "../../shared/pdfLinks";
import Breadcrumbs from "../components/Breadcrumbs";
import PbaVideoModal from "../components/PbaVideoModal";
import YouTubeIcon from "../components/YouTubeIcon";
import { youtubeEmbed } from "../pbaVideo";
import "./pba.css";

const has = (text, needle) => String(text || "").toLowerCase().includes(needle);
const ICONS = [[/html|web ?page/, FileCode2], [/css|style|design/, Palette], [/java ?script|\bjs\b|program|code/, Braces], [/flow ?chart|algorithm/, Workflow], [/concept|map|tree|graph/, Network], [/device|hardware|computer/, Cpu], [/software|app/, AppWindow], [/business|plan|entrepreneur/, Briefcase], [/physic|motion|force|electric/, Atom], [/chemi|reaction|acid|salt/, FlaskConical], [/bio|cell|plant|animal/, Microscope], [/gene|dna/, Dna]];
const iconFor = (title) => ICONS.find(([pattern]) => pattern.test(String(title).toLowerCase()))?.[1] || Sparkles;

// What the student has finished, kept on this device only.
function useProgress(subjectId) {
  const key = `pba-progress:${subjectId}`;
  const [done, setDone] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); } });
  const toggle = useCallback((id) => setDone((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* progress is a convenience; ignore storage errors */ }
    return next;
  }), [key]);
  return [done, toggle];
}

// Watch and notes buttons; each is left out when its link has not been added yet.
function Actions({ title, videoUrl, notesUrl, onPlay }) {
  if (!videoUrl && !notesUrl) return <span className="pba-soon">Coming soon</span>;
  const embed = videoUrl && youtubeEmbed(videoUrl);
  return <div className="pba-actions">
    {videoUrl && (embed
      ? <button type="button" className="pba-btn pba-btn-video" onClick={() => onPlay({ title, url: videoUrl, embed })} aria-label={`Watch video: ${title}`}><YouTubeIcon size={18} />Watch</button>
      : <a className="pba-btn pba-btn-video" href={videoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Watch video: ${title}`}><YouTubeIcon size={18} />Watch</a>)}
    {notesUrl && <a className="pba-btn pba-btn-notes" href={pdfLinks(notesUrl).download} target="_blank" rel="noopener noreferrer" aria-label={`Download notes: ${title}`}><Download size={16} />Notes</a>}
  </div>;
}

function Ring({ value }) {
  const r = 32; const c = 2 * Math.PI * r;
  return <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
    <circle cx="38" cy="38" r={r} fill="none" stroke="var(--app-bg-muted)" strokeWidth="7" />
    <circle cx="38" cy="38" r={r} fill="none" stroke="var(--brand-primary)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: "stroke-dashoffset .5s ease" }} />
  </svg>;
}

export default function PbaLab() {
  const [params] = useSearchParams();
  const subjectId = params.get("subjectId") || "";
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(() => new Set());
  const [category, setCategory] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [video, setVideo] = useState(null);
  const [flash, setFlash] = useState("");
  const [retry, setRetry] = useState(0);
  const [done, toggleDone] = useProgress(subjectId);
  const searchBox = useRef(null);

  useEffect(() => {
    if (!subjectId) return undefined;
    const controller = new AbortController();
    axiosInstance.get(`/pba/${subjectId}`, { signal: controller.signal })
      .then(({ data: response }) => { setData(response); setState(response.enabled ? "ready" : "off"); })
      .catch((error) => { if (!controller.signal.aborted) setState(error.response?.status === 404 ? "none" : "error"); });
    return () => controller.abort();
  }, [subjectId, retry]);

  // Press "/" to jump to the search box.
  useEffect(() => {
    const key = (event) => { if (event.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName || "")) { event.preventDefault(); searchBox.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const view = subjectId ? state : "none";
  const subject = data?.subject;
  useEffect(() => {
    document.title = subject ? `Prepare PBA: ${subject.name} Practical Based Assessment | IlmiDunya` : "Prepare PBA | IlmiDunya";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", subject ? `Prepare for ${subject.name} practical based assessment (PBA): lecture videos, notes and the list of practicals for ${subject.class} ${subject.board}.` : "Prepare for practical based assessment with lecture videos, notes and practical lists.");
  }, [subject]);

  const needle = query.trim().toLowerCase();
  const topics = useMemo(() => (data?.topics || []).map((topic, index) => {
    const base = { ...topic, index };
    if (!needle || has(topic.title, needle) || has(topic.summary, needle)) return { ...base, shown: topic.subtopics };
    const shown = topic.subtopics.filter((sub) => has(sub.title, needle) || has(sub.summary, needle));
    return shown.length ? { ...base, shown } : null;
  }).filter(Boolean), [data, needle]);
  const topicIndex = useMemo(() => new Map((data?.topics || []).map((t, i) => [t._id, i])), [data]);
  const categoryIndex = useMemo(() => new Map((data?.categories || []).map((c, i) => [c._id, i])), [data]);
  const practicals = useMemo(() => (data?.practicals || []).map((p, number) => ({ ...p, number })).filter((p) => (!category || p.category === category) && (!topicFilter || p.topic === topicFilter)
    && (!needle || [p.title, p.label, p.summary, data.topics[topicIndex.get(p.topic)]?.title, data.categories[categoryIndex.get(p.category)]?.name].some((text) => has(text, needle)))), [data, needle, category, topicFilter, topicIndex, categoryIndex]);

  // Progress counts every subtopic and practical with something to study.
  const items = useMemo(() => [...(data?.topics || []).flatMap((t) => t.subtopics.map((s) => ({ id: s._id, topic: t._id }))), ...(data?.practicals || []).map((p) => ({ id: p._id }))], [data]);
  const finished = items.filter((item) => done.has(item.id)).length;
  const share = items.length ? finished / items.length : 0;
  const next = items.find((item) => !done.has(item.id));
  const goNext = () => {
    if (!next) return;
    setQuery(""); setCategory(""); setTopicFilter("");
    if (next.topic) setOpen((set) => new Set(set).add(next.topic));
    setFlash(next.id);
    setTimeout(() => document.getElementById(`pba-item-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    setTimeout(() => setFlash(""), 1800);
  };
  const toggle = (id) => setOpen((set) => { const nextSet = new Set(set); if (nextSet.has(id)) nextSet.delete(id); else nextSet.add(id); return nextSet; });
  const usedCategories = (data?.categories || []).map((c) => ({ ...c, count: data.practicals.filter((p) => p.category === c._id).length })).filter((c) => c.count);
  const chaptersLink = `/chapters?${params.toString()}`;

  return <main className="pba-page">
    <div className="pba-wrap">
      <Breadcrumbs items={[{ label: "Subjects", to: "/subjects" }, ...(subject ? [{ label: subject.name, to: chaptersLink }] : []), { label: "Prepare PBA" }]} />

      {view === "loading" && <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>}
      {view === "error" && <div className="pba-empty"><p role="alert">The PBA lists could not be loaded right now.</p><button type="button" onClick={() => { setState("loading"); setRetry((n) => n + 1); }} className="pba-btn pba-btn-notes">Try again</button></div>}
      {(view === "none" || view === "off") && <div className="pba-empty">
        <FlaskConical size={34} />
        <h1>{view === "off" ? "PBA preparation is not available for this subject yet" : "Choose a subject first"}</h1>
        <p className="max-w-md">{view === "off" ? "Practical Based Assessment lists are added for science and practical subjects. Check back soon." : "Open a subject from your subjects page and use its Prepare PBA button."}</p>
        <Link to={view === "off" ? chaptersLink : "/subjects"} className="pba-btn pba-btn-notes">{view === "off" ? "Back to chapters" : "Browse subjects"}</Link>
      </div>}

      {view === "ready" && data && <>
        <header className="pba-header">
          <div>
            <span className="pba-eyebrow"><FlaskConical size={15} />Practical Based Assessment</span>
            <h1 className="pba-title">Prepare PBA</h1>
            <ul className="pba-context" aria-label="Course details"><li><FlaskConical size={16} />{subject.name}</li>{subject.class && <li><GraduationCap size={16} />{subject.class}</li>}{subject.board && <li><Landmark size={16} />{subject.board}</li>}</ul>
            <p className="pba-intro">{data.setting.intro || "Learn each topic with its lecture and notes, then practise the exam-style practicals until you can do each one on your own."}</p>
            {data.setting.facts.length > 0 && <dl className="pba-facts">{data.setting.facts.map((fact) => <div key={fact.label} className="pba-fact"><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
            {data.setting.links.length > 0 && <div className="pba-links">{data.setting.links.map((link) => <a key={link.url} className="pba-link" href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />{link.title}</a>)}</div>}
          </div>
          {items.length > 0 && <aside className="pba-progress" aria-label="Your preparation">
            <div className="pba-progress-top">
              <div className="pba-ring"><Ring value={share} /><b>{Math.round(share * 100)}%</b></div>
              <div><h2>Your preparation</h2><p>{finished} of {items.length} lessons and practicals done. Saved on this device.</p></div>
            </div>
            <button type="button" className="pba-continue" onClick={goNext} disabled={!next}>{next ? <><PlayCircle size={16} />{finished ? "Continue" : "Start preparing"}</> : <><Check size={16} />All done</>}</button>
          </aside>}
        </header>

        <div className="pba-toolbar">
          <label className="pba-search"><Search size={17} />
            <input ref={searchBox} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics, lessons and practicals" aria-label="Search the PBA lists" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button> : <kbd>/</kbd>}</label>
          <a className="pba-jump" href="#pba-topics"><Layers size={16} />Topics <em>{topics.length}</em></a>
          <a className="pba-jump" href="#pba-practicals"><ListChecks size={16} />Practicals <em>{practicals.length}</em></a>
        </div>

        <section id="pba-topics" aria-labelledby="pba-topics-title" className="pba-section">
          <div className="pba-head"><div><span className="pba-step">Step 1</span><h2 id="pba-topics-title">Learn the topics</h2><p>Open a topic, watch each lecture and download its notes. Tick a lesson when you have finished it.</p></div></div>
          {!topics.length ? <div className="pba-empty">{needle ? <><SearchX size={30} />No topics match "{query}".</> : <><Sparkles size={30} />Topics will be added soon.</>}</div> : <ol className="pba-topics">{topics.map((topic) => {
            const expanded = Boolean(needle) || open.has(topic._id);
            const Icon = iconFor(topic.title);
            const total = topic.subtopics.length;
            const complete = topic.subtopics.filter((s) => done.has(s._id)).length;
            return <li key={topic._id} className={`pba-topic ${expanded ? "is-open" : ""}`}>
              <button type="button" className="pba-topic-head" aria-expanded={expanded} aria-controls={`pba-${topic._id}`} onClick={() => toggle(topic._id)}>
                <span className="pba-icon"><Icon size={21} /></span>
                <span className="min-w-0 flex-1"><span className="pba-topic-title">{topic.title}</span>
                  <span className="pba-topic-meta">{total} lesson{total === 1 ? "" : "s"}{complete ? ` · ${complete} done` : ""}{topic.summary ? ` · ${topic.summary}` : ""}</span>
                  {total > 0 && <span className="pba-bar"><i style={{ width: `${(complete / total) * 100}%` }} /></span>}</span>
                <span className="pba-chevron"><ChevronDown size={18} /></span>
              </button>
              {expanded && <div id={`pba-${topic._id}`} className="pba-topic-body">
                {(topic.videoUrl || topic.notesUrl) && <div className="pba-whole"><span>Complete {topic.title} lesson</span><Actions title={topic.title} videoUrl={topic.videoUrl} notesUrl={topic.notesUrl} onPlay={setVideo} /></div>}
                {topic.shown.length === 0 ? <p className="pba-soon p-3 text-center">Lessons will be added soon.</p> : topic.shown.map((sub) => <div key={sub._id} id={`pba-item-${sub._id}`} className={`pba-row ${done.has(sub._id) ? "is-done" : ""} ${flash === sub._id ? "is-flash" : ""}`}>
                  <button type="button" className="pba-check" aria-pressed={done.has(sub._id)} aria-label={`${done.has(sub._id) ? "Mark as not done" : "Mark as done"}: ${sub.title}`} onClick={() => toggleDone(sub._id)}><Check size={14} strokeWidth={3} /></button>
                  <div className="pba-row-main"><p className="pba-row-title">{sub.title}</p>{sub.summary && <p className="pba-row-sub">{sub.summary}</p>}</div>
                  <Actions title={sub.title} videoUrl={sub.videoUrl} notesUrl={sub.notesUrl} onPlay={setVideo} />
                </div>)}
              </div>}
            </li>;
          })}</ol>}
        </section>

        <section id="pba-practicals" aria-labelledby="pba-practicals-title" className="pba-section">
          <div className="pba-head"><div><span className="pba-step">Step 2</span><h2 id="pba-practicals-title">Practise the practicals</h2><p>The exam-style practicals to be ready for, each with its own lecture and notes.</p></div>
            {data.practicals.some((p) => p.topic) && <div className="w-full sm:w-60"><CustomSelect value={topicFilter} onChange={setTopicFilter} placeholder="All topics" options={data.topics.filter((t) => data.practicals.some((p) => p.topic === t._id)).map((t) => ({ value: t._id, label: t.title }))} /></div>}</div>
          {usedCategories.length > 0 && <div className="pba-filters" role="group" aria-label="Filter by category">
            <button type="button" className="pba-chip" aria-pressed={!category} onClick={() => setCategory("")}>All <em>{data.practicals.length}</em></button>
            {usedCategories.map((c) => <button key={c._id} type="button" className="pba-chip" aria-pressed={category === c._id} onClick={() => setCategory(category === c._id ? "" : c._id)}>{c.name} <em>{c.count}</em></button>)}
          </div>}
          {!practicals.length ? <div className="pba-empty">{data.practicals.length ? <><SearchX size={30} />No practicals match your search or filters.</> : <><Sparkles size={30} />Practicals will be added soon.</>}</div> : <div className="pba-grid">{practicals.map((p) => {
            const topicNo = topicIndex.get(p.topic);
            const topic = data.topics[topicNo];
            const cat = data.categories[categoryIndex.get(p.category)];
            const TopicIcon = topic ? iconFor(topic.title) : Sparkles;
            return <article key={p._id} id={`pba-item-${p._id}`} className={`pba-card ${flash === p._id ? "is-flash" : ""}`}>
              <div className="pba-card-top"><span className="pba-num">P{p.number + 1}</span><div className="pba-tags">{cat && <span className="pba-tag pba-tag-cat">{cat.name}</span>}{p.label && <span className="pba-tag pba-tag-label">{p.label}</span>}</div></div>
              <h3>{p.title}</h3>
              {p.summary && <p>{p.summary}</p>}
              {topic && <span className="pba-tag pba-tag-topic"><TopicIcon size={14} />{topic.title}</span>}
              <div className="pba-card-foot">
                <button type="button" className="pba-mark" aria-pressed={done.has(p._id)} onClick={() => toggleDone(p._id)}><span><Check size={12} strokeWidth={3} /></span>{done.has(p._id) ? "Practised" : "Mark practised"}</button>
                <Actions title={p.title} videoUrl={p.videoUrl} notesUrl={p.notesUrl} onPlay={setVideo} />
              </div>
            </article>;
          })}</div>}
        </section>
        <p className="pba-note">Videos play on this page. Notes open as PDF files. Your ticks are saved on this device.</p>
      </>}
    </div>
    {video && <PbaVideoModal video={video} onClose={() => setVideo(null)} />}
  </main>;
}
