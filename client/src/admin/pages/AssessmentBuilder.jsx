import PublishingFields from "../components/PublishingFields";
import { useContext, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2, Plus, Save } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AppContext } from "../../context/AppContext";
import { CustomSelect } from "../components/CustomSelect";
import SmartSelect from "../../shared/CustomSelect";

const Field = ({ label, helper, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
    {helper && <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-400">{helper}</span>}
  </label>
);

const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortByTitle = (items) => [...items].sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" }));
const sortChapters = (items) => [...items].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortTopics = (items) => [...items].sort((a, b) => String(a.topicNumber || "").localeCompare(String(b.topicNumber || ""), undefined, { numeric: true, sensitivity: "base" }) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortQuestions = (items) => [...items].sort((a, b) => (a.questionText || "").localeCompare(b.questionText || "", undefined, { numeric: true, sensitivity: "base" }));

const AssessmentBuilder = () => {
  const { boards, classes, groups, isLoadingContext } = useContext(AppContext);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "chapter_test",
    board: "",
    class: "",
    group: "",
    subject: "",
    chapter: "",
    topic: "",
    durationMinutes: 30,
    status: "draft",
    allowResume: true,
    showCorrectAnswers: true,
  });
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { board, class: classId, group, subject, chapter, topic } = form;

  useEffect(() => {
    const loadAssessments = async () => {
      const response = await axiosInstance.get("/assessments?status=draft");
      setAssessments(sortByTitle(response.data.assessments || []));
    };
    loadAssessments().catch(() => setError("Some test builder data could not be loaded. Please refresh and try again."));
  }, []);

  useEffect(() => {
    const loadSubjects = async () => {
      if (!form.board || !form.class || !form.group) return setSubjects([]);
      const response = await axiosInstance.get(`/subjects?boardId=${form.board}&classId=${form.class}&groupId=${form.group}`);
      setSubjects(sortByName(response.data.subjects || []));
    };
    loadSubjects().catch(() => setError("Some test builder data could not be loaded. Please refresh and try again."));
  }, [form.board, form.class, form.group]);

  useEffect(() => {
    const loadChapters = async () => {
      if (!form.subject) return setChapters([]);
      const response = await axiosInstance.get(`/chapters?subjectId=${form.subject}&boardId=${form.board}&classId=${form.class}&groupId=${form.group}`);
      setChapters(sortChapters(response.data.chapters || []));
    };
    loadChapters().catch(() => setError("Some test builder data could not be loaded. Please refresh and try again."));
  }, [form.subject, form.board, form.class, form.group]);

  useEffect(() => {
    const loadTopics = async () => {
      if (!form.chapter) return setTopics([]);
      const response = await axiosInstance.get(`/topics/chapter/${form.chapter}`);
      setTopics(sortTopics(response.data.topics || []));
    };
    loadTopics().catch(() => setError("Some test builder data could not be loaded. Please refresh and try again."));
  }, [form.chapter]);

  useEffect(() => {
    const loadQuestions = async () => {
      const params = new URLSearchParams();
      if (board) params.set("board", board);
      if (classId) params.set("class", classId);
      if (group) params.set("group", group);
      if (subject) params.set("subject", subject);
      if (chapter) params.set("chapter", chapter);
      if (topic) params.set("topic", topic);
      const response = await axiosInstance.get(`/questions?mcqOnly=true&limit=100&${params.toString()}`);
      setQuestions(sortQuestions(response.data.questions || []));
    };
    loadQuestions().catch(() => setError("Some test builder data could not be loaded. Please refresh and try again."));
  }, [board, classId, group, subject, chapter, topic]);

  const totalMarks = useMemo(
    () => selected.reduce((sum, id) => sum + (questions.find((question) => question._id === id)?.marks || 1), 0),
    [selected, questions]
  );

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await axiosInstance.post("/assessments", {
        ...form,
        questions: selected.map((id, index) => ({ question: id, order: index + 1 })),
        passingMarks: Math.ceil(totalMarks * 0.4),
      });
      setAssessments((current) => sortByTitle([response.data.assessment, ...current]));
      setSelected([]);
      setForm({ ...form, title: "", description: "", summary: "", slug: "", tags: [], status: "draft" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save test. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleQuestion = (id) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-primary-dark to-slate-950 p-7 text-white">
          <ClipboardCheck className="h-7 w-7" />
          <h1 className="mt-3 text-2xl font-black">MCQ Test Builder</h1>
          <p className="mt-1 text-sm text-primary-muted">Build topic, chapter, subject, mock and previous-paper MCQ tests from the reusable question bank.</p>
        </header>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Test Title" helper="This title is visible to students. Example: Chapter 1 Quick MCQ Test.">
                <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Assessment title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Test Type" helper="Choose where this test should appear and how it should be grouped.">
                <SmartSelect value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={[{ value: "topic_test", label: "Topic Test" }, { value: "chapter_test", label: "Chapter Test" }, { value: "subject_test", label: "Subject Test" }, { value: "full_syllabus_test", label: "Full Syllabus Test" }, { value: "mock_test", label: "Mock Test" }, { value: "previous_paper_practice", label: "Previous Paper Practice" }]} placeholder="Choose test type" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Student Instructions" helper="Optional. Add timing rules, syllabus scope, or attempt guidance.">
                <textarea className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Instructions or description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <CustomSelect label="Board" value={form.board} onChange={(value) => setForm({ ...form, board: value })} options={boards} placeholder="Board" isLoading={isLoadingContext} />
              <CustomSelect label="Class" value={form.class} onChange={(value) => setForm({ ...form, class: value })} options={classes} placeholder="Class" isLoading={isLoadingContext} />
              <CustomSelect label="Group" value={form.group} onChange={(value) => setForm({ ...form, group: value })} options={groups} placeholder="Group" isLoading={isLoadingContext} />
              <CustomSelect label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} options={subjects} placeholder="Subject" />
              <CustomSelect label="Chapter" value={form.chapter} onChange={(value) => setForm({ ...form, chapter: value })} options={chapters} placeholder="Chapter" />
              <CustomSelect label="Topic" value={form.topic} onChange={(value) => setForm({ ...form, topic: value })} options={topics} placeholder="Topic" />
            </div>

            <PublishingFields kind="mcqs" value={form} title={form.title} required={form.status === "published"} onChange={patch => setForm(current => ({ ...current, ...patch }))} />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">Select Questions</h2>
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {questions.map((question) => (
                  <button key={question._id} type="button" onClick={() => toggleQuestion(question._id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected.includes(question._id) ? "border-primary-muted bg-primary-soft" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <p className="font-black text-slate-900">{question.questionText}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-slate-400">{question.difficulty} · {question.marks} marks</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-lg font-black text-slate-950">Assessment Summary</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <span className="rounded-2xl bg-slate-50 p-4 text-sm font-black">{selected.length}<br /><small>Questions</small></span>
              <span className="rounded-2xl bg-slate-50 p-4 text-sm font-black">{totalMarks}<br /><small>Marks</small></span>
            </div>
            <div className="mt-4">
              <Field label="Duration" helper="Total test time in minutes.">
                <input type="number" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Publish Status" helper="Draft stays hidden. Published becomes available to students.">
                <SmartSelect value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} placeholder="Choose status" />
              </Field>
            </div>
            <button disabled={saving || selected.length === 0 || !form.title} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Assessment
            </button>
          </aside>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Recent Assessments</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {assessments.map((assessment) => (
              <div key={assessment._id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-black text-slate-900">{assessment.title}</p>
                  <p className="text-xs font-bold uppercase text-slate-400">{assessment.type} · {assessment.status}</p>
                </div>
                <Plus className="h-4 w-4 text-slate-300" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AssessmentBuilder;
