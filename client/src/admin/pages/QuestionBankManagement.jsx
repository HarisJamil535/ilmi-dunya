import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Download, Languages, Loader2, Plus, Save, SearchX, Trash2, Upload, X } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "@/api/axios";
import { CustomSelect } from "../components/CustomSelect";
import { DeleteButton, EditButton } from "../components/AdminUI";
import SmartSelect from "../../shared/CustomSelect";
import { AppContext } from "../../context/AppContext";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";

const optionKeys = ["A", "B", "C", "D"];

const defaultForm = {
  id: "",
  mode: "mcq",
  type: "standard_mcq",
  contentType: "mcq",
  questionText: "",
  language: "en",
  options: optionKeys.map((key) => ({ key, text: "" })),
  correctOption: "A",
  explanation: "",
  difficulty: "medium",
  marks: 1,
  examYear: "",
  examSession: "",
  board: "",
  class: "",
  group: "",
  subject: "",
  chapter: "",
  topic: "",
  tags: "",
  status: "published",
  scenario: "",
  scenarioTitle: "",
  scenarioText: "",
};

const contentModes = [
  { value: "mcq", title: "MCQ" },
  { value: "written", title: "Short / Long question" },
];

const Field = ({ label, helper, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
    {helper && <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-400">{helper}</span>}
  </label>
);

const toSelectOptions = (items) => items.map((item) => ({ _id: item._id, name: item.name }));
const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortChapters = (items) => [...items].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortTopics = (items) => [...items].sort((a, b) => String(a.topicNumber || "").localeCompare(String(b.topicNumber || ""), undefined, { numeric: true, sensitivity: "base" }) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const PAGE_SIZE = 15;

const questionLabel = (question) => {
  if (question.contentType === "long_question") return "Long question";
  if (question.contentType === "short_question") return "Short question";
  return question.type === "scenario_mcq" ? "Scenario MCQ" : "Standard MCQ";
};

const normalizeQuestionForForm = (question) => {
  const optionMap = new Map((question.options || []).map((option) => [option.key, option.text]));
  const contentType = question.contentType || "mcq";
  return {
    ...defaultForm,
    id: question._id,
    mode: contentType === "mcq" ? "mcq" : "written",
    contentType,
    type: question.type || "standard_mcq",
    questionText: question.questionText || "",
    language: question.contentLanguage || "en",
    options: optionKeys.map((key) => ({ key, text: optionMap.get(key) || "" })),
    correctOption: question.correctOption || "A",
    explanation: question.explanation || "",
    difficulty: question.difficulty || "medium",
    marks: question.marks || 1,
    examYear: question.examYear || "",
    examSession: question.examSession || "",
    board: question.board?._id || question.board || "",
    class: question.class?._id || question.class || "",
    group: question.group?._id || question.group || "",
    subject: question.subject?._id || question.subject || "",
    chapter: question.chapter?._id || question.chapter || "",
    topic: question.topic?._id || question.topic || "",
    tags: Array.isArray(question.tags) ? question.tags.join(", ") : "",
    status: question.status || (contentType === "mcq" ? "draft" : "published"),
    scenario: question.scenario?._id || question.scenario || "",
  };
};

const QuestionBankManagement = () => {
  const { boards, classes, groups, isLoadingContext } = useContext(AppContext);
  const [form, setForm] = useState(defaultForm);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [listSubjects, setListSubjects] = useState([]);
  const [listChapters, setListChapters] = useState([]);
  const [listTopics, setListTopics] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importKind, setImportKind] = useState("standard_mcq");
  const [importContext, setImportContext] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [listFilter, setListFilter] = useState({ status: "", contentType: "", board: "", class: "", group: "", subject: "", chapter: "", topic: "", search: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [questionToDelete, setQuestionToDelete] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [bulkDeleteRequest, setBulkDeleteRequest] = useState(null);

  const isMcq = form.mode === "mcq";
  const isUrdu = form.language === "ur";
  const isEditing = Boolean(form.id);
  const writtenImport = ["short_question", "long_question"].includes(importKind);
  const canImportQuestions = Boolean(form.board && form.class && form.group && form.subject && form.chapter && (!writtenImport || form.topic));

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (listFilter.contentType) params.set("contentType", listFilter.contentType);
      if (listFilter.status) params.set("status", listFilter.status);
      if (listFilter.board) params.set("board", listFilter.board);
      if (listFilter.class) params.set("class", listFilter.class);
      if (listFilter.group) params.set("group", listFilter.group);
      if (listFilter.subject) params.set("subject", listFilter.subject);
      if (listFilter.chapter) params.set("chapter", listFilter.chapter);
      if (listFilter.topic) params.set("topic", listFilter.topic);
      if (listFilter.search.trim()) params.set("search", listFilter.search.trim());
      const response = await axiosInstance.get(`/questions?${params.toString()}`);
      setQuestions(response.data.questions || []);
      setPagination({ total: response.data.pagination?.total || 0, pages: Math.max(response.data.pagination?.pages || 1, 1) });
      setSelectedQuestionIds([]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load questions.");
    } finally {
      setLoading(false);
    }
  }, [listFilter, page]);

  const loadScenarios = useCallback(async () => {
    const params = new URLSearchParams();
    if (form.subject) params.set("subject", form.subject);
    if (form.chapter) params.set("chapter", form.chapter);
    const response = await axiosInstance.get(`/questions/scenarios/list?${params.toString()}`);
      setScenarios([...(response.data.scenarios || [])].sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" })));
  }, [form.subject, form.chapter]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useEffect(() => { loadScenarios().catch(() => setError("Unable to load scenarios.")); }, [loadScenarios]);

  useEffect(() => {
    const loadListSubjects = async () => {
      setListSubjects([]);
      setListChapters([]);
      setListTopics([]);
      if (!listFilter.board || !listFilter.class || !listFilter.group) return;
      const response = await axiosInstance.get(`/subjects?boardId=${listFilter.board}&classId=${listFilter.class}&groupId=${listFilter.group}`);
      setListSubjects(sortByName(response.data.subjects || []));
    };
    loadListSubjects().catch(() => setError("Unable to load question list subjects."));
  }, [listFilter.board, listFilter.class, listFilter.group]);

  useEffect(() => {
    const loadListChapters = async () => {
      setListChapters([]);
      setListTopics([]);
      if (!listFilter.subject) return;
      const response = await axiosInstance.get(`/chapters?subjectId=${listFilter.subject}&boardId=${listFilter.board}&classId=${listFilter.class}&groupId=${listFilter.group}`);
      setListChapters(sortChapters(response.data.chapters || []));
    };
    loadListChapters().catch(() => setError("Unable to load question list chapters."));
  }, [listFilter.subject, listFilter.board, listFilter.class, listFilter.group]);

  useEffect(() => {
    const loadListTopics = async () => {
      setListTopics([]);
      if (!listFilter.chapter) return;
      const response = await axiosInstance.get(`/topics/chapter/${listFilter.chapter}`);
      setListTopics(sortTopics(response.data.topics || []));
    };
    loadListTopics().catch(() => setError("Unable to load question list topics."));
  }, [listFilter.chapter]);

  useEffect(() => {
    const loadSubjects = async () => {
      setSubjects([]);
      if (!form.board || !form.class || !form.group) return;
      const response = await axiosInstance.get(`/subjects?boardId=${form.board}&classId=${form.class}&groupId=${form.group}`);
      setSubjects(sortByName(response.data.subjects || []));
    };
    loadSubjects().catch(() => setError("Unable to load subjects."));
  }, [form.board, form.class, form.group]);

  useEffect(() => {
    const loadChapters = async () => {
      setChapters([]);
      if (!form.subject) return;
      const response = await axiosInstance.get(`/chapters?subjectId=${form.subject}&boardId=${form.board}&classId=${form.class}&groupId=${form.group}`);
      setChapters(sortChapters(response.data.chapters || []));
    };
    loadChapters().catch(() => setError("Unable to load chapters."));
  }, [form.subject, form.board, form.class, form.group]);

  useEffect(() => {
    const loadTopics = async () => {
      setTopics([]);
      if (!form.chapter) return;
      const response = await axiosInstance.get(`/topics/chapter/${form.chapter}`);
      setTopics(sortTopics(response.data.topics || []));
    };
    loadTopics().catch(() => setError("Unable to load topics."));
  }, [form.chapter]);

  const scenarioQuestionCount = useMemo(() => {
    if (!form.scenario) return 0;
    return questions.filter((question) => String(question.scenario?._id || question.scenario || "") === String(form.scenario)).length;
  }, [questions, form.scenario]);

  const setMode = (mode) => {
    setForm({
      ...defaultForm,
      mode,
      contentType: mode === "mcq" ? "mcq" : "long_question",
      status: "published",
      board: form.board,
      class: form.class,
      group: form.group,
      subject: form.subject,
      chapter: form.chapter,
      topic: mode === "mcq" ? "" : form.topic,
    });
    setMessage("");
    setError("");
  };

  const updateOption = (index, text) => {
    setForm({
      ...form,
      options: form.options.map((option, optionIndex) => optionIndex === index ? { ...option, text } : option),
    });
  };

  const resetForm = () => {
    setForm({
      ...defaultForm,
      mode: form.mode,
      contentType: form.mode === "mcq" ? "mcq" : "long_question",
      status: "published",
      board: form.board,
      class: form.class,
      group: form.group,
      subject: form.subject,
      chapter: form.chapter,
      topic: form.mode === "mcq" ? "" : form.topic,
    });
    setMessage("");
    setError("");
  };

  const editQuestion = (question) => {
    setForm(normalizeQuestionForForm(question));
    setMessage("Editing selected question. Update the form and save.");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildPayload = async () => {
    const payload = {
      ...form,
      contentType: isMcq ? "mcq" : form.contentType,
      status: form.status,
      type: isMcq ? form.type : "standard_mcq",
      examYear: isMcq ? undefined : form.examYear,
      examSession: isMcq ? undefined : form.examSession,
      options: isMcq ? form.options.filter((option) => option.text.trim()) : [],
      correctOption: isMcq ? form.correctOption : undefined,
      scenario: isMcq && form.type === "scenario_mcq" ? form.scenario : "",
    };

    if (isMcq && form.type === "scenario_mcq" && !payload.scenario && form.scenarioTitle.trim() && form.scenarioText.trim()) {
      const response = await axiosInstance.post("/questions/scenarios", {
        title: form.scenarioTitle.trim(),
        scenarioText: form.scenarioText.trim(),
        contentLanguage: form.language,
        subject: form.subject,
        chapter: form.chapter || undefined,
        topic: form.topic || undefined,
        difficulty: form.difficulty,
        tags: form.tags,
      });
      payload.scenario = response.data.scenario._id;
      setForm((current) => ({ ...current, scenario: payload.scenario }));
      await loadScenarios();
    }

    return payload;
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.board || !form.class || !form.group || !form.subject || !form.chapter) {
      setError("Select board, class, group, subject and chapter.");
      return;
    }
    if (!isMcq && !form.topic) {
      setError("Select a topic for short and long questions.");
      return;
    }
    if (isMcq && form.type === "scenario_mcq" && !form.scenario && (!form.scenarioTitle.trim() || !form.scenarioText.trim())) {
      setError("Select an existing scenario or write a new scenario title and passage.");
      return;
    }

    setSaving(true);
    try {
      const payload = await buildPayload();
      if (isEditing) {
        await axiosInstance.put(`/questions/${form.id}`, payload);
      } else {
        await axiosInstance.post("/questions", payload);
      }
      setMessage(isEditing ? "Question updated." : form.type === "scenario_mcq" ? "Saved. Add another question to this scenario or continue later." : "Question saved.");
      const preservedScenario = payload.type === "scenario_mcq" ? payload.scenario : "";
      setForm({
        ...defaultForm,
        mode: form.mode,
        contentType: isMcq ? "mcq" : form.contentType,
        type: form.type,
        scenario: preservedScenario,
        board: form.board,
        class: form.class,
        group: form.group,
        subject: form.subject,
        chapter: form.chapter,
        topic: form.topic,
        language: form.language,
      });
      await loadQuestions();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save question.");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (id) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await axiosInstance.delete(`/questions/${id}`);
      if (form.id === id) resetForm();
      setQuestionToDelete(null);
      setMessage("Question removed from new tests. Previous student attempts are preserved.");
      if (page > 1 && questions.length === 1) setPage((current) => current - 1);
      else await loadQuestions();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete question.");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestionsInBulk = async () => {
    if (!bulkDeleteRequest) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = bulkDeleteRequest.mode === "all"
        ? { allMatching: true, filters: listFilter }
        : { ids: selectedQuestionIds };
      const response = await axiosInstance.post("/questions/bulk-delete", payload);
      const archivedCount = response.data.archivedCount || 0;
      setBulkDeleteRequest(null);
      setSelectedQuestionIds([]);
      setMessage(`${archivedCount} question${archivedCount === 1 ? "" : "s"} removed. Previous student results are preserved.`);
      if (bulkDeleteRequest.mode === "all" && page !== 1) setPage(1);
      else if (page > 1 && archivedCount >= questions.length) setPage((current) => current - 1);
      else await loadQuestions();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove the selected questions.");
    } finally {
      setSaving(false);
    }
  };

  const markQuestionReady = async (question) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await axiosInstance.patch(`/questions/${question._id}/status`, { status: "published" });
      setMessage("Question is now available in Test Builder.");
      await loadQuestions();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update the question stage.");
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const context = {
      board: form.board,
      class: form.class,
      group: form.group,
      subject: form.subject,
      chapter: form.chapter,
      topic: form.topic,
    };

    if (!canImportQuestions) {
      setError("Select the study context above, including a topic for written questions.");
      event.target.value = "";
      return;
    }

    try {
      setError("");
      setMessage("");
      setImportBusy(true);
      setImportPreview(null);
      setImportRows([]);
      const data = new FormData();
      data.append("file", file);
      data.append("context", JSON.stringify(context));
      data.append("kind", importKind);
      const response = await axiosInstance.post("/questions/import/preview", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreview(response.data);
      setImportContext({ context, kind: importKind });
      setImportRows(response.data.preview.filter((item) => item.status === "valid").map((item) => item.row));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to preview Excel file.");
    } finally {
      setImportBusy(false);
      event.target.value = "";
    }
  };

  const commitImport = async () => {
    if (!importRows.length || importBusy || !importContext) return;
    try {
      setError("");
      setImportBusy(true);
      const response = await axiosInstance.post("/questions/import/commit", { rows: importRows, ...importContext });
      const failures = response.data.errors || [];
      setMessage(`Imported ${response.data.imported} question(s). Failed ${response.data.failed}.`);
      if (failures.length) {
        setError(failures.slice(0, 5).map((item) => `Row ${item.rowNumber}: ${item.message}`).join(" | "));
      }
      setImportPreview(null);
      setImportRows([]);
      await loadQuestions();
      await loadScenarios();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to import questions.");
    } finally {
      setImportBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await axiosInstance.get("/questions/import/template", { responseType: "blob", params: { kind: importKind } });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${importKind}-import-template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let message = "Unable to download Excel format.";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed.message || message;
        } catch {
          message = "Unable to download Excel format.";
        }
      } else {
        message = err.response?.data?.message || message;
      }
      setError(message);
    }
  };

  const updateListFilter = (changes) => {
    setPage(1);
    setSelectedQuestionIds([]);
    setListFilter((current) => ({ ...current, ...changes }));
  };
  const clearListFilters = () => {
    setPage(1);
    setSelectedQuestionIds([]);
    setListFilter({ status: "", contentType: "", board: "", class: "", group: "", subject: "", chapter: "", topic: "", search: "" });
  };
  const pageQuestionIds = questions.map((question) => question._id);
  const allPageSelected = pageQuestionIds.length > 0 && pageQuestionIds.every((id) => selectedQuestionIds.includes(id));
  const hasScopeFilter = ["board", "class", "group", "subject", "chapter", "topic"].some((key) => listFilter[key]);
  const toggleQuestionSelection = (id) => setSelectedQuestionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const togglePageSelection = () => setSelectedQuestionIds((current) => allPageSelected ? current.filter((id) => !pageQuestionIds.includes(id)) : [...new Set([...current, ...pageQuestionIds])]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-slate-950 p-6 text-white sm:p-7">
          <div>
            <ClipboardList className="h-7 w-7" />
            <h1 className="mt-3 text-2xl font-black">Question Bank</h1>
            <p className="mt-1 text-sm text-white/80">Add questions here. Students see MCQs after you publish a test.</p>
          </div>
          <Link to="/admin/assessments/builder" className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">Create a student test</Link>
        </header>

        <section className="inline-flex w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Question format">
          {contentModes.map((mode) => {
            const active = form.mode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setMode(mode.value)}
                className={`flex-1 rounded-xl px-4 py-3 text-left text-sm font-black transition ${active ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{mode.title}</span>
                  {active && <CheckCircle2 className="h-4 w-4" />}
                </span>
              </button>
            );
          })}
        </section>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-black text-slate-950">{isEditing ? "Update Question" : isMcq ? "Add MCQ Question" : "Add Written Question"}</h2>
              <p className="mt-1 text-sm text-slate-500">{isMcq ? "Complete the required fields, then save." : "Add a board question for the selected topic."}</p>
            </div>
            {isEditing && (
              <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
                <X className="h-4 w-4" />
                Cancel Edit
              </button>
            )}
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            {isMcq ? (
              <Field label="MCQ Type" helper="Use scenario when one passage has many linked MCQs.">
                <SmartSelect value={form.type} onChange={(value) => setForm({ ...form, type: value, scenario: "", scenarioTitle: "", scenarioText: "" })} options={[{ value: "standard_mcq", label: "Standard MCQ" }, { value: "scenario_mcq", label: "Scenario Based MCQ" }]} placeholder="Choose MCQ type" />
              </Field>
            ) : (
              <Field label="Written Type" helper="This controls the public topic tab.">
                <SmartSelect value={form.contentType} onChange={(value) => setForm({ ...form, contentType: value })} options={[{ value: "long_question", label: "Long Question" }, { value: "short_question", label: "Short Question" }]} placeholder="Choose written type" />
              </Field>
            )}
            {isMcq ? (
              <div className="self-end rounded-xl bg-primary-soft px-4 py-3 text-xs font-semibold leading-5 text-primary-dark">Saved MCQs are ready in Test Builder. Students see them after you publish a test.</div>
            ) : (
              <div className="self-end rounded-xl bg-primary-soft px-4 py-3 text-xs font-semibold leading-5 text-primary-dark">Saved written questions appear on the selected topic page.</div>
            )}
            {!isMcq && (
              <Field label="Exam Session" helper="Optional label shown with the question.">
                <SmartSelect value={form.examSession} onChange={(value) => setForm({ ...form, examSession: value })} options={[{ value: "morning", label: "Morning" }, { value: "evening", label: "Evening" }]} placeholder="Optional session" />
              </Field>
            )}
          </div>

          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary-muted bg-primary-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm"><Languages className="h-5 w-5" /></span>
              <div><p className="text-sm font-black text-slate-950">Question language</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Choose Urdu to enable right-to-left writing and the Urdu reading font for students.</p></div>
            </div>
            <div className="inline-flex shrink-0 rounded-xl border border-primary-muted bg-white p-1" role="group" aria-label="Question language">
              <button type="button" aria-pressed={!isUrdu} onClick={() => setForm({ ...form, language: "en" })} className={`rounded-lg px-4 py-2 text-sm font-black ${!isUrdu ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>English</button>
              <button type="button" aria-pressed={isUrdu} onClick={() => setForm({ ...form, language: "ur" })} className={`urdu-content rounded-lg px-5 py-2 text-base font-bold ${isUrdu ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>اردو</button>
            </div>
          </div>

          {!isMcq && (
            <div className="mb-5">
              <Field label="Exam Year" helper="Optional. Example: 2025">
                <input type="number" min="1900" max="2100" className="input" value={form.examYear} onChange={(event) => setForm({ ...form, examYear: event.target.value })} placeholder="e.g. 2025" />
              </Field>
            </div>
          )}

          <div className="rounded-2xl border border-primary-soft bg-primary-soft/70 p-4">
            <p className="text-sm font-black text-primary-dark">Study Context</p>
            <p className="mt-1 text-sm text-primary-dark">Choose where students should find this question.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <CustomSelect label="Board" value={form.board} onChange={(value) => setForm({ ...form, board: value, subject: "", chapter: "", topic: "", scenario: "" })} options={toSelectOptions(boards)} placeholder="Select board" isLoading={isLoadingContext} />
              <CustomSelect label="Class" value={form.class} onChange={(value) => setForm({ ...form, class: value, subject: "", chapter: "", topic: "", scenario: "" })} options={toSelectOptions(classes)} placeholder="Select class" isLoading={isLoadingContext} />
              <CustomSelect label="Group" value={form.group} onChange={(value) => setForm({ ...form, group: value, subject: "", chapter: "", topic: "", scenario: "" })} options={toSelectOptions(groups)} placeholder="Select group" isLoading={isLoadingContext} />
              <CustomSelect label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value, chapter: "", topic: "", scenario: "" })} options={toSelectOptions(subjects)} placeholder="Select subject" disabled={!form.board || !form.class || !form.group} />
              <CustomSelect label="Chapter" value={form.chapter} onChange={(value) => setForm({ ...form, chapter: value, topic: "", scenario: "" })} options={toSelectOptions(chapters)} placeholder="Select chapter" disabled={!form.subject} />
              <CustomSelect label="Topic" value={form.topic} onChange={(value) => setForm({ ...form, topic: value, scenario: "" })} options={toSelectOptions(topics)} placeholder={isMcq ? "Optional topic" : "Select topic"} disabled={!form.chapter} />
            </div>
          </div>

          {isMcq && form.type === "scenario_mcq" && (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-800">Scenario Based MCQs</h3>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                One scenario can have any number of questions. Select the same scenario again and save each related question. Students will see: read this scenario and answer the following questions.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <Field label="Use Existing Scenario" helper={form.scenario ? `${scenarioQuestionCount} question(s) already linked in this list.` : "Leave empty to create a new scenario below."}>
                  <SmartSelect value={form.scenario} onChange={(value) => setForm({ ...form, scenario: value })} options={scenarios.filter((scenario) => !scenario.topic || String(scenario.topic) === form.topic).map((scenario) => ({ value: scenario._id, label: scenario.title }))} placeholder="Create new scenario" />
                </Field>
                {form.scenario && (
                  <button type="button" onClick={() => setForm({ ...form, scenario: "" })} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-amber-800 shadow-sm">
                    New Scenario
                  </button>
                )}
              </div>
              {form.scenario ? (
                <p dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700 ${isUrdu ? "urdu-content text-right" : ""}`}>
                  {scenarios.find((item) => item._id === form.scenario)?.scenarioText || "Scenario selected."}
                </p>
              ) : (
                <div className="mt-4 grid gap-4">
                  <Field label="New Scenario Title" helper="Example: Read the passage about force and motion.">
                    <input dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary ${isUrdu ? "urdu-content text-right" : ""}`} value={form.scenarioTitle} onChange={(event) => setForm({ ...form, scenarioTitle: event.target.value })} placeholder={isUrdu ? "عنوان لکھیں" : "Scenario title"} />
                  </Field>
                  <Field label="Scenario Passage" helper="Write the shared passage, case or diagram description.">
                    <textarea dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`min-h-28 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary ${isUrdu ? "urdu-content text-right" : ""}`} value={form.scenarioText} onChange={(event) => setForm({ ...form, scenarioText: event.target.value })} placeholder={isUrdu ? "عبارت یہاں لکھیں" : "Scenario passage"} />
                  </Field>
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
              <Field label="Question" helper="Write the question exactly as students should read it.">
              <textarea required dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft ${isUrdu ? "urdu-content text-right" : ""}`} value={form.questionText} onChange={(event) => setForm({ ...form, questionText: event.target.value })} placeholder={isUrdu ? "سوال یہاں لکھیں" : "Question text"} />
            </Field>
          </div>

          {isMcq ? (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {form.options.map((option, index) => (
                  <Field key={option.key} label={`Option ${option.key}`} helper={index < 2 ? "Required" : "Optional"}>
                    <input required={index < 2} dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft ${isUrdu ? "urdu-content text-right" : ""}`} value={option.text} onChange={(event) => updateOption(index, event.target.value)} placeholder={isUrdu ? `جواب ${option.key}` : `Option ${option.key}`} />
                  </Field>
                ))}
              </div>

              <div className="mt-4 max-w-sm">
                <Field label="Correct answer">
                  <SmartSelect value={form.correctOption} onChange={(value) => setForm({ ...form, correctOption: value })} options={form.options.filter((option) => option.text.trim()).map((option) => ({ value: option.key, label: `Option ${option.key}` }))} placeholder="Select correct option" />
                </Field>
              </div>

              <details className="mt-4 rounded-xl border border-slate-200 px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">Optional question details</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Field label="Difficulty">
                  <SmartSelect value={form.difficulty} onChange={(value) => setForm({ ...form, difficulty: value })} options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} placeholder="Difficulty" />
                </Field>
                <Field label="Marks">
                  <input type="number" min="1" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.marks} onChange={(event) => setForm({ ...form, marks: Number(event.target.value) })} />
                </Field>
                <Field label="Tags" helper="Optional. Separate with commas.">
                  <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="important,board" />
                </Field>
                </div>
              </details>

              <Field label="Explanation" helper="Shown after result. Keep it short and helpful.">
                <textarea dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`mt-2 min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft ${isUrdu ? "urdu-content text-right" : ""}`} value={form.explanation} onChange={(event) => setForm({ ...form, explanation: event.target.value })} placeholder={isUrdu ? "صحیح جواب کی وضاحت لکھیں" : "Why is this answer correct?"} />
              </Field>
            </>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Written questions do not need options, correct answers or explanations. They appear on the topic questions page with year/session labels.
            </div>
          )}

          {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">{error}</p>}
          {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}

          <div className="mt-5 flex justify-end">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isEditing ? "Save changes" : "Save question"}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <h2 className="text-xl font-black text-slate-950">Questions</h2>
              <p className="mt-1 text-sm text-slate-500">Saved MCQs are ready for tests. Students see only published tests.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <input
                value={listFilter.search}
                onChange={(event) => updateListFilter({ search: event.target.value })}
                placeholder="Search questions"
                aria-label="Search questions"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-primary sm:w-64"
              />
              <button type="button" onClick={clearListFilters} className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-200">Clear</button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Question list">
            {[
              { value: "", label: "All questions" },
              { value: "draft", label: "Drafts to review" },
            ].map((stage) => (
              <button
                key={stage.value || "all"}
                type="button"
                role="tab"
                aria-selected={listFilter.status === stage.value}
                onClick={() => updateListFilter({ status: stage.value, contentType: stage.value ? "mcq" : "" })}
                className={`rounded-xl px-3 py-3 text-xs font-black transition sm:text-sm ${listFilter.status === stage.value ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {stage.label}
              </button>
            ))}
          </div>

          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <summary className="cursor-pointer text-sm font-bold text-slate-700">Filter questions</summary>
            <div className="grid gap-4 lg:grid-cols-4">
              <CustomSelect
                label="Board"
                value={listFilter.board}
                onChange={(value) => updateListFilter({ board: value, subject: "", chapter: "", topic: "" })}
                options={toSelectOptions(boards)}
                placeholder="All boards"
                isLoading={isLoadingContext}
              />
              <CustomSelect
                label="Class"
                value={listFilter.class}
                onChange={(value) => updateListFilter({ class: value, subject: "", chapter: "", topic: "" })}
                options={toSelectOptions(classes)}
                placeholder="All classes"
                isLoading={isLoadingContext}
              />
              <CustomSelect
                label="Group"
                value={listFilter.group}
                onChange={(value) => updateListFilter({ group: value, subject: "", chapter: "", topic: "" })}
                options={toSelectOptions(groups)}
                placeholder="All groups"
                isLoading={isLoadingContext}
              />
              <Field label="Question Type">
                <SmartSelect
                  value={listFilter.contentType}
                  onChange={(value) => updateListFilter({ contentType: value })}
                  options={[{ value: "mcq", label: "MCQs" }, { value: "long_question", label: "Long Questions" }, { value: "short_question", label: "Short Questions" }]}
                  placeholder="All question types"
                />
              </Field>
              <CustomSelect
                label="Subject"
                value={listFilter.subject}
                onChange={(value) => updateListFilter({ subject: value, chapter: "", topic: "" })}
                options={toSelectOptions(listSubjects)}
                placeholder="All subjects"
                disabled={!listFilter.board || !listFilter.class || !listFilter.group}
              />
              <CustomSelect
                label="Chapter"
                value={listFilter.chapter}
                onChange={(value) => updateListFilter({ chapter: value, topic: "" })}
                options={toSelectOptions(listChapters)}
                placeholder="All chapters"
                disabled={!listFilter.subject}
              />
              <CustomSelect
                label="Topic"
                value={listFilter.topic}
                onChange={(value) => updateListFilter({ topic: value })}
                options={toSelectOptions(listTopics)}
                placeholder="All topics"
                disabled={!listFilter.chapter}
              />
            </div>
          </details>

          {(selectedQuestionIds.length > 0 || hasScopeFilter) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3">
              <p className="text-sm font-bold text-slate-700">
                {selectedQuestionIds.length ? `${selectedQuestionIds.length} selected` : `${pagination.total} matching the current filters`}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedQuestionIds.length > 0 && (
                  <button type="button" onClick={() => setBulkDeleteRequest({ mode: "selected" })} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-rose-700">
                    <Trash2 className="h-4 w-4" /> Remove selected
                  </button>
                )}
                {hasScopeFilter && pagination.total > 0 && (
                  <button type="button" onClick={() => setBulkDeleteRequest({ mode: "all" })} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" /> Remove all matching ({pagination.total})
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : questions.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Select all questions on this page" checked={allPageSelected} onChange={togglePageSelection} className="h-5 w-5 cursor-pointer rounded accent-[var(--color-primary)]" /></th>
                      <th className="w-16 px-3 py-3 font-black">No.</th>
                      <th className="px-3 py-3 font-black">Question</th>
                      <th className="w-52 px-3 py-3 font-black">Location</th>
                      <th className="w-36 px-3 py-3 font-black">Type</th>
                      <th className="w-36 px-4 py-3 text-right font-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questions.map((question, index) => (
                      <tr key={question._id} className={`align-top transition hover:bg-slate-50/80 ${selectedQuestionIds.includes(question._id) ? "bg-primary-soft/50" : ""}`}>
                        <td className="px-4 py-4"><input type="checkbox" aria-label={`Select question ${((page - 1) * PAGE_SIZE) + index + 1}`} checked={selectedQuestionIds.includes(question._id)} onChange={() => toggleQuestionSelection(question._id)} className="h-5 w-5 cursor-pointer rounded accent-[var(--color-primary)]" /></td>
                        <td className="px-3 py-4 font-black text-slate-500">{((page - 1) * PAGE_SIZE) + index + 1}</td>
                        <td className="max-w-xl px-3 py-4">
                          <p dir={question.contentLanguage === "ur" ? "rtl" : "ltr"} lang={question.contentLanguage === "ur" ? "ur" : "en"} className={`font-bold leading-6 text-slate-900 ${question.contentLanguage === "ur" ? "urdu-content text-lg" : ""}`}>{question.questionText}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {question.contentLanguage === "ur" && <span className="urdu-content rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-primary">اردو</span>}
                            {question.status === "draft" && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">Draft</span>}
                            {question.scenario?.title && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{question.scenario.title}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs leading-5 text-slate-500">{question.subject?.name || "Subject"}<br />{question.chapter?.name || "Chapter"}{question.topic?.name ? <><br />{question.topic.name}</> : null}</td>
                        <td className="px-3 py-4"><span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-black text-primary-dark">{questionLabel(question)}</span><p className="mt-2 text-xs text-slate-400">{question.marks || 1} mark{Number(question.marks || 1) === 1 ? "" : "s"}</p></td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {question.contentType === "mcq" && question.status === "draft" && <button type="button" onClick={() => markQuestionReady(question)} disabled={saving} title="Make available in Test Builder" className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white transition hover:bg-primary-dark disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /></button>}
                            <EditButton onClick={() => editQuestion(question)} title="Edit question" />
                            <DeleteButton onClick={() => setQuestionToDelete(question)} disabled={saving} title="Delete question" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500 sm:flex-row">
                <span>Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button>
                  <span className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-white">{page} / {pagination.pages}</span>
                  <button type="button" onClick={() => setPage((current) => Math.min(current + 1, pagination.pages))} disabled={page >= pagination.pages} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button>
                </div>
              </footer>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <SearchX className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-lg font-black text-slate-950">No questions found</h3>
              <p className="mt-2 text-sm text-slate-500">Add a question above or clear the list filters.</p>
            </div>
          )}
        </section>

        <details className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="cursor-pointer text-base font-black text-slate-900">Bulk upload from Excel</summary>
          <div className="pt-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm text-slate-600">Select the syllabus location above, download a template, fill in questions, then upload it here.</p>
              <div className="mt-4 max-w-sm">
                <Field label="Bulk question type">
                  <SmartSelect value={importKind} disabled={importBusy} onChange={(value) => { setImportKind(value); setImportPreview(null); setImportRows([]); }} options={[{ value: "standard_mcq", label: "Standard MCQs" }, { value: "scenario_mcq", label: "Scenario MCQs" }, { value: "short_question", label: "Short questions" }, { value: "long_question", label: "Long questions" }]} />
                </Field>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">
                <Download className="h-4 w-4" />
                Download Format
              </button>
              <label className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white ${canImportQuestions ? "cursor-pointer bg-slate-950 hover:bg-primary" : "cursor-not-allowed bg-slate-300"}`}>
                {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importBusy ? "Processing..." : "Upload Excel"}
                <input type="file" accept=".xlsx" onChange={handleImportFile} className="hidden" disabled={!canImportQuestions || importBusy} />
              </label>
            </div>
          </div>
          {importPreview && (
            <div className="mt-5 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap justify-between gap-3 border-b border-slate-100 p-4 text-sm font-black">
                <span>Total: {importPreview.summary.total}</span>
                <span className="text-emerald-600">Valid: {importPreview.summary.valid}</span>
                <span className="text-rose-600">Invalid: {importPreview.summary.invalid}</span>
                <button type="button" onClick={commitImport} disabled={importPreview.summary.valid === 0 || importBusy} className="rounded-xl bg-primary px-4 py-2 text-white disabled:opacity-50">{importBusy ? "Importing..." : "Import Valid Rows"}</button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {importPreview.preview.slice(0, 50).map((item) => (
                  <div key={item.rowNumber} className="border-b border-slate-100 p-3 text-sm">
                    <span className={item.status === "valid" ? "font-black text-emerald-600" : "font-black text-rose-600"}>Row {item.rowNumber}: {item.status}</span>
                    {item.errors.length > 0 && <p className="mt-1 text-xs text-rose-600">{item.errors.join(" | ")}</p>}
                    <p className="mt-1 line-clamp-1 text-slate-500">{item.row.questionText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </details>
      </div>
      <DeleteConfirmationModal
        isOpen={Boolean(questionToDelete)}
        onClose={() => setQuestionToDelete(null)}
        onConfirm={() => deleteQuestion(questionToDelete?._id)}
        itemName={questionToDelete?.questionText || "this question"}
        entityName="Question"
        actionVerb="archive"
        confirmLabel="Archive question"
        isDeleting={saving}
        description="It will be removed from new tests and archived in the question bank. Existing student attempts and their results will be kept. Tests left with no questions will be archived."
      />
      <DeleteConfirmationModal
        isOpen={Boolean(bulkDeleteRequest)}
        onClose={() => setBulkDeleteRequest(null)}
        onConfirm={deleteQuestionsInBulk}
        itemName={bulkDeleteRequest?.mode === "all" ? `all ${pagination.total} questions matching the current filters` : `${selectedQuestionIds.length} selected question${selectedQuestionIds.length === 1 ? "" : "s"}`}
        entityName="Questions"
        actionVerb="archive"
        confirmLabel="Remove questions"
        isDeleting={saving}
        description="They will be removed from active tests. Existing student attempts and results will remain available."
      />
    </div>
  );
};

export default QuestionBankManagement;
