import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, ClipboardCheck, FileText, GraduationCap, Layers, Newspaper, Users } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminLoader, AdminPageHeader } from "../components/AdminUI";

const useAnimatedNumber = (value = 0, duration = 850) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    let frame;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
};

const AnimatedCount = ({ value }) => {
  const display = useAnimatedNumber(value);
  return display.toLocaleString();
};

const AdminDashboard = () => {
  const [state, setState] = useState({ loading: true, error: "", counts: {}, recent: [] });
  const adminUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("adminUser") || "null"); } catch { return null; }
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const response = await axiosInstance.get("/admin/dashboard");
        setState({
          loading: false,
          error: "",
          counts: response.data.counts || {},
          recent: response.data.recentQuestions || [],
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error.response?.data?.message || "Dashboard data could not be loaded.",
        }));
      }
    };
    loadDashboard();
  }, []);

  const cards = [
    { title: "Boards", value: state.counts.boards, icon: Layers, tone: "bg-primary-soft text-primary" },
    { title: "Classes", value: state.counts.classes, icon: GraduationCap, tone: "bg-sky-50 text-sky-600" },
    { title: "Groups", value: state.counts.groups, icon: Users, tone: "bg-emerald-50 text-emerald-600" },
    { title: "Subjects", value: state.counts.subjects, icon: BookOpen, tone: "bg-amber-50 text-amber-600" },
    { title: "Chapters", value: state.counts.chapters, icon: FileText, tone: "bg-indigo-50 text-indigo-600" },
    { title: "Topics", value: state.counts.topics, icon: BarChart3, tone: "bg-teal-50 text-teal-600" },
    { title: "Books", value: state.counts.books, icon: BookOpen, tone: "bg-fuchsia-50 text-fuchsia-600" },
    { title: "Past Papers", value: state.counts.papers, icon: FileText, tone: "bg-rose-50 text-rose-600" },
    { title: "Questions", value: state.counts.questions, icon: ClipboardCheck, tone: "bg-lime-50 text-lime-700" },
    { title: "News", value: state.counts.news, icon: Newspaper, tone: "bg-orange-50 text-orange-600" },
  ];
  const maxCardValue = Math.max(...cards.map((card) => Number(card.value) || 0), 1);
  const contentBars = [
    { label: "Subjects", value: state.counts.subjects, color: "bg-primary" },
    { label: "Chapters", value: state.counts.chapters, color: "bg-sky-500" },
    { label: "Topics", value: state.counts.topics, color: "bg-emerald-500" },
    { label: "Questions", value: state.counts.questions, color: "bg-amber-500" },
  ];
  const resourceBars = [
    { label: "Books", value: state.counts.books, color: "bg-fuchsia-500" },
    { label: "Past Papers", value: state.counts.papers, color: "bg-rose-500" },
    { label: "News", value: state.counts.news, color: "bg-orange-500" },
    { label: "Students", value: state.counts.students, color: "bg-teal-500" },
  ];

  const BarChart = ({ title, items }) => {
    const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                <span className="text-slate-600">{item.label}</span>
                <span className="text-slate-950">{Number(item.value || 0).toLocaleString()}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${item.color} transition-all duration-700 ease-out`} style={{ width: `${Math.max(((Number(item.value) || 0) / max) * 100, item.value ? 8 : 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminPageHeader
          icon={BarChart3}
          eyebrow="Overview"
          title={`Welcome back, ${adminUser?.name || "Admin"}`}
          description="Live platform health, content totals and recent question-bank activity from the current database."
          statLabel="Role"
          statValue={adminUser?.role === "super_admin" ? "Super" : "Admin"}
        />

        {state.loading ? <AdminLoader label="Loading dashboard..." /> : (
          <>
            {state.error && <p className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">{state.error}</p>}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">{card.title}</p>
                        <p className="mt-2 text-3xl font-black text-slate-950"><AnimatedCount value={card.value || 0} /></p>
                      </div>
                      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${card.tone}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${Math.max(((Number(card.value) || 0) / maxCardValue) * 100, card.value ? 10 : 0)}%` }} />
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <BarChart title="Curriculum Coverage" items={contentBars} />
              <BarChart title="Resource Library" items={resourceBars} />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Recent Questions</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {state.recent.length ? state.recent.map((question) => (
                  <article key={question._id} className="py-4">
                    <p className="text-xs font-black uppercase tracking-wider text-primary">{question.contentType === "mcq" ? "MCQ" : question.contentType}</p>
                    <p className="mt-1 font-bold leading-7 text-slate-900">{question.questionText}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{question.subject?.name || "Subject"} / {question.chapter?.name || "Chapter"}</p>
                  </article>
                )) : <p className="py-8 text-sm font-semibold text-slate-400">No questions added yet.</p>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
