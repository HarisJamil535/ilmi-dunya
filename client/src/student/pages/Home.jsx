import { useEffect, useState } from "react";
import { ArrowRight, Check, GraduationCap, LayoutDashboard, Plus, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import Features from "../components/Features";
import Hero from "../components/Hero";
import LeaderboardPreview from "../components/LeaderboardPreview";
import Testimonials from "../components/Testimonials";
import NewsHighlights from "../components/NewsHighlights";
import axiosInstance from "../../api/axios";
import { useStudentSession } from "../../auth/useStudentSession";
import "./home.css";
import { initialPage } from "../../seo/pageMetadata";

const questions = [
  ["How do I find resources for my class and board?", "Choose your class and education board above, then open your subject. You can browse the available chapters, topics, notes, books and past papers from there."],
  ["Do I need an account to take MCQ tests?", "Yes. Sign in to take a chapter or topic test, save your results and track your learning progress in your student dashboard."],
  ["Can I practise a single topic?", "Yes. Open a subject, expand a chapter and choose the test button next to a topic. The chapter test covers the MCQs added across that chapter."],
  ["Where can I find books and past papers?", "Open your selected subject to find its available textbook and past papers. Sign in to download books and notes. Past papers are organised with their uploaded year and session labels."],
];

export default function Home({ initialData }) {
  const [seed] = useState(() => initialData || initialPage());
  const [content, setContent] = useState(seed?.home || { stats: [], testimonials: [] });
  const [loading, setLoading] = useState(!seed?.home);
  const [news, setNews] = useState(seed?.news || []);
  const signedIn = useStudentSession();

  useEffect(() => {
    const title = "IlmiDunya | Board Notes, Past Papers & MCQ Tests in Pakistan";
    const description = "Prepare for Pakistani board exams with class-wise notes, textbooks, past papers, video lessons and chapter and topic MCQ tests on IlmiDunya.";
    document.title = title;
    for (const [selector, value] of [[ 'meta[name="description"]', description ], ['meta[property="og:title"]', title], ['meta[property="og:description"]', description], ['meta[name="twitter:title"]', title], ['meta[name="twitter:description"]', description]]) {
      document.querySelector(selector)?.setAttribute("content", value);
    }
    const siteUrl = document.querySelector('link[rel="canonical"]')?.href;
    if (siteUrl) document.querySelector('meta[property="og:url"]')?.setAttribute("content", siteUrl);
    const controller = new AbortController();
    if (seed?.home) return () => controller.abort();
    axiosInstance.get("/home-content", { signal: controller.signal })
      .then(({ data }) => setContent({ stats: data.stats || [], testimonials: data.testimonials || [] }))
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    axiosInstance.get("/news/featured", { signal: controller.signal }).then(({ data }) => setNews(data.articles || [])).catch(() => {});
    return () => controller.abort();
  }, [seed]);

  return <div className="home-page">
    <Hero stats={content.stats} />
    <NewsHighlights articles={news} />
    {signedIn && <div className="home-continue"><div className="home-width"><LayoutDashboard size={22} /><div><strong>Welcome back. Keep your momentum.</strong><p>Your test history and learning progress are waiting.</p></div><Link to="/dashboard">My dashboard <ArrowRight size={18} /></Link></div></div>}
    <Features />
    <section className="home-section home-journey"><div className="home-width">
      <div className="home-section-heading"><div><p className="home-eyebrow">Small steps. Bigger possibilities.</p><h2>Make your next<br /><span>study session count.</span></h2></div><Link className="home-text-link" to="/subjects">Find your starting point <ArrowRight size={18} /></Link></div>
      <ol className="home-steps">
        {[["01", "Find your focus", "Choose your board, class and subject. Your learning journey starts here."], ["02", "Build your understanding", "Read the notes, watch a lesson and work through one topic at a time."], ["03", "See how far you have come", "Take a test, learn from the explanations and make your next attempt stronger."]].map(([number, title, text]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></li>)}
      </ol>
    </div></section>
    <LeaderboardPreview />
    <Testimonials reviews={content.testimonials} loading={loading} />
    {news.length > 0 && <section className="home-section home-news" aria-labelledby="home-news-title"><div className="home-width">
      <div className="home-section-heading"><div><p className="home-eyebrow"><Newspaper size={17} /> Beyond the classroom</p><h2 id="home-news-title">Stay curious.<br /><span>Stay a step ahead.</span></h2></div><Link className="home-text-link" to="/news">All education news <ArrowRight size={18} /></Link></div>
      <div className="home-news-grid">{news.slice(0, 3).map((article) => <Link className="home-news-story" key={article._id || article.slug} to={`/news/${article.slug}`}>
        <div className="home-news-image">{article.coverImage ? <img src={article.coverImage} alt="" loading="lazy" decoding="async" /> : <Newspaper size={48} strokeWidth={1.5} />}</div>
        <p>{article.category || "Education"}</p><h3>{article.title}</h3><span>Read story <ArrowRight size={16} /></span>
      </Link>)}</div>
    </div></section>}
    <section className="home-section home-faq" aria-labelledby="home-faq-title"><div className="home-width home-faq-layout">
      <div><p className="home-eyebrow">A little guidance</p><h2 id="home-faq-title">Ready to begin?<br /><span>Start here.</span></h2><p className="home-faq-intro">A few answers to help you find your way and get straight to learning.</p><Link className="home-text-link" to="/subjects">Explore your subjects <ArrowRight size={18} /></Link></div>
      <div className="home-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
    </div></section>
    <section className="home-section home-invitation"><div className="home-width">
      <GraduationCap size={42} strokeWidth={1.5} /><p className="home-eyebrow">Your next chapter starts here</p>
      <h2>A little more curious.<br />A lot more confident.</h2>
      <p>Bring your ambition. We will help with the practice.</p>
      <Link className="home-button" to={signedIn ? "/dashboard" : "/register"}>{signedIn ? "Continue learning" : "Create your student account"}<ArrowRight size={18} /></Link>
      <span className="home-invitation-note"><Check size={15} /> Save your results. See your progress. Keep growing.</span>
    </div></section>
  </div>;
}
