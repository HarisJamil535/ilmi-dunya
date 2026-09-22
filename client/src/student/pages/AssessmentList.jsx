import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ClipboardCheck, Loader2, Play, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";

const AssessmentList = () => {
  const [searchParams] = useSearchParams();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasStudyContext = ["board", "class", "group", "subject", "chapter", "topic", "boardId", "classId", "groupId", "subjectId", "chapterId", "topicId"]
    .some((key) => Boolean(searchParams.get(key)));

  useEffect(() => {
    const load = async () => {
      if (!hasStudyContext) {
        setAssessments([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const params = new URLSearchParams(searchParams);
      try {
        const response = await axiosInstance.get(`/assessments?${params.toString()}`);
        setAssessments(response.data.assessments || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchParams, hasStudyContext]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl bg-slate-950 p-8 text-white">
          <div className="flex items-center gap-2 text-sm font-bold text-primary-muted">
            <ClipboardCheck className="h-4 w-4" />
            MCQ Tests
          </div>
          <h1 className="mt-3 text-3xl font-black">Chapter and topic MCQ tests</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Start MCQ practice from any chapter or topic. Your results and progress are saved automatically.</p>
        </header>

        {!hasStudyContext ? (
          <div className="rounded-3xl border border-primary-soft bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><BookOpen className="h-7 w-7" /></div>
            <h2 className="mt-5 text-xl font-black text-slate-950">Choose a subject to see its tests</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">MCQ tests are matched to your class, board, group and chapter. Choose your study path first, then practise the right questions.</p>
            <Link to="/subjects" className="mx-auto mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:bg-primary-dark">Browse subjects <ArrowRight className="h-4 w-4" /></Link>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : assessments.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
            <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-black text-slate-950">No MCQ tests available yet</h2>
            <p className="mt-2 text-sm text-slate-500">Tests will appear here after admin publishes them.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {assessments.map((assessment) => (
              <article key={assessment._id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <p className="text-xs font-black uppercase tracking-wider text-primary">{assessment.type.replaceAll("_", " ")}</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">{assessment.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{assessment.description || "Practice MCQs with instant result report."}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-500">
                  <span className="rounded-xl bg-slate-50 p-2">{assessment.questionCount || 0} Qs</span>
                  <span className="rounded-xl bg-slate-50 p-2">{assessment.totalMarks} Marks</span>
                  <span className="rounded-xl bg-slate-50 p-2">{assessment.durationMinutes} Min</span>
                </div>
                <Link to={`/tests/${assessment._id}/take`} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white">
                  <Play className="h-4 w-4" />
                  Start Test
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default AssessmentList;
