import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BookOpen, RefreshCw } from "lucide-react";
import axios from "../../api/axios";
import { applyMetadata, initialPage } from "../../seo/pageMetadata";
import "./public-study.css";

export default function PublicStudyPage({ initialData }) {
  const location = useLocation();
  const requestPath = location.pathname + location.search;
  const seed = initialData || initialPage();
  const [state, setState] = useState(() => ({ path: seed?.requestPath, data: seed?.study, error: "" }));
  const [retry, setRetry] = useState(0);
  const data = state.path === requestPath ? state.data : null;
  useEffect(() => {
    if (data) { applyMetadata(data.meta); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ path: location.pathname, page: new URLSearchParams(location.search).get("page") || "1" });
    axios.get(`/public-page?${params}`, { signal: controller.signal }).then(({ data: result }) => {
      setState({ path: requestPath, data: result.study, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ path: requestPath, data: null, error: error.response?.status === 404 ? "This study page is unavailable." : "We could not load this study page. Please try again." });
    });
    return () => controller.abort();
  }, [data, location.pathname, location.search, requestPath, retry]);
  if (!data) return <section className="study-page" aria-busy={!state.error}>{state.path === requestPath && state.error ? <div role="alert"><h1>Unable to load this page</h1><p>{state.error}</p><button onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} /> Try again</button><Link to="/learn">Browse study resources</Link></div> : <div className="study-skeleton" role="status"><span className="sr-only">Loading study resources</span><i /><i /><i /></div>}</section>;
  return <div className="study-page">
    <nav aria-label="Breadcrumb" className="study-breadcrumbs">{data.breadcrumbs.map(item => <Link key={item.href} to={item.href}>{item.title}</Link>)}</nav>
    <header className="study-heading"><BookOpen size={26} /><h1>{data.title}</h1>{data.scope && <p>{data.scope}</p>}</header>
    {data.summary && <div className="study-summary">{data.summary.split(/\n+/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>}
    <dl className="study-facts">{[["Edition", data.edition], ["Paper year", data.year], ["Session", data.session], ["Questions", data.questionCount], ["Test duration", data.durationMinutes && `${data.durationMinutes} minutes`], ["Updated", data.updatedAt && new Date(data.updatedAt).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" })]].filter(([,value]) => value).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {data.sourceUrl && <p className="study-source">Source: <a href={data.sourceUrl} target="_blank" rel="noreferrer">{data.sourceName || "Original source"}</a></p>}
    {data.instructions?.length > 0 && <section><h2>Before you start</h2><ul>{data.instructions.map((instruction,i) => <li key={i}>{instruction}</li>)}</ul></section>}
    {data.sections.map(section => <section key={section.title}><h2>{section.title}</h2><div className="study-link-grid">{section.links.map(item => <Link key={item.href} to={item.href} className="study-resource-link"><div><h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}</div><ArrowRight size={18} /></Link>)}</div></section>)}
    {["short_question", "long_question"].map(type => { const questions = (data.questions || []).filter(item => item.contentType === type); return questions.length ? <section key={type}><h2>{type === "short_question" ? "Short questions" : "Long questions"}</h2><ol className="study-questions">{questions.map(question => <li key={question._id}><p>{question.questionText}</p>{question.examYear && <small>{question.examYear}{question.examSession ? ` / ${question.examSession}` : ""}</small>}</li>)}</ol></section> : null; })}
    {(data.previous || data.next) && <nav className="study-actions" aria-label="Pages">{data.previous && <Link to={data.previous}>Previous page</Link>}{data.next && <Link to={data.next}>Next page <ArrowRight size={16} /></Link>}</nav>}
    {data.actions?.length > 0 && <nav className="study-actions" aria-label="Study tools">{data.actions.map(action => <Link key={action.href} to={action.href}>{action.title}<ArrowRight size={16} /></Link>)}</nav>}
    {!data.sections.length && !data.questions?.length && !data.summary && <p>Resources for this selection are being prepared. Browse the study library for available material.</p>}
  </div>;
}
