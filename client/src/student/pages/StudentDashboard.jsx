import { useEffect, useState } from "react";
import { Activity, BarChart3, Clock3, Loader2, LogOut, Play, Trophy, UserCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const response = await axiosInstance.get("/student-dashboard/summary");
      setData(response.data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const cards = [
    { label: "Tests Taken", value: data.summary.testsTaken, icon: Activity },
    { label: "Average Score", value: `${data.summary.averageScore}%`, icon: BarChart3 },
    { label: "Best Score", value: `${data.summary.bestScore}%`, icon: Trophy },
    { label: "Time Spent", value: `${Math.round(data.summary.totalTimeSpentSeconds / 60)}m`, icon: Clock3 },
  ];

  const logout = () => {
    localStorage.removeItem("studentToken");
    localStorage.removeItem("studentName");
    localStorage.removeItem("studentSchool");
    notifyStudentAuthChanged();
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl bg-gradient-to-br from-primary-dark to-slate-950 p-8 text-white">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-bold text-primary-muted">Welcome back</p>
              <h1 className="mt-2 text-3xl font-black">{data.student?.name || "Student"} Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-muted">Track your learning, resume tests, review performance and focus on weak areas.</p>
            </div>
            <button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <card.icon className="h-6 w-6 text-primary" />
              <p className="mt-4 text-3xl font-black text-slate-950">{card.value}</p>
              <p className="text-sm font-bold text-slate-500">{card.label}</p>
            </article>
          ))}
        </div>

        {data.inProgress.length > 0 && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-lg font-black text-amber-950">Resume unfinished test</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.inProgress.map((attempt) => (
                <Link key={attempt._id} to={`/tests/${attempt.assessment._id}/take`} className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm font-black text-slate-800">
                  {attempt.assessment.title}
                  <Play className="h-4 w-4 text-primary" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Recent test history</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {data.recentAttempts.map((attempt) => (
                <div key={attempt._id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-black text-slate-900">{attempt.assessment?.title}</p>
                    <p className="text-xs font-bold uppercase text-slate-400">{attempt.status}</p>
                  </div>
                  <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{attempt.percentage || 0}%</span>
                </div>
              ))}
              {data.recentAttempts.length === 0 && <p className="py-8 text-center text-sm font-bold text-slate-400">No test history yet.</p>}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <UserCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">Profile</h2>
                  <p className="text-xs font-bold text-slate-400">Student account</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <p><span className="font-black text-slate-500">Email:</span> {data.student?.email}</p>
                <p><span className="font-black text-slate-500">Phone:</span> {data.student?.phone}</p>
                <p><span className="font-black text-slate-500">City:</span> {data.student?.city}</p>
                <p><span className="font-black text-slate-500">School:</span> {data.student?.school}</p>
              </div>
              <button onClick={logout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-black text-rose-600">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Subject performance</h2>
              <div className="mt-4 space-y-3">
                {data.subjectPerformance.map((item) => (
                  <div key={item.subject}>
                    <div className="mb-1 flex justify-between text-sm font-bold">
                      <span>{item.subject}</span><span>{item.average}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${item.average}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Recommended next step</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Practice your weakest subject, then retake a chapter test to measure improvement.</p>
              <Link to="/tests" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-black text-white">Open MCQ tests</Link>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
};

export default StudentDashboard;
