import { usePageLoading } from "../../shared/pageLoading";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardList, FileText, HelpCircle, Lightbulb, ListChecks, Lock, PlayCircle, RefreshCw } from "lucide-react";
import axios from "../../api/axios";
import { applyMetadata, initialPage } from "../../seo/pageMetadata";
import "./public-study.css";
import ImportantBadge from "../../shared/ImportantBadge";
import StructuredSEO from "../../seo/StructuredSEO";
import StudyPathSelector from '../components/StudyPathSelector';
import MathText from "../../shared/MathText";

const QUICK_ICONS = [ListChecks, FileText];

// One MCQ with its options; the answer and explanation open on demand but are part of the page for search engines.
function McqCard({ item, number }) {
  const correct = item.options.find((option) => option.key === item.correctOption);
  const urdu = item.contentLanguage === "ur";
  return <li className={`study-mcq ${urdu ? "urdu-content" : ""}`} dir={urdu ? "rtl" : "ltr"} lang={urdu ? "ur" : "en"}>
    <div className="study-mcq-head"><span className="study-mcq-number">Q{number}</span>{item.isImportant && <ImportantBadge />}</div>
    {item.scenario && <div className="study-mcq-scenario"><strong>{item.scenario.title}</strong><p><MathText text={item.scenario.scenarioText} /></p></div>}
    <p className="study-mcq-question"><MathText text={item.questionText} /></p>
    {item.imageUrl && <img src={item.imageUrl} alt={item.imageAlt || "Question diagram"} loading="lazy" className="study-mcq-image" />}
    <ol className="study-mcq-options">{item.options.map((option) => <li key={option.key}><span>{option.key}</span><MathText text={option.text} /></li>)}</ol>
    {correct && <details className="study-mcq-answer">
      <summary><CheckCircle2 size={16} /> Show answer</summary>
      <p><strong>Correct answer: {correct.key}.</strong> <MathText text={correct.text} /></p>
      {item.explanation && <p className="study-mcq-explain"><Lightbulb size={15} /> <span><MathText text={item.explanation} /></span></p>}
    </details>}
  </li>;
}

