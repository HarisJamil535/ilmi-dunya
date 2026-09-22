import { useContext, useEffect, useMemo, useState } from "react";
import { Award, Crown, Filter, Loader2, Medal, RefreshCw, School, Timer, Trophy, UserRound, Sparkles } from "lucide-react";
import axiosInstance from "../../api/axios";
import CustomSelect from "../../shared/CustomSelect";
import { AppContext } from "../../context/AppContext";
import { formatDuration, formatScore } from "../utils/resultFormat";
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

const formatTime = (seconds = 0) => {
  return formatDuration(seconds);
};

const Leaderboard = () => {
  const { boards, classes, groups, isLoadingContext } = useContext(AppContext);
  const [filters, setFilters] = useState({ board: "", class: "", group: "", subject: "" });
  const [subjects, setSubjects] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
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
    const params = new URLSearchParams({ limit: "15" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

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
  }, [query, refresh]);

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

        <p className="leaderboard-rule"><Sparkles size={16} /> 100 points per earned mark. Your best attempt on each test counts toward your place.</p>
        {error && <p className="learning-alert" role="alert">{error}</p>}

        {loading ? (
          <div className="flex justify-center rounded-3xl border border-slate-200 bg-white py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : leaders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Award className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-xl font-black text-slate-950">No rankings yet</h2>
            <p className="mt-2 text-sm text-slate-500">Students will appear here after submitting MCQ tests for the selected filters.</p>
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
                    <span className="podium-points">{formatScore(leader.points)} <small>PTS</small></span>
                  </div>
                  <h2 className="mt-6 text-2xl font-black text-slate-950">{leader.name}</h2>
                  <div className="podium-details">
                    <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> {leader.className || "Student"} · {leader.city || "Pakistan"}</p>
                    <p className="flex items-center gap-2"><School className="h-4 w-4 text-primary" /> {leader.school}</p>
                  </div>
                  <div className="podium-metrics">
                    <span><strong>{Number(leader.averagePercentage).toFixed(2)}%</strong><small>Accuracy</small></span>
                    <span><strong>{leader.testsTaken}</strong><small>Best tests</small></span>
                    <span><strong>{formatTime(leader.totalTimeSeconds)}</strong><small>Total time</small></span>
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
                    <p className="leaderboard-row-points">{formatScore(leader.points)}<small>points</small></p>
                    <p className="leaderboard-row-accuracy">{Number(leader.averagePercentage).toFixed(2)}%<small>accuracy</small></p>
                    <p className="leaderboard-row-time"><Timer className="h-4 w-4" /> {formatTime(leader.totalTimeSeconds)}</p>
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
