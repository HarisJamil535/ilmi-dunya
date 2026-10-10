import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useContext, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Building2, CheckCircle2, ClipboardCheck, Clock3, GraduationCap, ListChecks, Play, SearchX, Target } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import { AppContext } from "../../context/AppContext";
import CustomSelect from "../../shared/CustomSelect";

const practiceSteps = [
  { icon: <BookOpen size={17} />, title: "Choose a subject", text: "Open the exact syllabus you are studying." },
  { icon: <ListChecks size={17} />, title: "Pick chapter or topic", text: "Practise broadly or focus on one concept." },
  { icon: <CheckCircle2 size={17} />, title: "Learn from results", text: "Review correct answers and explanations instantly." },
];

const AssessmentList = () => {
  const [searchParams] = useSearchParams();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classId, setClassId] = useState(searchParams.get("classId") || "");
  const [boardId, setBoardId] = useState(searchParams.get("boardId") || "");
  const [finderWarning, setFinderWarning] = useState("");
  const { boards, classes, isLoadingContext } = useContext(AppContext);
  const navigate = useNavigate();
  usePageLoading(loading || isLoadingContext);
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
      setError("");
      const params = new URLSearchParams(searchParams);
      try {
        const response = await axiosInstance.get(`/assessments?${params.toString()}`);
        setAssessments(response.data.assessments || []);
      } catch (requestError) {
        setAssessments([]);
        setError(requestError.response?.data?.message || "Tests could not be loaded right now.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchParams, hasStudyContext]);

  const findTests = (event) => {
    event.preventDefault();
    const selectedClass = classes.find((item) => item._id === classId);
    const selectedBoard = boards.find((item) => item._id === boardId);
    if (!selectedClass || !selectedBoard) {
      setFinderWarning("Select your class and board first.");
      return;
    }
    const params = new URLSearchParams({
      classId,
      boardId,
      class: String(selectedClass.classNumber || selectedClass.name || "").replace(/class\s*/i, "").trim(),
      board: selectedBoard.name.replace(/\s*board/i, "").trim().toLowerCase(),
    });
    navigate(`/subjects?${params}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-8 text-white shadow-xl shadow-primary/15 sm:px-9 sm:py-10">
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/85"><ClipboardCheck className="h-4 w-4" />Smart MCQ Practice</div>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Practise the right questions,<br className="hidden sm:block" /> at the right time.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">Choose your study path, take a focused chapter or topic test, and learn from every answer with an instant result report.</p>
          </div>
          <Target className="absolute -bottom-10 -right-8 h-52 w-52 text-white/10" strokeWidth={1} />
        </header>

        {!hasStudyContext ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <form onSubmit={findTests} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Step 1 of 2</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Find tests for your syllabus</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Select your class and board. On the next screen, choose a subject and then open any chapter or topic test.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <CustomSelect label={<span className="flex items-center gap-2"><GraduationCap size={15} />Class</span>} value={classId} disabled={isLoadingContext} placeholder="Choose class" options={classes.map((item) => ({ value: item._id, label: /class/i.test(item.name || "") ? item.name : `Class ${item.classNumber || item.name}` }))} onChange={(value) => { setClassId(value); setFinderWarning(""); }} />
                <CustomSelect label={<span className="flex items-center gap-2"><Building2 size={15} />Board</span>} value={boardId} disabled={isLoadingContext} placeholder="Choose board" options={boards.map((item) => ({ value: item._id, label: item.name }))} onChange={(value) => { setBoardId(value); setFinderWarning(""); }} />
              </div>
              {finderWarning && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{finderWarning}</p>}
              <button type="submit" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-black text-white transition hover:bg-primary-dark sm:w-auto">Continue to subjects <ArrowRight className="h-4 w-4" /></button>
            </form>
            <div className="rounded-3xl border border-primary-muted bg-primary-soft p-6 sm:p-8">
              <h2 className="text-lg font-black text-slate-950">How practice works</h2>
              <div className="mt-5 space-y-5">
                {practiceSteps.map((step, index) => <div key={step.title} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white font-black text-primary shadow-sm">{step.icon}</span><div><p className="text-sm font-black text-slate-900">{index + 1}. {step.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{step.text}</p></div></div>)}
              </div>
            </div>
          </section>
        ) : loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-700">{error}</div>
        ) : assessments.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
            <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-black text-slate-950">No MCQ tests available yet</h2>
            <p className="mt-2 text-sm text-slate-500">Tests will appear here after admin publishes them.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {assessments.map((assessment) => (
              <article key={assessment._id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary-muted hover:shadow-xl">
                <div className="flex items-center justify-between gap-3"><p className="rounded-full bg-primary-soft px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">{assessment.type.replaceAll("_", " ")}</p><ClipboardCheck className="h-5 w-5 text-slate-300 transition group-hover:text-primary" /></div>
                <h2 className="mt-2 text-xl font-black text-slate-950">{assessment.title}</h2>
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-slate-500">{assessment.description || "Practice MCQs with an instant result report and answer review."}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-slate-600">
                  <span className="rounded-xl bg-slate-50 p-2"><ListChecks className="mx-auto mb-1 h-4 w-4 text-primary" />{assessment.questionCount || 0} Questions</span>
                  <span className="rounded-xl bg-slate-50 p-2"><Target className="mx-auto mb-1 h-4 w-4 text-primary" />{assessment.totalMarks} Marks</span>
                  <span className="rounded-xl bg-slate-50 p-2"><Clock3 className="mx-auto mb-1 h-4 w-4 text-primary" />{assessment.durationMinutes} Minutes</span>
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
