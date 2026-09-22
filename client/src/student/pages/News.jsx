import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Loader2, Newspaper, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import "./news.css";
import { applyMetadata, initialPage } from "../../seo/pageMetadata";

const categories = ["All", "Education News", "Exam Updates", "Study Guide", "Student Stories"];

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "Latest";

const NewsImage = ({ article, className = "", eager = false }) => {
  const [failedSource, setFailedSource] = useState(null);
  const imageFailed = failedSource === article.coverImage;

  return (
    <div className={`news-image ${className}`}>
      {article.coverImage && !imageFailed ? (
        <img src={article.coverImage} alt="" loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : "auto"} onError={() => setFailedSource(article.coverImage)} />
      ) : (
        <div className="news-image-empty">
          <Newspaper size={44} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
};

export default function News({ initialData }) {
  const [seed] = useState(() => initialData || initialPage());
  const [params, setParams] = useSearchParams();
  const [articles, setArticles] = useState(seed?.news || []);
  const [loadedKey, setLoadedKey] = useState(seed?.news ? `${seed.category || "All"}:${seed.page || 1}` : null);
  const [total, setTotal] = useState(seed?.total || 0);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(false);
  const category = params.get("category") || "All";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get("page"), 10) || 1));
  const key = `${category}:${page}`;
  const loading = loadedKey !== key;
  const pageHref = (number) => {
    const query = new URLSearchParams();
    if (category !== "All") query.set("category", category);
    if (number > 1) query.set("page", number);
    return `/news${query.size ? `?${query}` : ""}`;
  };

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (category !== "All") query.set("category", category);
    if (page > 1) query.set("page", page);
    const path = `/news${query.size ? `?${query}` : ""}`;
    applyMetadata({ title: `Pakistan Education News${page > 1 ? ` - Page ${page}` : ""} | IlmiDunya`, description: "Education news, exam updates, study guides and student stories for Pakistani students.", path, indexable: category === "All" && Boolean(seed?.news?.length) });
    const request = seed?.news && category === (seed.category || "All") && page === (seed.page || 1) && !retry
      ? Promise.resolve({ data: { articles: seed.news, total: seed.total } })
      : axiosInstance.get(`/news?${query}&limit=24`, { signal: controller.signal });
    request.then(({ data }) => {
      if (controller.signal.aborted) return;
      setError(false);
      setArticles(data.articles || []);
      setTotal(data.total || 0);
      setLoadedKey(key);
      applyMetadata({ title: `Pakistan Education News${page > 1 ? ` - Page ${page}` : ""} | IlmiDunya`, description: "Education news, exam updates, study guides and student stories for Pakistani students.", path, indexable: category === "All" && Boolean(data.articles?.length) });
    }).catch(() => {
      if (!controller.signal.aborted) { setError(true); setLoadedKey(key); }
    });
    return () => controller.abort();
  }, [category, page, key, seed, retry]);

  const featured = useMemo(() => articles.find((article) => article.isFeatured) || articles[0], [articles]);
  const remainingArticles = useMemo(() => articles.filter((article) => article.slug !== featured?.slug), [articles, featured]);

  return (
    <main className="news-page">
      <section className="news-hero">
        <div className="news-container news-hero-inner">
          <div>
            <p className="home-eyebrow"><Newspaper size={17} /> The IlmiDunya Journal</p>
            <h1>Education news with a student-first lens.</h1>
          </div>
          <p>Exam updates, study guidance and useful stories curated for students who want clear, practical next steps.</p>
        </div>
      </section>

      <div className="news-container news-content">
        <nav className="news-categories" aria-label="News categories">
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => item === "All" ? setParams({}) : setParams({ category: item })}>
              {item}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="news-state"><Loader2 className="animate-spin" size={28} />Loading the latest stories...</div>
        ) : error ? (
          <div className="news-state"><SearchX size={30} />News could not be loaded right now.<button type="button" onClick={() => { setLoadedKey(null); setRetry(value => value + 1); }}>Try again</button></div>
        ) : !articles.length ? (
          <div className="news-state"><SearchX size={30} />No stories in this category yet.</div>
        ) : (
          <>
            <article className="news-feature">
              <Link to={`/news/${featured.slug}`} className="news-feature-media" aria-label={`Read ${featured.title}`}>
                <NewsImage article={featured} eager />
              </Link>
              <div className="news-feature-copy">
                <span className="news-kicker">{featured.category}</span>
                <h2><Link to={`/news/${featured.slug}`}>{featured.title}</Link></h2>
                <p>{featured.excerpt}</p>
                <div className="news-feature-footer">
                  <span><CalendarDays size={15} />{formatDate(featured.publishedAt)}</span>
                  <Link to={`/news/${featured.slug}`} className="news-read-link">Read story <ArrowUpRight size={17} /></Link>
                </div>
              </div>
            </article>

            <div className="news-grid">
              {remainingArticles.map((article) => (
                <article key={article._id || article.slug} className="news-card">
                  <Link to={`/news/${article.slug}`} className="news-card-media" aria-label={`Read ${article.title}`}>
                    <NewsImage article={article} />
                  </Link>
                  <div className="news-card-body">
                    <div className="news-card-top">
                      <span className="news-kicker">{article.category}</span>
                      <span><CalendarDays size={14} />{formatDate(article.publishedAt)}</span>
                    </div>
                    <h2><Link to={`/news/${article.slug}`}>{article.title}</Link></h2>
                    <p>{article.excerpt}</p>
                    <Link to={`/news/${article.slug}`} className="news-card-link" aria-label={`Read ${article.title}`}>
                      Read more <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {(page > 1 || total > page * 24) && <nav aria-label="News pages" className="flex items-center justify-center gap-6 py-8">
              {page > 1 && <Link to={pageHref(page - 1)}>Previous page</Link>}
              <span>Page {page}</span>
              {total > page * 24 && <Link to={pageHref(page + 1)}>Next page</Link>}
            </nav>}
          </>
        )}
      </div>
    </main>
  );
}
