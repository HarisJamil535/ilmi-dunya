import { ArrowLeft, ArrowUpRight, BookOpen, Home, Newspaper, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import './not-found.css';

export default function NotFound({ admin = false }) {
  return (
    <section className={`not-found${admin ? ' not-found-admin' : ''}`} aria-labelledby="not-found-title">
      <div className="not-found-inner">
        <Link to="/" className="not-found-brand" aria-label="IlmiDunya home">
          <img src="/logo.png" width="36" height="36" alt="" /> IlmiDunya
        </Link>
        <div className="not-found-number" aria-hidden="true">4<span><BookOpen strokeWidth={1.3} /></span>4</div>
        <p className="not-found-eyebrow">404 / Page not found</p>
        <h1 id="not-found-title">Let’s get you back<br />to the right chapter.</h1>
        <p className="not-found-description">This page may have moved, or the link might be incorrect. There’s still plenty to explore.</p>
        <div className="not-found-actions">
          <Link className="not-found-primary" to={admin ? '/admin/dashboard' : '/'}><Home size={18} />{admin ? 'Go to dashboard' : 'Back to home'}</Link>
          <Link className="not-found-secondary" to="/learn"><BookOpen size={18} /> Browse study resources</Link>
        </div>
        <nav className="not-found-shortcuts" aria-label="Explore IlmiDunya">
          <Link to="/subjects"><ArrowLeft size={16} /> Find a subject</Link>
          <Link to="/tests"><ClipboardCheck size={16} /> Practise MCQs</Link>
          <Link to="/news"><Newspaper size={16} /> Education news <ArrowUpRight size={14} /></Link>
        </nav>
      </div>
    </section>
  );
}
