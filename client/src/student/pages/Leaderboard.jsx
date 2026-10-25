import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useContext, useEffect, useMemo, useState } from "react";
import { Award, ChevronDown, Crown, Filter, Medal, RefreshCw, School, Target, Timer, Trophy, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useStudentSession } from "../../auth/useStudentSession";
import axiosInstance from "../../api/axios";
import CustomSelect from "../../shared/CustomSelect";
import { AppContext } from "../../context/AppContext";
import { formatScore } from "../utils/resultFormat";
import "./learning-experience.css";

const podiumStyles = {
  1: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 shadow-amber-100",
  2: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-slate-100",
  3: "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-orange-100",
};

const rankIcon = (rank) => {
  if (rank === 1) return <Crown className="h-7 w-7 text-amber-500" />;
  if (rank === 2) return <Medal className="h-7 w-7 text-slate-500" />;
  if (rank === 3) return <Medal className="h-7 w-7 text-orange-500" />;
  return <span className="text-sm font-black text-slate-500">#{rank}</span>;
};

const perQuestion = (seconds = 0) => `${Number(seconds || 0).toFixed(1)}s`;
const PERIODS = [["week", "This week"], ["month", "This month"], ["all", "All time"]];

const HOW_IT_WORKS = [
  ["Accuracy matters most", "Your score is mostly how many answers you get right. More tests help, but they never beat higher accuracy."],
  ["Your first attempt counts most", "Each test: 60% from your first attempt, 40% from your best retake. A retake counts 12 hours after your last one, up to 3 times."],
  ["Speed is a small bonus", "Finish early with at least 60% correct to earn up to 10% extra. Answering in under 3 seconds a question is treated as guessing and scores 0."],
  ["Longer tests count more", "Any test of 10 or more questions counts, and longer ones count more. For each chapter, your chapter test or your topic tests count, whichever is better."],
  ["Steady work wins", "One counted test puts you on the board. A few lucky tests are pulled toward 50%, so consistent accuracy across many tests ranks highest. Your score is out of 1000."],
  ["Finish what you start", "Leaving a test without submitting does not hide it: it is marked with your saved answers when its time runs out."],
];

