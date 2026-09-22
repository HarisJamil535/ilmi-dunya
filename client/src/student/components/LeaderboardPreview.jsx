import { useEffect, useState } from "react";
import { ArrowRight, Crown, Loader2, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../api/axios";

export default function LeaderboardPreview() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
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
  }, [retry]);

  return <section className="home-section home-leaders">
    <div className="home-width">
      <div className="home-section-heading"><div><p className="home-eyebrow"><Trophy size={17} /> A little friendly competition</p><h2>Meet the students<br /><span>making every answer count.</span></h2></div><Link className="home-text-link" to="/leaderboard">Explore the leaderboard <ArrowRight size={18} /></Link></div>
      {loading ? <div className="home-empty" role="status"><Loader2 className="animate-spin" size={26} /><p>Finding our top learners...</p></div> :
        failed && !leaders.length ? <div className="home-empty" role="status"><p>Rankings are unavailable right now.</p><button className="home-text-link" onClick={() => setRetry((value) => value + 1)}>Try again <ArrowRight size={16} /></button></div> :
        !leaders.length ? <div className="home-empty"><Trophy size={40} /><div><strong>The next spot could be yours.</strong><p>Complete an MCQ test and start your journey up the leaderboard.</p></div><Link className="home-text-link" to="/tests">Start practising <ArrowRight size={16} /></Link></div> :
        <ol className="home-leader-list">{leaders.map((leader) => <li key={leader.studentId} className="home-leader-row">
          <span className="home-leader-rank" aria-label={`Rank ${leader.rank}`}>{leader.rank === 1 ? <Crown size={24} /> : String(leader.rank).padStart(2, "0")}</span>
          <span className="home-leader-avatar" aria-hidden="true">{leader.name?.slice(0, 1)}</span>
          <div><strong>{leader.name}</strong><small>{leader.className || "Student"}{leader.city ? ` / ${leader.city}` : ""}</small></div>
          <div className="home-leader-school"><small>{leader.school}</small></div>
          <div className="home-leader-points"><strong>{Number(leader.points).toLocaleString()}</strong><small>points</small></div>
        </li>)}</ol>}
      {failed && leaders.length > 0 && <p className="home-option-error" role="status">Showing the last available rankings. Reconnecting...</p>}
    </div>
  </section>;
}

