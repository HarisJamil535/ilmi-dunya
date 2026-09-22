import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import axiosInstance from "@/api/axios";
import SmartSelect from "../../shared/CustomSelect";

const sortByTitle = (items) => [...items].sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" }));

const AssessmentAnalytics = () => {
  const [assessments, setAssessments] = useState([]);
  const [selected, setSelected] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await axiosInstance.get("/assessments?status=published");
      const sortedAssessments = sortByTitle(response.data.assessments || []);
      setAssessments(sortedAssessments);
      setSelected(sortedAssessments[0]?._id || "");
    };
    load();
  }, []);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!selected) return;
      setLoading(true);
      const response = await axiosInstance.get(`/analytics/assessments/${selected}`);
      setAnalytics(response.data);
      setLoading(false);
    };
    loadAnalytics();
  }, [selected]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-primary-dark to-slate-950 p-7 text-white">
          <BarChart3 className="h-7 w-7" />
          <h1 className="mt-3 text-2xl font-black">Teacher Analytics</h1>
          <p className="mt-1 text-sm text-primary-muted">Track performance, difficult questions, skipped questions and student outcomes.</p>
        </header>

        <SmartSelect value={selected} onChange={setSelected} options={assessments.map((assessment) => ({ value: assessment._id, label: assessment.title }))} placeholder="Choose an assessment" />

        {loading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : analytics && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Attempts", analytics.summary.attempts],
                ["Average Score", `${analytics.summary.averageScore}%`],
                ["Pass Rate", `${analytics.summary.passRate}%`],
                ["Avg Time", `${Math.round(analytics.summary.averageTimeSeconds / 60)}m`],
              ].map(([label, value]) => (
                <article key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-3xl font-black text-slate-950">{value}</p>
                  <p className="text-sm font-bold text-slate-500">{label}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Most Difficult Questions</h2>
                <div className="mt-4 space-y-3">
                  {analytics.difficultQuestions.map((item) => (
                    <div key={item.questionId} className="rounded-2xl bg-slate-50 p-4">
                      <p className="font-bold text-slate-900">{item.questionText}</p>
                      <p className="mt-1 text-xs font-black text-rose-600">Accuracy {item.accuracy}%</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Most Skipped Questions</h2>
                <div className="mt-4 space-y-3">
                  {analytics.skippedQuestions.map((item) => (
                    <div key={item.questionId} className="rounded-2xl bg-slate-50 p-4">
                      <p className="font-bold text-slate-900">{item.questionText}</p>
                      <p className="mt-1 text-xs font-black text-amber-600">Skipped {item.skipped} times</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AssessmentAnalytics;
