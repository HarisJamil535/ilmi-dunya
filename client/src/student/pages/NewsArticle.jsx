import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Loader2, Newspaper, SearchX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import "./news.css";
import { applyMetadata, initialPage } from "../../seo/pageMetadata";

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }) : "Latest";

export default function NewsArticle({ initialData }) {
  const [seed] = useState(() => initialData || initialPage());
  const { slug } = useParams();
  const [article, setArticle] = useState(seed?.article || null);
  const [loading, setLoading] = useState(!seed?.article);
  const [loadedSlug, setLoadedSlug] = useState(seed?.article?.slug);
  const [error, setError] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (seed?.article && (!slug || seed.article.slug === slug) ? Promise.resolve({ data: { article: seed.article } }) : axiosInstance.get(`/news/${slug}`, { signal: controller.signal }))
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const item = data.article;
        setArticle(item);
        setLoadedSlug(slug || item.slug);
        setError(false);
        setImageFailed(false);
        applyMetadata({ title: `${item.title} | IlmiDunya`, description: item.excerpt, path: `/news/${item.slug}`, indexable: item.isPublished && item.excerpt.length >= 60 && item.content.length >= 160, image: item.coverImage, article: true });
        document.title = `${item.title} | IlmiDunya`;
        document.querySelector('meta[name="description"]')?.setAttribute("content", item.excerpt);
        const schema = document.createElement("script");
        schema.id = "news-article-schema";
        schema.type = "application/ld+json";
        schema.textContent = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: item.title,
          description: item.excerpt,
          image: item.coverImage || undefined,
          datePublished: item.publishedAt,
          dateModified: item.updatedAt,
          author: { "@type": /ilmidunya/i.test(item.author || '') ? "Organization" : "Person", name: item.author || "IlmiDunya Editorial" },
          mainEntityOfPage: document.querySelector('link[rel="canonical"]')?.href,
        });
        document.getElementById("news-article-schema")?.remove();
        if (item.isPublished && item.excerpt.length >= 60 && item.content.length >= 160) document.head.appendChild(schema);
      })
      .catch(() => {
        if (!controller.signal.aborted) { setError(true); setLoadedSlug(slug); }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      document.getElementById("news-article-schema")?.remove();
    };
  }, [slug, seed]);

  if (loading || (slug && loadedSlug !== slug)) return <main className="news-state"><Loader2 className="animate-spin" size={28} />Loading story...</main>;
  if (error || !article) return <main className="news-state"><SearchX size={30} />This story is unavailable.<Link to="/news">Back to news</Link></main>;

  return (
    <main className="news-article">
      <div className="news-article-container">
        <Link to="/news" className="news-back"><ArrowLeft size={16} /> Back to all news</Link>
        <article>
          <header className="news-article-header">
            <span className="news-kicker">{article.category}</span>
            <h1>{article.title}</h1>
            <div className="news-meta">
              <span><CalendarDays size={15} />{formatDate(article.publishedAt)}</span>
              <span>By {article.author}</span>
            </div>
          </header>

          <div className="news-article-art">
            {article.coverImage && !imageFailed ? <img src={article.coverImage} alt={article.imageAlt || article.title} onError={() => setImageFailed(true)} /> : <Newspaper size={100} strokeWidth={1} />}
          </div>

          <div className="news-article-content">
            <p className="news-lead">{article.excerpt}</p>
            {article.sourceUrl && <p className="news-source">Source: <a href={article.sourceUrl} target="_blank" rel="noreferrer">{article.sourceName || "Original publication"}</a></p>}
            <div className="news-body">
              {article.content.split(/\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
