import { useContext, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, Loader2, Save } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AppContext } from "../../context/AppContext";
import { CustomSelect } from "../components/CustomSelect";
import SmartSelect from "../../shared/CustomSelect";
import { DeleteButton } from "../components/AdminUI";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";

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
    type: "topic_test",
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
  const [questionFilters, setQuestionFilters] = useState({ search: "", difficulty: "", type: "" });
  const [assessmentToArchive, setAssessmentToArchive] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { board, class: classId, group, subject, chapter, topic } = form;

  const updateStudyContext = (key, value) => {
    const reset = ["board", "class", "group"].includes(key)
      ? { subject: "", chapter: "", topic: "" }
      : key === "subject" ? { chapter: "", topic: "" } : key === "chapter" ? { topic: "" } : {};
    setForm((current) => ({ ...current, [key]: value, ...reset }));
    setSelected([]);
  };

  const changeTestType = (value) => {
    const reset = ["subject_test", "full_syllabus_test", "mock_test", "previous_paper_practice", "custom_practice"].includes(value)
      ? { chapter: "", topic: "" }
      : value === "chapter_test" ? { topic: "" } : {};
    setForm((current) => ({ ...current, type: value, ...reset }));
    setSelected([]);
  };

  useEffect(() => {
    const loadAssessments = async () => {
      const response = await axiosInstance.get("/assessments");
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
      const needsChapter = ["chapter_test", "topic_test"].includes(form.type);
      if (!board || !classId || !group || !subject || (needsChapter && !chapter) || (form.type === "topic_test" && !topic)) {
        setQuestions([]);
        return;
      }
      const params = new URLSearchParams();
      if (board) params.set("board", board);
      if (classId) params.set("class", classId);
      if (group) params.set("group", group);
      if (subject) params.set("subject", subject);
      if (chapter) params.set("chapter", chapter);
      if (topic) params.set("topic", topic);
      if (questionFilters.search.trim()) params.set("search", questionFilters.search.trim());
      if (questionFilters.difficulty) params.set("difficulty", questionFilters.difficulty);
      if (questionFilters.type) params.set("type", questionFilters.type);
      params.set("status", "published");
      const response = await axiosInstance.get(`/questions?mcqOnly=true&limit=100&${params.toString()}`);
      setQuestions(sortQuestions(response.data.questions || []));
    };
    loadQuestions().catch(() => setError("Some test builder data could not be loaded. Please refresh and try again."));
  }, [board, classId, group, subject, chapter, topic, form.type, questionFilters]);

  const totalMarks = useMemo(
    () => selected.reduce((sum, id) => sum + (questions.find((question) => question._id === id)?.marks || 1), 0),
    [selected, questions]
  );

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        status: editingId ? "draft" : form.status,
        questions: selected.map((id, index) => ({ question: id, order: index + 1 })),
        passingMarks: Math.ceil(totalMarks * 0.4),
      };
      const response = editingId
        ? await axiosInstance.put(`/assessments/${editingId}`, payload)
        : await axiosInstance.post("/assessments", payload);
      setAssessments((current) => sortByTitle([response.data.assessment, ...current.filter((item) => item._id !== response.data.assessment._id)]));
      setSelected([]);
      setEditingId("");
      setForm((current) => ({ ...current, title: "", description: "", status: "draft" }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save test. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleQuestion = (id) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleVisibleQuestions = () => {
    const visibleIds = questions.map((question) => question._id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
    setSelected((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const publishAssessment = async (assessment) => {
    setError("");
    try {
      const response = await axiosInstance.put(`/assessments/${assessment._id}`, { status: "published" });
      setAssessments((current) => sortByTitle(current.map((item) => item._id === assessment._id ? response.data.assessment : item)));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to publish this test. Please check its questions and try again.");
    }
  };

  const archiveAssessment = async () => {
    if (!assessmentToArchive) return;
    setSaving(true);
    setError("");
    try {
      await axiosInstance.delete(`/assessments/${assessmentToArchive._id}`);
      setAssessments((current) => current.filter((item) => item._id !== assessmentToArchive._id));
      setAssessmentToArchive(null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to archive this test.");
    } finally {
      setSaving(false);
    }
  };

  const editDraft = async (assessment) => {
    setError("");
    try {
      const response = await axiosInstance.get(`/assessments/${assessment._id}`);
      const draft = response.data.assessment;
      setForm((current) => ({
        ...current,
        title: draft.title || "",
        description: draft.description || "",
        type: draft.type,
        board: String(draft.board?._id || draft.board || ""),
        class: String(draft.class?._id || draft.class || ""),
        group: String(draft.group?._id || draft.group || ""),
        subject: String(draft.subject?._id || draft.subject || ""),
        chapter: String(draft.chapter?._id || draft.chapter || ""),
        topic: String(draft.topic?._id || draft.topic || ""),
        durationMinutes: draft.durationMinutes || 30,
        status: "draft",
      }));
      setSelected((draft.questions || []).map((item) => String(item.question?._id || item.question)));
      setEditingId(draft._id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load this draft for editing.");
    }
  };

  const cancelEdit = () => {
    setEditingId("");
    setSelected([]);
    setForm((current) => ({ ...current, title: "", description: "", status: "draft" }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-primary-dark to-slate-950 p-7 text-white">
          <ClipboardCheck className="h-7 w-7" />
          <h1 className="mt-3 text-2xl font-black">MCQ Test Builder</h1>
          <p className="mt-1 text-sm text-primary-muted">Choose a syllabus topic, assemble reusable questions, then publish the test for students.</p>
        </header>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Test Title" helper="This title is visible to students. Example: Chapter 1 Quick MCQ Test.">
                <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Assessment title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Test Type" helper="Topic tests appear on that topic. Chapter tests appear on the chapter test list.">
                <SmartSelect value={form.type} onChange={changeTestType} options={[{ value: "topic_test", label: "Topic Test" }, { value: "chapter_test", label: "Chapter Test" }, { value: "subject_test", label: "Subject Test" }, { value: "full_syllabus_test", label: "Full Syllabus Test" }, { value: "mock_test", label: "Mock Test" }, { value: "previous_paper_practice", label: "Previous Paper Practice" }]} placeholder="Choose test type" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Student Instructions" helper="Optional. Add timing rules, syllabus scope, or attempt guidance.">
                <textarea className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Instructions or description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <CustomSelect label="Board" value={form.board} onChange={(value) => updateStudyContext("board", value)} options={boards} placeholder="Board" isLoading={isLoadingContext} />
              <CustomSelect label="Class" value={form.class} onChange={(value) => updateStudyContext("class", value)} options={classes} placeholder="Class" isLoading={isLoadingContext} />
              <CustomSelect label="Group" value={form.group} onChange={(value) => updateStudyContext("group", value)} options={groups} placeholder="Group" isLoading={isLoadingContext} />
              <CustomSelect label="Subject" value={form.subject} onChange={(value) => updateStudyContext("subject", value)} options={subjects} placeholder="Subject" />
              <CustomSelect label="Chapter" value={form.chapter} onChange={(value) => updateStudyContext("chapter", value)} options={chapters} placeholder="Chapter" />
              <CustomSelect label="Topic" value={form.topic} onChange={(value) => updateStudyContext("topic", value)} options={topics} placeholder="Topic" />
            </div>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="mt-6">
              <h2 className="mb-1 text-sm font-black uppercase tracking-wider text-slate-700">Add from Question Bank</h2>
              <p className="mb-3 text-xs leading-5 text-slate-500">Matching saved MCQs appear here. Publish this test when it is ready for students.</p>
              <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Find a question">
                  <input value={questionFilters.search} onChange={(event) => setQuestionFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search question text" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                </Field>
                <Field label="Difficulty">
                  <SmartSelect value={questionFilters.difficulty} onChange={(value) => setQuestionFilters((current) => ({ ...current, difficulty: value }))} options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} placeholder="Any difficulty" />
                </Field>
                <Field label="MCQ format">
                  <SmartSelect value={questionFilters.type} onChange={(value) => setQuestionFilters((current) => ({ ...current, type: value }))} options={[{ value: "standard_mcq", label: "Standard MCQ" }, { value: "scenario_mcq", label: "Scenario MCQ" }]} placeholder="Any format" />
                </Field>
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold text-slate-600">{questions.length} matching · {selected.length} selected for this test</p>
                <div className="flex gap-2">
                  <button type="button" onClick={toggleVisibleQuestions} disabled={!questions.length} className="rounded-lg px-3 py-2 text-xs font-black text-primary hover:bg-white disabled:opacity-50">Select all shown</button>
                  <button type="button" onClick={() => setSelected([])} disabled={!selected.length} className="rounded-lg px-3 py-2 text-xs font-black text-slate-500 hover:bg-white disabled:opacity-50">Clear selection</button>
                </div>
              </div>
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {!questions.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Select board, class, group, subject and chapter to find matching MCQs.</p>}
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
            <h2 className="text-lg font-black text-slate-950">Test Summary</h2>
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
              <Field label="Save as" helper="Publish now to make this test appear to students, or keep it as a draft.">
                <SmartSelect value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} placeholder="Choose status" />
              </Field>
            </div>
            <button disabled={saving || selected.length === 0 || !form.title.trim() || !board || !classId || !group || !subject || (["chapter_test", "topic_test"].includes(form.type) && !chapter) || (form.type === "topic_test" && !topic)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Update Draft" : `Save Test ${form.status === "published" ? "& Publish" : "as Draft"}`}
            </button>
            {editingId && <button type="button" onClick={cancelEdit} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Cancel editing</button>}
          </aside>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Your Tests</h2>
          <p className="mt-1 text-sm text-slate-500">Draft tests are private. Published tests are available to students in their matching topic or chapter.</p>
          <div className="mt-4 divide-y divide-slate-100">
            {!assessments.length && <p className="py-6 text-sm text-slate-500">No tests created yet. Build one above from the question bank.</p>}
            {assessments.map((assessment) => (
              <div key={assessment._id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-black text-slate-900">{assessment.title}</p>
                  <p className="text-xs font-bold uppercase text-slate-400">{assessment.type.replaceAll("_", " ")} · {assessment.status} · {assessment.questionCount || assessment.questions?.length || 0} questions</p>
                </div>
                <div className="flex items-center gap-2">
                  {assessment.status === "draft" && <><button type="button" onClick={() => editDraft(assessment)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Edit</button><button type="button" onClick={() => publishAssessment(assessment)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-black text-white"><Check size={15} />Publish test</button></>}
                  <DeleteButton onClick={() => setAssessmentToArchive(assessment)} title="Archive test" aria-label={`Archive ${assessment.title}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <DeleteConfirmationModal
        isOpen={Boolean(assessmentToArchive)}
        onClose={() => setAssessmentToArchive(null)}
        onConfirm={archiveAssessment}
        itemName={assessmentToArchive?.title || "this test"}
        entityName="Test"
        actionVerb="archive"
        confirmLabel="Archive test"
        isDeleting={saving}
        description="This removes the test from student listings. Existing student attempts and results remain in the learning history."
      />
    </div>
  );
};

export default AssessmentBuilder;
