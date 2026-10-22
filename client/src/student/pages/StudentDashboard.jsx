import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useEffect, useState } from "react";
import { Activity, BarChart3, Clock3, Download, Flame, LogOut, Pencil, Play, Trophy, UserCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";
import { showStudentToast } from "../../shared/studentNotifications";
import SchoolFields from "../../shared/SchoolFields";
import { choiceFromStudent, useSchools, validateSchoolChoice } from "../../shared/schoolChoice";

// Lets a student choose or correct their school, class and section.
const SchoolEditor = ({ student, onSaved, onCancel }) => {
  const { schools, loading, failed } = useSchools();
  const [choice, setChoice] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const value = choice ?? choiceFromStudent(student, schools);

  const save = async () => {
    const problems = validateSchoolChoice(value, schools);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    try {
      const response = await axiosInstance.put("/students/me/school", value);
      onSaved(response.data.student);
    } catch (err) {
      showStudentToast({ type: "error", title: "Could not save", message: err.response?.data?.message || "Your school details could not be saved. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <SchoolFields value={value} onChange={(patch) => { setChoice({ ...value, ...patch }); setErrors({}); }} errors={errors} schools={schools} loading={loading} failed={failed} />
    <div className="flex gap-2">
      <button type="button" onClick={save} disabled={saving || loading} className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
      <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600">Cancel</button>
    </div>
  </div>;
};

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [editingSchool, setEditingSchool] = useState(false);
  usePageLoading(loading);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    axiosInstance.get("/student-dashboard/summary", { signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Your dashboard could not be loaded. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  }

  if (error || !data) {
    return <main className="flex min-h-[60vh] items-center justify-center px-4"><div className="text-center"><p role="alert" className="text-sm font-bold text-rose-700">{error || "Dashboard unavailable."}</p><button type="button" onClick={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white">Try again</button></div></main>;
  }

  const cards = [
    { label: "Tests Taken", value: data.summary.testsTaken, icon: Activity },
    { label: "Average Score", value: `${data.summary.averageScore}%`, icon: BarChart3 },
    { label: "Best Score", value: `${data.summary.bestScore}%`, icon: Trophy },
    { label: "Time Spent", value: `${Math.round(data.summary.totalTimeSpentSeconds / 60)}m`, icon: Clock3 },
    { label: "Day Streak", value: data.summary.learningStreak || 0, icon: Flame },
  ];

  const downloadResultCard = async () => {
    setDownloading(true);
    try {
      const response = await axiosInstance.get("/student-dashboard/result-card", { responseType: "blob", timeout: 60000 });
      const fileName = /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || "IlmiDunya-Result-Card.pdf";
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      // Errors for file downloads arrive as a Blob; read the message out of it.
      let message = "Your result card could not be created. Please try again.";
      try { message = JSON.parse(await err.response.data.text()).message || message; } catch { /* keep the default message */ }
      showStudentToast({ type: "error", title: "Download failed", message });
    } finally {
      setDownloading(false);
    }
  };

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
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadResultCard} disabled={downloading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-primary-dark transition hover:bg-primary-soft disabled:opacity-60">
                <Download className="h-4 w-4" />
                {downloading ? "Preparing PDF..." : "Download result card"}
              </button>
              <button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                  <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{attempt.resultsWithheld ? "Pending" : `${attempt.percentage || 0}%`}</span>
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
                {data.student?.schoolClass && <p><span className="font-black text-slate-500">Class:</span> {data.student.schoolClass}</p>}
                {data.student?.schoolSection && <p><span className="font-black text-slate-500">Section:</span> {data.student.schoolSection}</p>}
              </div>
              {editingSchool
                ? <SchoolEditor student={data.student} onCancel={() => setEditingSchool(false)} onSaved={(student) => {
                  setData((current) => ({ ...current, student: { ...current.student, school: student.school, schoolId: student.schoolId, schoolClass: student.schoolClass, schoolSection: student.schoolSection } }));
                  localStorage.setItem("studentSchool", student.school || "");
                  setEditingSchool(false);
                  showStudentToast({ type: "success", title: "School updated", message: "Your result card will use these details." });
                }} />
                : <button type="button" onClick={() => setEditingSchool(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-primary/40 hover:text-primary"><Pencil className="h-3.5 w-3.5" />Edit school, class and section</button>}
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
              {data.weakTopics?.length > 0 ? <>
                <p className="mt-2 text-sm leading-6 text-slate-500">Review these areas, then retake their tests to measure improvement.</p>
                <ul className="mt-3 space-y-2">
                  {data.weakTopics.map((item) => <li key={`${item.level}-${item.name}`} className="flex justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"><span>{item.name}{item.subject && item.level !== "subject" ? <small className="block text-xs font-semibold text-rose-500">{item.subject}</small> : null}</span><span>{item.average}%</span></li>)}
                </ul>
              </> : <p className="mt-2 text-sm leading-6 text-slate-500">Practice your weakest subject, then retake a chapter test to measure improvement.</p>}
              <Link to="/tests" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-black text-white">Open MCQ tests</Link>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
};

export default StudentDashboard;
