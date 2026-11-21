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
import { LeaderList, LeaderPodium } from "../components/leaderboard/LeaderStage";

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
            <LeaderPodium leaders={topThree} periodLabel={(PERIODS.find(([v]) => v === period) || PERIODS[2])[1]} updatedAt={updatedAt} />
            {rest.length > 0 && <LeaderList key={query} leaders={rest} top={leaders[0]?.points} />}
          </>
        )}
      </section>
    </main>
  );
};

export default Leaderboard;