const Leaderboard = () => {
  const { boards, classes, groups, isLoadingContext } = useContext(AppContext);
  const [filters, setFilters] = useState({ board: "", class: "", group: "", subject: "" });
  const [period, setPeriod] = useState("all");
  const signedIn = useStudentSession();
  const [mine, setMine] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  usePageLoading(loading || isLoadingContext);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const loadSubjects = async () => {
      setSubjects([]);
      setFilters((current) => ({ ...current, subject: "" }));
      if (!filters.board || !filters.class || !filters.group) return;
      const response = await axiosInstance.get(`/subjects?boardId=${filters.board}&classId=${filters.class}&groupId=${filters.group}`);
      setSubjects(response.data.subjects || []);
    };
    loadSubjects().catch(() => setSubjects([]));
  }, [filters.board, filters.class, filters.group]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "15", period });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, period]);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    const controller = new AbortController();
    setLoading(true);
    const load = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await axiosInstance.get(`/leaderboard?${query}`, { signal: controller.signal });
        if (!mounted) return;
        setLeaders(response.data.leaders || []);
        if (signedIn) axiosInstance.get(`/leaderboard/me?${query}`, { signal: controller.signal }).then(({ data }) => mounted && setMine(data)).catch(() => mounted && setMine(null));
        else setMine(null);
        setUpdatedAt(response.data.generatedAt || new Date().toISOString());
        setError("");
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || "Rankings could not be refreshed. Please try again.");
      } finally {
        inFlight = false;
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 20000);
    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [query, refresh, signedIn]);

  const topThree = leaders.slice(0, 3);
  const rest = leaders.slice(3);


  return (
    <main className="leaderboard-page learning-page">
      <section className="leaderboard-wrap mx-auto max-w-7xl space-y-8">
        <header className="leaderboard-header learning-enter">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="learning-eyebrow leaderboard-kicker">
                <Trophy className="h-4 w-4" />
                Student honour roll
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">The top learners</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Great practice deserves to be seen. These learners are turning consistent effort into progress.
              </p>
            </div>
            <div className="leaderboard-live">
              <span><i /> Live rankings</span>
              {updatedAt && <p>Updated {new Date(updatedAt).toLocaleTimeString()}</p>}
              <button onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="leaderboard-refresh"><RefreshCw size={15} /> Refresh</button>
            </div>
          </div>
        </header>

        <section className="leaderboard-filters">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-700">
            <Filter className="h-4 w-4 text-primary" />
            Filter leaders
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <CustomSelect label="Board" value={filters.board} disabled={isLoadingContext} placeholder="All Boards" options={boards.map((item) => ({ value: item._id, label: item.name }))} onChange={(value) => setFilters({ ...filters, board: value })} />
            <CustomSelect label="Class" value={filters.class} disabled={isLoadingContext} placeholder="All Classes" options={classes.map((item) => ({ value: item._id, label: item.name }))} onChange={(value) => setFilters({ ...filters, class: value })} />
            <CustomSelect label="Group" value={filters.group} disabled={isLoadingContext} placeholder="All Groups" options={groups.map((item) => ({ value: item._id, label: item.name }))} onChange={(value) => setFilters({ ...filters, group: value })} />
            <CustomSelect label="Subject" value={filters.subject} disabled={!filters.board || !filters.class || !filters.group} placeholder="All Subjects" options={subjects.map((item) => ({ value: item._id, label: item.name }))} onChange={(value) => setFilters({ ...filters, subject: value })} />
          </div>
        </section>

        <div className="leaderboard-periods" role="tablist" aria-label="Ranking period">
          {PERIODS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={period === value} onClick={() => setPeriod(value)} className={period === value ? "is-active" : ""}>{label}</button>)}
        </div>

        {signedIn && mine && <section className="leaderboard-mine" aria-label="Your position">
          <span className="leaderboard-mine-icon"><Target size={22} /></span>
          {mine.ranked
            ? <div><strong>You are #{mine.rank} of {mine.of}</strong><p>Score {formatScore(mine.points)} · {Number(mine.accuracy).toFixed(1)}% accuracy · {mine.testsTaken} tests · {perQuestion(mine.secondsPerQuestion)} per question</p></div>
            : <div><strong>{mine.testsNeeded > 0 ? `Take ${mine.testsNeeded} more ${mine.testsNeeded === 1 ? "test" : "tests"} to get ranked` : "Keep practising to get ranked"}</strong><p>You have {mine.testsTaken} counted {mine.testsTaken === 1 ? "test" : "tests"} {period === "all" ? "so far" : period === "week" ? "this week" : "this month"}. Every test of 10 or more questions counts.</p></div>}
          <Link to="/tests" className="leaderboard-mine-link">Take a test</Link>
        </section>}

        <details className="leaderboard-how">
          <summary><Trophy size={16} /> How ranking works <ChevronDown size={16} className="leaderboard-how-chevron" /></summary>
          <ul>{HOW_IT_WORKS.map(([title, text]) => <li key={title}><strong>{title}</strong><span>{text}</span></li>)}</ul>
        </details>
        {error && <p className="learning-alert" role="alert">{error}</p>}

        {loading ? (
          <div className="flex justify-center rounded-3xl border border-slate-200 bg-white py-20">
            <Spinner />
          </div>
        ) : leaders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Award className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-xl font-black text-slate-950">No rankings yet</h2>
            <p className="mt-2 text-sm text-slate-500">Students appear here after completing at least 3 full MCQ tests{period === "week" ? " this week" : period === "month" ? " this month" : ""} for the selected filters.</p>
          </div>
        ) : (
          <>
            <section className="leaderboard-podium-grid">
              {topThree.map((leader, index) => (
                <article
                  key={leader.studentId}
                  style={{ animationDelay: `${index * 90}ms` }}
                  className={`leaderboard-podium learning-enter relative border p-6 transition duration-300 motion-safe:hover:-translate-y-1 ${podiumStyles[leader.rank] || podiumStyles[3]}`}
                >
                  <div className="podium-rank-watermark">#{leader.rank}</div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="podium-medal">
                      {rankIcon(leader.rank)}
                    </div>
                    <span className="podium-points">{formatScore(leader.points)} <small>SCORE</small></span>
                  </div>
                  <h2 className="mt-6 text-2xl font-black text-slate-950">{leader.name}</h2>
                  <div className="podium-details">
                    <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> {leader.className || "Student"} · {leader.city || "Pakistan"}</p>
                    <p className="flex items-center gap-2"><School className="h-4 w-4 text-primary" /> {leader.school}</p>
                  </div>
                  <div className="podium-metrics">
                    <span><strong>{Number(leader.averagePercentage).toFixed(2)}%</strong><small>Accuracy</small></span>
                    <span><strong>{leader.testsTaken}</strong><small>Tests</small></span>
                    <span><strong>{perQuestion(leader.secondsPerQuestion)}</strong><small>Per question</small></span>
                  </div>
                  <div className="podium-progress" aria-hidden="true"><div style={{ width: `${Math.min(100, Math.max(0, leader.averagePercentage))}%` }} /></div>
                </article>
              ))}
            </section>

            {rest.length > 0 && <section className="leaderboard-table">
              <div className="leaderboard-table-header">
                <div><span className="learning-eyebrow">Full ranking</span><h2>Keep climbing</h2></div>
                <span>{rest.length} learners</span>
              </div>
              <div className="divide-y divide-slate-100">
                {rest.map((leader) => (
                  <article key={leader.studentId} className="leaderboard-row learning-enter">
                    <div className="leaderboard-rank">{String(leader.rank).padStart(2, "0")}</div>
                    <div>
                      <h3 className="font-black text-slate-950">{leader.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{leader.className || "Student"} · {leader.city || "Pakistan"} · {leader.school}</p>
                    </div>
                    <p className="leaderboard-row-points">{formatScore(leader.points)}<small>score</small></p>
                    <p className="leaderboard-row-accuracy">{Number(leader.averagePercentage).toFixed(2)}%<small>accuracy</small></p>
                    <p className="leaderboard-row-time"><Timer className="h-4 w-4" /> {perQuestion(leader.secondsPerQuestion)} <small>/ question</small></p>
                  </article>
                ))}
              </div>
            </section>}
          </>
        )}
      </section>
    </main>
  );
};

export default Leaderboard;