export default function PublicStudyPage({ initialData }) {
  const location = useLocation();
  const navigate = useNavigate();
  const requestPath = location.pathname + location.search;
  const seed = initialData || initialPage();
  const [state, setState] = useState(() => ({ path: seed?.requestPath, data: seed?.study, error: "" }));
  const [retry, setRetry] = useState(0);
  const data = state.path === requestPath ? state.data : null;
  usePageLoading(!data && !(state.path === requestPath && state.error));
  useEffect(() => {
    if (data) { applyMetadata(data.meta); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ path: location.pathname, page: new URLSearchParams(location.search).get("page") || "1" });
    axios.get(`/public-page?${params}`, { signal: controller.signal }).then(({ data: result }) => {
      // An old or renamed address moves to the page's current one.
      if (result.redirect) { navigate(result.redirect, { replace: true }); return; }
      setState({ path: requestPath, data: result.study, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ path: requestPath, data: null, error: error.response?.status === 404 ? "This study page is unavailable." : "We could not load this study page. Please try again." });
    });
    return () => controller.abort();
  }, [data, location.pathname, location.search, requestPath, retry, navigate]);
  if (!data) return <section className="study-page" aria-busy={!state.error}>{state.path === requestPath && state.error ? <div role="alert"><h1>Unable to load this page</h1><p>{state.error}</p><button onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} /> Try again</button><Link to="/learn">Browse study resources</Link></div> : <div className="study-skeleton" role="status"><span className="sr-only">Loading study resources</span><i /><i /><i /></div>}</section>;
  const readable = data.kind?.startsWith("seo-");
  const written = ["short_question", "long_question"].map(type => [type, (data.questions || []).filter(item => item.contentType === type)]);
  return <div className={`study-page ${readable ? "is-readable" : ""}`}>
    {!readable && <StructuredSEO page={data} manageMetadata={false} />}
    <nav aria-label="Breadcrumb" className="study-breadcrumbs">{data.breadcrumbs.map(item => <Link key={item.href} to={item.href}>{item.title}</Link>)}</nav>
    <header className="study-heading"><BookOpen size={26} /><h1>{data.title}</h1>{data.scope && <p className="study-scope">{data.scope}</p>}
      {data.intro?.length > 0 && <div className="study-intro">{data.intro.map((text, i) => <p key={i}>{text}</p>)}</div>}
    </header>
    {data.summary && <div className="study-summary">{data.summary.split(/\n+/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>}
    {data.kind === 'directory' && <StudyPathSelector options={data.studyOptions} />}
    {data.quickLinks?.length > 0 && <nav className="study-quick" aria-label="Jump to">{data.quickLinks.map((item, i) => { const Icon = QUICK_ICONS[i] || ClipboardList; return <Link key={item.href} to={item.href}><span className="study-quick-icon"><Icon size={20} /></span><span><strong>{item.title}</strong><small>{item.note}</small></span><ArrowRight size={18} /></Link>; })}</nav>}
    {!readable && <dl className="study-facts">{[["Publisher / source", data.sourceName], ["Edition", data.edition], ["Paper year", data.year], ["Exam type", data.examType], ["Session", data.session], ["Pattern", data.isNewPattern ? "New Pattern" : undefined], ["Questions", data.questionCount], ["Test duration", data.durationMinutes && `${data.durationMinutes} minutes`], ["Updated", data.updatedAt && new Date(data.updatedAt).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" })]].filter(([,value]) => value).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {data.sourceUrl && <p className="study-source">Source: <a href={data.sourceUrl} target="_blank" rel="noreferrer">{data.sourceName || "Original source"}</a></p>}
    {data.instructions?.length > 0 && <section><h2>Before you start</h2><ul>{data.instructions.map((instruction,i) => <li key={i}>{instruction}</li>)}</ul></section>}

    {data.notes?.length > 0 && <section aria-labelledby="study-notes-title">
      <h2 id="study-notes-title">Notes for this chapter</h2>
      <div className="study-notes">{data.notes.map(note => <div key={note.type} className={`study-note ${note.available ? "" : "is-missing"}`}>
        <FileText size={22} />
        <div><h3>{note.label}</h3><p>{note.title}</p></div>
        {note.available ? <Link to={note.href}>Read notes <ArrowRight size={15} /></Link> : <span className="study-note-soon">Coming soon</span>}
      </div>)}</div>
      <p className="study-note-hint"><Lock size={14} /> Sign in for free to download notes as PDF.</p>
    </section>}

    {data.mcqs?.length > 0 && <section aria-labelledby="study-mcq-title">
      <div className="study-mcq-heading"><h2 id="study-mcq-title">{data.mcqHeading || "MCQs with answers"}</h2>{data.mcqTotal > data.mcqs.length && <span>{data.mcqs.length} of {data.mcqTotal}</span>}</div>
      <ol className="study-mcqs">{data.mcqs.map((item, i) => <McqCard key={item._id} item={item} number={i + 1} />)}</ol>
      {data.mcqMore && <Link className="study-more" to={data.mcqMore.href}>{data.mcqMore.title} <ArrowRight size={16} /></Link>}
    </section>}

    {data.actions?.length > 0 && <nav className="study-actions" aria-label="Study tools">{data.actions.map(action => <Link key={action.href} to={action.href}>{/test/i.test(action.title) ? <PlayCircle size={17} /> : null}{action.title}<ArrowRight size={16} /></Link>)}</nav>}

    {written.map(([type, questions]) => questions.length ? <section key={type}><h2>{type === "short_question" ? "Short questions" : "Long questions"}</h2><ol className="study-questions">{questions.map(question => <li key={question._id}><div className="question-with-importance"><p><MathText text={question.questionText} /></p>{question.isImportant && <ImportantBadge />}</div></li>)}</ol></section> : null)}

    {data.kind === 'directory' ? <details className="study-directory-links"><summary>Browse all boards and classes</summary>{data.sections.map(section => <section key={section.title}><h2>{section.title}</h2><div className="study-link-grid">{section.links.map(item => <Link key={item.href} to={item.href} className="study-resource-link"><h3>{item.title}</h3><ArrowRight size={18} /></Link>)}</div></section>)}</details> : data.sections.map(section => <section key={section.title}><div className="study-section-head"><h2>{section.title}</h2>{section.hub && <Link to={section.hub.href}>{section.hub.title} <ArrowRight size={15} /></Link>}</div><div className="study-link-grid">{section.links.map(item => <Link key={item.href} to={item.href} className="study-resource-link"><div><h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}</div><ArrowRight size={18} /></Link>)}</div></section>)}

    {data.neighbours?.length > 0 && <nav className="study-neighbours" aria-label="More chapters">{data.neighbours.map(item => <Link key={item.href} to={item.href} className={item.label.startsWith("Next") ? "is-next" : ""}>{item.label.startsWith("Previous") && <ArrowLeft size={17} />}<span><small>{item.label}</small><strong>{item.title}</strong></span>{item.label.startsWith("Next") && <ArrowRight size={17} />}</Link>)}</nav>}

    {data.faqs?.length > 0 && <section className="study-faqs" aria-labelledby="study-faq-title"><h2 id="study-faq-title"><HelpCircle size={20} /> Frequently asked questions</h2>{data.faqs.map(item => <details key={item.question} open><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}

    {(data.previous || data.next) && <nav className="study-actions" aria-label="Pages">{data.previous && <Link to={data.previous}>Previous page</Link>}{data.next && <Link to={data.next}>Next page <ArrowRight size={16} /></Link>}</nav>}
    {!data.sections.length && !data.questions?.length && !data.mcqs?.length && !data.notes?.length && !data.summary && <p>Resources for this selection are being prepared. Browse the study library for available material.</p>}
  </div>;
}
