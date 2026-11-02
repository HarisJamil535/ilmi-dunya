import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookMarked, ChevronDown, Download, ExternalLink, FileText, FlaskConical, Layers, ListChecks, Search, SearchX, X } from "lucide-react";
import axiosInstance from "../../api/axios";
import Spinner from "../../shared/Spinner";
import CustomSelect from "../../shared/CustomSelect";
import { pdfLinks } from "../../shared/pdfLinks";
import Breadcrumbs from "../components/Breadcrumbs";
import PbaVideoModal from "../components/PbaVideoModal";
import YouTubeIcon from "../components/YouTubeIcon";
import { youtubeEmbed } from "../pbaVideo";

const has = (text, needle) => String(text || "").toLowerCase().includes(needle);

// The two buttons every lesson and practical can have. A button is left out when the admin has not added its link.
function Actions({ title, videoUrl, notesUrl, onPlay }) {
  if (!videoUrl && !notesUrl) return <span className="text-xs font-semibold text-slate-400">Coming soon</span>;
  return <div className="flex flex-wrap gap-2">
    {videoUrl && (youtubeEmbed(videoUrl)
      ? <button type="button" onClick={() => onPlay({ title, url: videoUrl, embed: youtubeEmbed(videoUrl) })} aria-label={`Watch video: ${title}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-50 px-3.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100"><YouTubeIcon size={18} />Watch video</button>
      : <a href={videoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Watch video: ${title}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-50 px-3.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100"><YouTubeIcon size={18} />Watch video</a>)}
    {notesUrl && <a href={pdfLinks(notesUrl).download} target="_blank" rel="noopener noreferrer" aria-label={`Download notes: ${title}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-dark"><Download className="h-4 w-4" />Download notes</a>}
  </div>;
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
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!subjectId) return undefined;
    const controller = new AbortController();
    axiosInstance.get(`/pba/${subjectId}`, { signal: controller.signal })
      .then(({ data: response }) => { if (!response.enabled) { setState("off"); setData(response); } else { setData(response); setState("ready"); } })
      .catch((error) => { if (!controller.signal.aborted) setState(error.response?.status === 404 ? "none" : "error"); });
    return () => controller.abort();
  }, [subjectId, retry]);

  const view = subjectId ? state : "none";
  const subject = data?.subject;
  useEffect(() => {
    document.title = subject ? `PBA Prep Lab: ${subject.name} Practical Based Assessment | IlmiDunya` : "PBA Prep Lab | IlmiDunya";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", subject ? `Prepare for ${subject.name} practical based assessment (PBA): lecture videos, notes and the list of practicals for ${subject.class} ${subject.board}.` : "Prepare for practical based assessment with lecture videos, notes and practical lists.");
  }, [subject]);

  const needle = query.trim().toLowerCase();
  const topics = useMemo(() => (data?.topics || []).map((topic) => {
    if (!needle) return { ...topic, shown: topic.subtopics };
    if (has(topic.title, needle) || has(topic.summary, needle)) return { ...topic, shown: topic.subtopics };
    const shown = topic.subtopics.filter((sub) => has(sub.title, needle) || has(sub.summary, needle));
    return shown.length ? { ...topic, shown } : null;
  }).filter(Boolean), [data, needle]);
  const topicNames = useMemo(() => new Map((data?.topics || []).map((t) => [t._id, t.title])), [data]);
  const categoryNames = useMemo(() => new Map((data?.categories || []).map((c) => [c._id, c.name])), [data]);
  const topicName = (id) => topicNames.get(id) || "";
  const categoryName = (id) => categoryNames.get(id) || "";
  const practicals = useMemo(() => (data?.practicals || []).filter((p) => (!category || p.category === category) && (!topicFilter || p.topic === topicFilter)
    && (!needle || [p.title, p.label, p.summary, topicNames.get(p.topic), categoryNames.get(p.category)].some((text) => has(text, needle)))), [data, needle, category, topicFilter, topicNames, categoryNames]);
  const toggle = (id) => setOpen((set) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const usedCategories = (data?.categories || []).filter((c) => data.practicals.some((p) => p.category === c._id));
  const chaptersLink = `/chapters?${params.toString()}`;

  return <main className="min-h-[70vh] bg-slate-50/60 px-4 pb-16 pt-6 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-6">
      <Breadcrumbs items={[{ label: "Subjects", to: "/subjects" }, ...(subject ? [{ label: subject.name, to: chaptersLink }] : []), { label: "PBA Prep Lab" }]} />

      {view === "loading" && <div className="grid min-h-[40vh] place-items-center"><Spinner /></div>}
      {view === "error" && <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center"><p role="alert" className="font-bold text-rose-700">The PBA lists could not be loaded right now.</p><button type="button" onClick={() => { setState("loading"); setRetry((n) => n + 1); }} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white">Try again</button></div>}
      {(view === "none" || view === "off") && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><FlaskConical className="h-7 w-7" /></span>
        <h1 className="mt-4 text-xl font-black text-slate-900">{view === "off" ? "PBA Prep Lab is not available for this subject yet" : "Choose a subject first"}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{view === "off" ? "Practical Based Assessment lists are added for science and practical subjects. Check back soon." : "Open a subject from your subjects page and use its PBA button."}</p>
        <Link to={view === "off" ? chaptersLink : "/subjects"} className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white">{view === "off" ? "Back to chapters" : "Browse subjects"}</Link>
      </div>}

      {view === "ready" && data && <>
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-slate-950 p-6 text-white shadow-lg shadow-primary/10 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ring-1 ring-white/15"><FlaskConical className="h-4 w-4" />Practical Based Assessment</span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">PBA Prep Lab</h1>
          <p className="mt-1 text-base font-bold text-white/85">{subject.name} · {subject.class} · {subject.board}</p>
          {data.setting.intro && <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">{data.setting.intro}</p>}
          {data.setting.facts.length > 0 && <dl className="mt-5 flex flex-wrap gap-2.5">{data.setting.facts.map((fact) => <div key={fact.label} className="rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15"><dt className="text-[11px] font-black uppercase tracking-wider text-white/65">{fact.label}</dt><dd className="text-base font-black">{fact.value}</dd></div>)}</dl>}
          {data.setting.links.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{data.setting.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-primary-dark shadow-sm hover:bg-primary-soft"><ExternalLink className="h-4 w-4" />{link.title}</a>)}</div>}
        </header>

        <div className="sticky top-[4.5rem] z-20 space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
          <label className="relative block"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics, subtopics and practicals" aria-label="Search the PBA lists" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}</label>
          <div className="flex gap-2 text-sm font-black"><a href="#pba-topics" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-primary-soft"><Layers className="h-4 w-4" />Topics <span className="text-slate-400">{topics.length}</span></a><a href="#pba-practicals" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-primary-soft"><ListChecks className="h-4 w-4" />Practicals <span className="text-slate-400">{practicals.length}</span></a></div>
        </div>

        <section id="pba-topics" aria-labelledby="pba-topics-title" className="scroll-mt-52 space-y-3">
          <div><h2 id="pba-topics-title" className="text-2xl font-black text-slate-900">Topics</h2><p className="text-sm text-slate-500">Learn each topic first: open it, then watch the lecture and download the notes.</p></div>
          {!topics.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{needle ? <><SearchX className="mx-auto mb-2 h-6 w-6 text-slate-300" />No topics match "{query}".</> : "Topics will be added soon."}</p> : <ol className="space-y-3">{topics.map((topic, index) => {
            const expanded = Boolean(needle) || open.has(topic._id);
            return <li key={topic._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button type="button" aria-expanded={expanded} aria-controls={`pba-${topic._id}`} onClick={() => toggle(topic._id)} className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-slate-50 sm:p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-base font-black text-primary-dark">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-lg font-black text-slate-900">{topic.title}</span><span className="block text-xs font-semibold text-slate-500">{topic.subtopics.length} subtopic{topic.subtopics.length === 1 ? "" : "s"}{topic.summary ? ` · ${topic.summary}` : ""}</span></span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {expanded && <div id={`pba-${topic._id}`} className="space-y-2.5 border-t border-slate-100 bg-slate-50/60 p-3 animate-in fade-in slide-in-from-top-1 sm:p-4">
                {(topic.videoUrl || topic.notesUrl) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary-soft/40 p-3"><span className="text-sm font-black text-primary-dark">Complete {topic.title} lesson</span><Actions title={topic.title} videoUrl={topic.videoUrl} notesUrl={topic.notesUrl} onPlay={setVideo} /></div>}
                {topic.shown.length === 0 ? <p className="p-3 text-center text-sm text-slate-500">Subtopics will be added soon.</p> : topic.shown.map((sub, i) => <div key={sub._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="w-6 text-center text-xs font-black text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-slate-800">{sub.title}</p>{sub.summary && <p className="text-xs text-slate-500">{sub.summary}</p>}</div>
                  <Actions title={sub.title} videoUrl={sub.videoUrl} notesUrl={sub.notesUrl} onPlay={setVideo} />
                </div>)}
              </div>}
            </li>;
          })}</ol>}
        </section>

        <section id="pba-practicals" aria-labelledby="pba-practicals-title" className="scroll-mt-52 space-y-3">
          <div><h2 id="pba-practicals-title" className="text-2xl font-black text-slate-900">Practicals</h2><p className="text-sm text-slate-500">The practicals you should be ready for, each with its own lecture and notes.</p></div>
          {(usedCategories.length > 0 || data.topics.length > 0) && <div className="flex flex-wrap items-center gap-2">
            {usedCategories.length > 0 && <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={!category} onClick={() => setCategory("")} className={`min-h-9 rounded-full px-3.5 text-sm font-bold transition ${!category ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-primary/40"}`}>All</button>
              {usedCategories.map((c) => <button key={c._id} type="button" aria-pressed={category === c._id} onClick={() => setCategory(category === c._id ? "" : c._id)} className={`min-h-9 rounded-full px-3.5 text-sm font-bold transition ${category === c._id ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-primary/40"}`}>{c.name}</button>)}</div>}
            {data.practicals.some((p) => p.topic) && <div className="w-full sm:ml-auto sm:w-60"><CustomSelect value={topicFilter} onChange={setTopicFilter} placeholder="All topics" options={data.topics.filter((t) => data.practicals.some((p) => p.topic === t._id)).map((t) => ({ value: t._id, label: t.title }))} /></div>}
          </div>}
          {!practicals.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{data.practicals.length ? "No practicals match your search or filters." : "Practicals will be added soon."}</p> : <ol className="space-y-2.5">{practicals.map((p) => <li key={p._id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-black text-white">{data.practicals.indexOf(p) + 1}</span>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-black text-slate-900">{p.title}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-black">{p.topic && <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary-dark">{topicName(p.topic)}</span>}{p.category && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{categoryName(p.category)}</span>}{p.label && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{p.label}</span>}</p>
              {p.summary && <p className="mt-1.5 text-xs leading-5 text-slate-500">{p.summary}</p>}</div>
            <Actions title={p.title} videoUrl={p.videoUrl} notesUrl={p.notesUrl} onPlay={setVideo} />
          </li>)}</ol>}
        </section>
        <p className="flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400"><BookMarked className="h-3.5 w-3.5" />Notes open as PDF files. Videos play right here.<FileText className="hidden h-3.5 w-3.5" /></p>
      </>}
    </div>
    {video && <PbaVideoModal video={video} onClose={() => setVideo(null)} />}
  </main>;
}
