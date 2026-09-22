import { ArrowUpRight, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";

export default function NewsHighlights({ articles = [] }) {
  if (!articles.length) return null;
  return <section className="news-strip" aria-label="Latest education news"><div className="news-strip-inner home-width"><span className="news-strip-label"><Newspaper size={16} /> Latest</span><div className="news-strip-track">{articles.slice(0, 4).map((article) => <Link key={article._id || article.slug} to={`/news/${article.slug}`}><span>{article.category}</span>{article.title}<ArrowUpRight size={15} /></Link>)}</div><Link className="news-strip-all" to="/news">All news <ArrowUpRight size={15} /></Link></div></section>;
}
