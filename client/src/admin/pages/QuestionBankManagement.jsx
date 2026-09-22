import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Download, FileSpreadsheet, Loader2, Plus, Save, SearchX, Upload, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { CustomSelect } from "../components/CustomSelect";
import { DeleteButton, EditButton } from "../components/AdminUI";
import SmartSelect from "../../shared/CustomSelect";
import { AppContext } from "../../context/AppContext";

const optionKeys = ["A", "B", "C", "D"];

const defaultForm = {
  id: "",
  mode: "mcq",
  type: "standard_mcq",
  contentType: "mcq",
  questionText: "",
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
  { value: "mcq", title: "MCQ / Test Questions", text: "For chapter tests, topic tests and scenario-based MCQ practice." },
  { value: "written", title: "Short & Long Questions", text: "For topic pages where students read board-style written questions." },
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
const sortQuestions = (items) => [...items].sort((a, b) => (a.questionText || "").localeCompare(b.questionText || "", undefined, { numeric: true, sensitivity: "base" }));

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
    status: question.status || "published",
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
  const [listFilter, setListFilter] = useState({ contentType: "", board: "", class: "", group: "", subject: "", chapter: "", topic: "", search: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isMcq = form.mode === "mcq";
  const isEditing = Boolean(form.id);
  const writtenImport = ["short_question", "long_question"].includes(importKind);
  const canImportQuestions = Boolean(form.board && form.class && form.group && form.subject && form.chapter && (!writtenImport || form.topic));

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (listFilter.contentType) params.set("contentType", listFilter.contentType);
      if (listFilter.board) params.set("board", listFilter.board);
      if (listFilter.class) params.set("class", listFilter.class);
      if (listFilter.group) params.set("group", listFilter.group);
      if (listFilter.subject) params.set("subject", listFilter.subject);
      if (listFilter.chapter) params.set("chapter", listFilter.chapter);
      if (listFilter.topic) params.set("topic", listFilter.topic);
      if (listFilter.search.trim()) params.set("search", listFilter.search.trim());
      const response = await axiosInstance.get(`/questions?${params.toString()}`);
      setQuestions(sortQuestions(response.data.questions || []));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load questions.");
    } finally {
      setLoading(false);
    }
  }, [listFilter]);

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
      setMessage(isEditing ? "Question updated successfully." : form.type === "scenario_mcq" ? "Question saved. Add the next question for this scenario if needed." : "Question saved successfully.");
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
      setMessage("Question deleted successfully.");
      await loadQuestions();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete question.");
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

  const updateListFilter = (changes) => setListFilter((current) => ({ ...current, ...changes }));
  const clearListFilters = () => setListFilter({ contentType: "", board: "", class: "", group: "", subject: "", chapter: "", topic: "", search: "" });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-slate-950 p-7 text-white">
          <ClipboardList className="h-8 w-8" />
          <h1 className="mt-4 text-3xl font-black">Question Bank</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Add MCQs for tests, create scenario-based question groups, and manage topic-wise short and long questions from one clean workspace.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {contentModes.map((mode) => {
            const active = form.mode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setMode(mode.value)}
                className={`rounded-3xl border p-5 text-left shadow-sm transition ${active ? "border-primary bg-primary-soft text-primary-dark" : "border-slate-200 bg-white text-slate-700 hover:border-primary/30"}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-lg font-black">{mode.title}</span>
                  {active && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </span>
                <span className="mt-2 block text-sm leading-6">{mode.text}</span>
              </button>
            );
          })}
        </section>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-black text-slate-950">{isEditing ? "Update Question" : isMcq ? "Add MCQ Question" : "Add Written Question"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isMcq ? "The form below is optimized for tests and scenario MCQs." : "The form below is optimized for topic short and long question pages."}
              </p>
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
            <Field label="Publish Status" helper="Draft stays hidden from students.">
              <SmartSelect value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }]} placeholder="Choose status" />
            </Field>
            {!isMcq && (
              <Field label="Exam Session" helper="Optional label shown with the question.">
                <SmartSelect value={form.examSession} onChange={(value) => setForm({ ...form, examSession: value })} options={[{ value: "morning", label: "Morning" }, { value: "evening", label: "Evening" }]} placeholder="Optional session" />
              </Field>
            )}
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
            <p className="mt-1 text-sm leading-6 text-primary-dark">
              {isMcq ? "Topic is optional for chapter-wide MCQs. Select a topic when this question belongs to one topic only." : "Written questions must be attached to a topic so students see them in the correct topic page."}
            </p>
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
                <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700">
                  {scenarios.find((item) => item._id === form.scenario)?.scenarioText || "Scenario selected."}
                </p>
              ) : (
                <div className="mt-4 grid gap-4">
                  <Field label="New Scenario Title" helper="Example: Read the passage about force and motion.">
                    <input className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary" value={form.scenarioTitle} onChange={(event) => setForm({ ...form, scenarioTitle: event.target.value })} placeholder="Scenario title" />
                  </Field>
                  <Field label="Scenario Passage" helper="Write the shared passage, case or diagram description.">
                    <textarea className="min-h-28 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary" value={form.scenarioText} onChange={(event) => setForm({ ...form, scenarioText: event.target.value })} placeholder="Scenario passage" />
                  </Field>
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
            <Field label="Question Text" helper="Write exactly what the student will see.">
              <textarea required className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" value={form.questionText} onChange={(event) => setForm({ ...form, questionText: event.target.value })} placeholder="Question text" />
            </Field>
          </div>

          {isMcq ? (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {form.options.map((option, index) => (
                  <Field key={option.key} label={`Option ${option.key}`} helper={index < 2 ? "Required" : "Optional"}>
                    <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" value={option.text} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Option ${option.key}`} />
                  </Field>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                <Field label="Correct Answer" helper="Must match a filled option.">
                  <SmartSelect value={form.correctOption} onChange={(value) => setForm({ ...form, correctOption: value })} options={form.options.map((option) => ({ value: option.key, label: `Option ${option.key}` }))} placeholder="Choose answer" />
                </Field>
                <Field label="Difficulty" helper="Used in filters.">
                  <SmartSelect value={form.difficulty} onChange={(value) => setForm({ ...form, difficulty: value })} options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} placeholder="Difficulty" />
                </Field>
                <Field label="Marks" helper="Usually 1">
                  <input type="number" min="1" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.marks} onChange={(event) => setForm({ ...form, marks: Number(event.target.value) })} />
                </Field>
                <Field label="Tags" helper="Comma separated">
                  <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="important,board" />
                </Field>
              </div>

              <Field label="Explanation" helper="Shown after result. Keep it short and helpful.">
                <textarea className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" value={form.explanation} onChange={(event) => setForm({ ...form, explanation: event.target.value })} placeholder="Why is this answer correct?" />
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
              {isEditing ? "Update Question" : isMcq && form.type === "scenario_mcq" ? "Save & Add Next" : "Save Question"}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <h2 className="text-xl font-black text-slate-950">Added Questions</h2>
              <p className="mt-1 text-sm text-slate-500">Filter by board, class, group, subject, chapter or topic before editing and deleting.</p>
            </div>
            <button type="button" onClick={clearListFilters} className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-200">
              Clear Filters
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
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
              <Field label="Search">
                <input
                  value={listFilter.search}
                  onChange={(event) => updateListFilter({ search: event.target.value })}
                  placeholder="Search question text"
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-primary"
                />
              </Field>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : questions.length ? (
            <div className="mt-5 divide-y divide-slate-100">
              {questions.map((question) => (
                <article key={question._id} className="py-4">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary-dark">{questionLabel(question)}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${question.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{question.status}</span>
                        {question.scenario?.title && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Scenario: {question.scenario.title}</span>}
                      </div>
                      <p className="mt-2 font-black leading-7 text-slate-950">{question.questionText}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                        {question.subject?.name || "Subject"} / {question.chapter?.name || "Chapter"}{question.topic?.name ? ` / ${question.topic.name}` : ""} / {question.marks || 1} marks
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <EditButton onClick={() => editQuestion(question)} title="Edit question" />
                      <DeleteButton onClick={() => deleteQuestion(question._id)} disabled={saving} title="Delete question" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <SearchX className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-lg font-black text-slate-950">No questions found</h3>
              <p className="mt-2 text-sm text-slate-500">Add a question above or clear the list filters.</p>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-primary">
                <FileSpreadsheet className="h-4 w-4" />
                Bulk Excel Upload
              </div>
              <p className="mt-1 text-sm text-slate-500">
                First select Board, Class, Group, Subject and Chapter in the Study Context above. The Excel file should contain only question data.
              </p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-400">
                {writtenImport ? "Select a topic above. Columns: questionText, examYear, examSession. Year and session are optional; use morning or evening for session. No answers or options are needed." : "Columns: questionText, optionA, optionB, optionC, optionD, correctOption, explanation. Use A, B, C or D for the correct answer."}
                {importKind === "scenario_mcq" && " Also fill scenarioTitle and scenarioText on every row. Repeat the same title and passage for all questions in one scenario; there is no fixed question count."}
                {" Download the matching template and upload it unchanged to test, or replace the sample rows with your questions."}
              </p>
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
        </section>
      </div>
    </div>
  );
};

export default QuestionBankManagement;
