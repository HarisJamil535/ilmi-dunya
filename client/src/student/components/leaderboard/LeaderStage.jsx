import { useEffect, useRef, useState } from "react";
import { Crown, Flame, Target, Timer } from "lucide-react";
import { formatScore } from "../../utils/resultFormat";
import "./leaderStage.css";

// Counts a number up smoothly when it first appears or changes.
function useCountUp(value, duration = 1200, delay = 0) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const instant = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf; const start = from.current; let t0 = null;
    const step = (t) => {
      if (t0 === null) t0 = t + delay;
      const p = instant ? 1 : Math.min(1, Math.max(0, (t - t0) / duration));
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);
  return shown;
}

const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
const shortName = (name = "") => { const [a, b] = name.split(/\s+/); return b ? `${a} ${b[0]}.` : a || "Student"; };
const TIER = { 1: "gold", 2: "silver", 3: "bronze" };
const LABEL = { 1: "Champion", 2: "Runner-up", 3: "Third place" };
// Bar heights for the podium graph, scaled from the points so the gap between places is visible.
const heightFor = (points, top) => 46 + 54 * Math.max(0, Math.min(1, (Number(points) || 0) / (Number(top) || 1)));

function Step({ leader, top, order }) {
  const tier = TIER[leader.rank] || "bronze";
  const points = useCountUp(leader.points, 1400, 450 + order * 160);
  const accuracy = useCountUp(leader.averagePercentage, 1400, 450 + order * 160);
  return <article className={`ls-step is-${tier}`} style={{ "--order": order, "--h": `${heightFor(leader.points, top)}%` }}>
    <div className="ls-person">
      {leader.rank === 1 && <Crown className="ls-crown" aria-hidden="true" />}
      <div className="ls-avatar"><span>{initials(leader.name)}</span><b aria-label={`Rank ${leader.rank}`}>{leader.rank}</b></div>
      <h3 title={leader.name}>{shortName(leader.name)}</h3>
      <p>{[leader.city, leader.className].filter(Boolean).join(" · ") || "Pakistan"}</p>
    </div>
    <div className="ls-bar">
      <div className="ls-bar-fill">
        <span className="ls-bar-shine" aria-hidden="true" />
        <strong className="ls-place">{leader.rank}</strong>
        <span className="ls-label">{LABEL[leader.rank]}</span>
        <span className="ls-pts">{formatScore(points)} <small>pts</small></span>
        <span className="ls-acc"><Target size={12} />{accuracy.toFixed(1)}%</span>
      </div>
    </div>
  </article>;
}

export function LeaderPodium({ leaders, periodLabel, updatedAt }) {
  const top = leaders[0]?.points || 1;
  // Silver on the left, gold in the middle, bronze on the right.
  const order = [leaders[1], leaders[0], leaders[2]].filter(Boolean);
  return <section className="ls-stage" aria-label="Top three learners">
    <div className="ls-stage-glow" aria-hidden="true" />
    <div className="ls-sparkles" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>
    <header className="ls-stage-head">
      <span className="ls-live"><i />Live ranking</span>
      <span className="ls-stage-meta">{periodLabel}{updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
    </header>
    <div className={`ls-podium is-${order.length}`}>
      {order.map((leader) => <Step key={leader.studentId} leader={leader} top={top} order={leader.rank === 1 ? 2 : leader.rank === 2 ? 0 : 1} />)}
    </div>
  </section>;
}

function Row({ leader, top, index }) {
  const points = useCountUp(leader.points, 1100, 200 + index * 70);
  const width = Math.max(4, Math.min(100, ((Number(leader.points) || 0) / (Number(top) || 1)) * 100));
  return <li className="ls-row" style={{ "--i": index, "--w": `${width}%` }}>
    <span className="ls-row-rank">#{leader.rank}</span>
    <span className="ls-row-avatar">{initials(leader.name)}</span>
    <div className="ls-row-main">
      <div className="ls-row-top">
        <div className="min-w-0"><h4>{leader.name}</h4><p>{[leader.className, leader.city, leader.school].filter(Boolean).join(" · ")}</p></div>
        <div className="ls-row-chips">
          <span className="ls-chip is-streak" title="Tests counted"><Flame size={12} />{leader.testsTaken} tests</span>
          <span className="ls-chip is-time" title="Average time per question"><Timer size={12} />{Number(leader.secondsPerQuestion || 0).toFixed(1)}s</span>
          <span className="ls-chip is-pts">{formatScore(points)} pts</span>
        </div>
      </div>
      <div className="ls-row-graph" aria-label={`${Number(leader.averagePercentage).toFixed(1)}% accuracy`}><div /><em>{Number(leader.averagePercentage).toFixed(1)}%</em></div>
    </div>
  </li>;
}

export function LeaderList({ leaders, top }) {
  return <section className="ls-list" aria-label="More top learners">
    <header><h3><span className="ls-list-icon" aria-hidden="true">≡</span>Honourable mentions <small>(#{leaders[0].rank}–#{leaders[leaders.length - 1].rank})</small></h3><span>Bars show score compared with #1</span></header>
    <ol>{leaders.map((l, i) => <Row key={l.studentId} leader={l} top={top} index={i} />)}</ol>
  </section>;
}
