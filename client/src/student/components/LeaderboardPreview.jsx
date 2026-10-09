import { useEffect, useRef, useState } from "react";
import { ArrowRight, Crown, Trophy, Medal } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../api/axios";

export default function LeaderboardPreview() {
  const section = useRef(null);
  const [active, setActive] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!section.current || !('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setActive(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActive(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px' });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const { data } = await axiosInstance.get("/leaderboard?limit=5", { signal: controller.signal });
        setLeaders(data.leaders || []);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    const interval = window.setInterval(load, 30000);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", load);
    };
  }, [active, retry]);

  return <section ref={section} className="home-section home-leaders">
    <div className="home-width">
      <div className="home-section-heading"><div><p className="home-eyebrow"><Trophy size={17} /> The learning leaderboard</p><h2>A little practice.<br /><span>A place at the top.</span></h2><p className="home-leaders-intro">Celebrating the students turning their knowledge into progress. Your next test could move you up.</p></div><Link className="home-text-link" to="/leaderboard">View all rankings <ArrowRight size={18} /></Link></div>
      {loading ? <div className="home-leader-loading" role="status" aria-label="Loading top learners"><div /><div /><div /></div> :
        failed && !leaders.length ? <div className="home-empty" role="status"><p>Rankings are unavailable right now.</p><button className="home-text-link" onClick={() => setRetry((value) => value + 1)}>Try again <ArrowRight size={16} /></button></div> :
        !leaders.length ? <div className="home-empty"><Trophy size={40} /><div><strong>The next spot could be yours.</strong><p>Complete an MCQ test and start your journey up the leaderboard.</p></div><Link className="home-text-link" to="/tests">Start practising <ArrowRight size={16} /></Link></div> :
        <>
        <ol className="home-podium">{leaders.slice(0, 3).map((leader) => <li key={leader.studentId} className={`home-podium-person ${leader.rank === 1 ? "home-podium-first" : ""}`}>
          <div className="home-podium-top"><span className="home-podium-place">{leader.rank === 1 ? <Crown size={19} /> : <Medal size={19} />} Rank {leader.rank}</span><Trophy size={25} strokeWidth={1.4} aria-hidden="true" /></div>
          <div className="home-podium-identity"><span className="home-podium-avatar" aria-hidden="true">{leader.name?.trim().slice(0, 1).toUpperCase()}</span><div><h3>{leader.name}</h3><p>{leader.className || "Student"}{leader.city ? ` · ${leader.city}` : ""}</p></div></div>
          {leader.school && <p className="home-podium-school">{leader.school}</p>}
          <div className="home-podium-score"><strong>{Number(leader.points).toLocaleString()}</strong><span>earned points</span><span className="home-podium-mark" aria-hidden="true">{String(leader.rank).padStart(2, "0")}</span></div>
        </li>)}</ol>
        {leaders.length > 3 && <ol className="home-leader-list" start={4}>{leaders.slice(3).map((leader) => <li key={leader.studentId} className="home-leader-row">
          <span className="home-leader-rank" aria-label={`Rank ${leader.rank}`}>{leader.rank === 1 ? <Crown size={24} /> : String(leader.rank).padStart(2, "0")}</span>
          <span className="home-leader-avatar" aria-hidden="true">{leader.name?.slice(0, 1)}</span>
          <div><strong>{leader.name}</strong><small>{leader.className || "Student"}{leader.city ? ` / ${leader.city}` : ""}</small></div>
          <div className="home-leader-school"><small>{leader.school}</small></div>
          <div className="home-leader-points"><strong>{Number(leader.points).toLocaleString()}</strong><small>points</small></div>
        </li>)}</ol>}
        <div className="home-leader-invite"><span><strong>Your name could be next.</strong> Keep learning, one test at a time.</span><Link to="/tests">Take a practice test <ArrowRight size={17} /></Link></div>
        </>}
      {failed && leaders.length > 0 && <p className="home-option-error" role="status">Showing the last available rankings. Reconnecting...</p>}
    </div>
  </section>;
}
