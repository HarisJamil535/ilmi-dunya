import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, FileDown, FileText, ImagePlus, KeyRound, Library, PenLine, Plus, RefreshCw, Save, Scissors, Shuffle, Sparkles, Trash2, Wand2, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import CustomSelect from "../../shared/CustomSelect";
import { AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";
import ChapterPlan from "./ChapterPlan";
import { requiredFor, spreadEvenly } from "./planMath";
import CustomQuestionModal from "./CustomQuestionModal";
import DatePicker from "./DatePicker";
import DurationPicker from "./DurationPicker";
import SubjectPicker from "./SubjectPicker";
import PaperPreview from "./PaperPreview";
import PaperStyle from "./PaperStyle";
import QuestionPicker from "./QuestionPicker";
import { Button, Field, Pill, Stepper, Toggle, card, input } from "./ui";
import { KIND_LABEL, TEMPLATES, newConfig, questionsInSlots, sectionMarks, sectionsFromTemplate, templateLayout, totalMarks } from "./paperDefaults";
import "./paper-maker.css";

const STEPS = [["Set up", "Layout, pattern and chapters"], ["Questions", "Pick, edit and add your own"], ["Download", "Preview, PDF and Word"]];
const LAYOUTS = [["single", "Single paper", "One paper for every student. Optional versions A to D."], ["tear", "Two groups, one sheet", "Groups A and B on one sheet, printed both sides, then torn in half."]];
const CHOICE_RULES = [{ value: "different", label: "Different chapters (recommended)" }, { value: "same", label: "Same chapter" }, { value: "any", label: "Any chapter" }];
const blobMessage = async (error, fallback) => { try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { return error.response?.data?.message || fallback; } };
const download = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); };

const Section = ({ number, title, hint, aside, children }) => <div className={card}>
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-white">{number}</span><div><h2 className="text-lg font-black leading-tight text-slate-900">{title}</h2>{hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}</div></div>{aside}</div>
  {children}
</div>;

const ActionButton = ({ icon: Icon, label, tone = "plain", spinning, ...props }) => <button type="button" {...props} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition disabled:opacity-40 ${tone === "danger" ? "border-rose-100 text-rose-600 hover:bg-rose-50" : "border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary"}`}>{Icon && <Icon className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />}{label}</button>;

// A text field with a list of known schools that opens under it as you type.
function SchoolInput({ value, onChange, schools }) {
  const [open, setOpen] = useState(false);
  const matches = schools.filter((s) => s.name.toLowerCase().includes(value.trim().toLowerCase()) && s.name !== value).slice(0, 6);
  return <div className="relative">
    <input className={input} value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} placeholder="Type your school's name" autoComplete="off" />
    {open && matches.length > 0 && <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl animate-in fade-in slide-in-from-top-2">{matches.map((s) => <li key={s._id}><button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(s.name); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-primary-soft">{s.name}</button></li>)}</ul>}
  </div>;
}

export default function PaperEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [schools, setSchools] = useState([]);
  const [outline, setOutline] = useState(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [config, setConfig] = useState(newConfig);
  const [selection, setSelection] = useState({});
  const [custom, setCustom] = useState([]);
  const [seed, setSeed] = useState("");
  const [paperId, setPaperId] = useState(id || "");
  const [bank, setBank] = useState({ questions: {}, scenarios: {} });
  const [warnings, setWarnings] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState(null);
  const [writer, setWriter] = useState(null);
  const [papers, setPapers] = useState(null);
  const [fit, setFit] = useState(null);
  const [version, setVersion] = useState("A");
  const [showAnswers, setShowAnswers] = useState(false);
  const [more, setMore] = useState(false);
  const logoInput = useRef(null);
  const autoPicked = useRef(false);

  const remember = useCallback((questions = [], scenarios = []) => setBank((current) => ({ questions: { ...current.questions, ...Object.fromEntries(questions.map((q) => [q._id, q])) }, scenarios: { ...current.scenarios, ...Object.fromEntries(scenarios.map((s) => [s._id, s])) } })), []);
  const edit = (fn) => { setConfig(fn); setDirty(true); setPapers(null); };
  const touch = () => { setDirty(true); setPapers(null); };
  const setHeader = (patch) => edit((c) => ({ ...c, header: { ...c.header, ...patch } }));
  const setLayout = (patch) => edit((c) => ({ ...c, layout: { ...c.layout, ...patch } }));
  const setSection = (sectionId, patch) => edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) }));
  const clearSelection = () => { setSelection({}); autoPicked.current = false; };

  useEffect(() => {
    Promise.all([axiosInstance.get("/papers/catalog"), axiosInstance.get("/papers/schools")])
      .then(([cat, sch]) => { setCatalog(cat.data); setSchools(sch.data.schools || []); })
      .catch((err) => setNotice({ type: "error", text: err.response?.data?.message || "Could not load the paper tools." }));
  }, []);

  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`/papers/${id}`).then(({ data }) => {
      const fresh = newConfig();
      const saved = { ...fresh, ...data.paper.config, header: { ...fresh.header, ...data.paper.config.header }, layout: { ...fresh.layout, ...data.paper.config.layout }, options: { ...fresh.options, ...data.paper.config.options } };
      setTitle(data.paper.title); setConfig(saved); setSelection(data.paper.selection || {}); setCustom(data.paper.custom || []); setSeed(data.paper.seed); setPaperId(data.paper._id);
      autoPicked.current = true; remember(data.questions, data.scenarios); setStep(1);
    }).catch((err) => setNotice({ type: "error", text: err.response?.data?.message || "Paper not found." })).finally(() => setLoading(false));
  }, [id, remember]);

  const subjectId = config.scope.subject;
  useEffect(() => {
    if (!subjectId) { setOutline(null); return undefined; }
    let live = true;
    axiosInstance.get(`/papers/subjects/${subjectId}/outline`).then(({ data }) => {
      if (!live) return;
      setOutline(data);
      // A new paper starts with every chapter that has questions, so the teacher only unticks what is not taught.
      setConfig((c) => (c.scope.chapters.length || c.scope.subject !== subjectId ? c : { ...c, scope: { ...c.scope, chapters: data.chapters.filter((ch) => ch.counts.mcq + ch.counts.short + ch.counts.long > 0).map((ch) => ({ chapter: ch._id, weight: 1, quota: {}, topics: [] })) } }));
    }).catch(() => live && setOutline(null));
    return () => { live = false; };
  }, [subjectId]);

  const nameOf = (list, value) => (list || []).find((item) => item._id === value)?.name || "";
  const chooseSubject = (value) => {
    const subject = (catalog?.subjects || []).find((s) => s._id === value);
    if (!subject) return;
    edit((c) => ({ ...c, scope: { board: subject.board, class: subject.class, group: subject.group || "", subject: subject._id, chapters: [] }, header: { ...c.header, subjectTitle: subject.name, className: nameOf(catalog.classes, subject.class) } }));
    clearSelection();
  };
  const tear = config.layout.mode === "tear";
  const total = totalMarks(config.sections);
  const hasObjective = config.sections.some((s) => s.kind === "mcq");
  const hasSubjective = config.sections.some((s) => s.kind !== "mcq");

  // ---- Chapters and how many questions each gives.
  const chosenIds = new Set(config.scope.chapters.map((item) => item.chapter));
  const usable = (outline?.chapters || []).filter((ch) => ch.counts.mcq + ch.counts.short + ch.counts.long > 0);
  const setChapters = (list) => edit((c) => ({ ...c, scope: { ...c.scope, chapters: list } }));
  const toggleChapter = (chapterId) => setChapters(chosenIds.has(chapterId) ? config.scope.chapters.filter((item) => item.chapter !== chapterId) : [...config.scope.chapters, { chapter: chapterId, weight: 1, quota: {}, topics: [] }]);
  const available = (kind) => config.scope.chapters.reduce((sum, item) => sum + (outline?.chapters.find((c) => c._id === item.chapter)?.counts[kind] || 0), 0);
  const setQuota = (chapterId, kind, value) => setChapters(config.scope.chapters.map((item) => (item.chapter === chapterId ? { ...item, quota: { ...item.quota, [kind]: value } } : item)));
  const spread = () => {
    const need = requiredFor(config.sections);
    const chosen = config.scope.chapters;
    const quotas = chosen.map(() => ({}));
    for (const kind of ["mcq", "short", "long"]) {
      if (!need[kind]) continue;
      const caps = chosen.map((item) => outline?.chapters.find((c) => c._id === item.chapter)?.counts[kind] || 0);
      spreadEvenly(need[kind], caps).forEach((value, i) => { quotas[i][kind] = value; });
    }
    setChapters(chosen.map((item, i) => ({ ...item, quota: quotas[i] })));
  };

  const applyTemplate = (key) => { edit((c) => ({ ...c, sections: sectionsFromTemplate(key), layout: { ...c.layout, ...templateLayout(key) } })); clearSelection(); };
  const sameAs = (key) => { const want = sectionsFromTemplate(key); return config.sections.length === want.length && want.every((w, i) => config.sections[i].kind === w.kind && config.sections[i].total === w.total && config.sections[i].marksEach === w.marksEach); };
  const chooseLayout = (mode) => {
    if (mode === "tear" && sameAs("full")) applyTemplate("tear");
    else if (mode === "single" && sameAs("tear")) applyTemplate("full");
    else edit((c) => ({ ...c, layout: { ...c.layout, mode, pages: mode === "tear" ? 0 : c.layout.pages } }));
  };

  // ---- Questions.
  const usedIds = () => Object.values(selection).flat().flatMap((slot) => slot.questions);
  const activeCustom = () => { const used = new Set(usedIds()); return custom.filter((q) => used.has(q._id)); };
  const generate = useCallback(async (keepCurrent, current = {}, label = "generate") => {
    setBusy(label); setNotice(null);
    try {
      const { data } = await axiosInstance.post("/papers/generate", { config, seed: seed || undefined, paperId: paperId || undefined, keep: keepCurrent ? current : {} });
      setSelection(data.selection); setSeed(data.seed); setWarnings(data.warnings || []); remember(data.questions, data.scenarios); touch();
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not pick questions." }); } finally { setBusy(""); }
  }, [config, seed, paperId, remember]);
  const repick = (sectionId) => { const { [sectionId]: gone, ...others } = selection; void gone; generate(true, others, `repick-${sectionId}`); };
  // The chapter the other side of an OR pair uses, so a new question can avoid it when the section asks for different chapters.
  const otherSide = (section, slot, qIndex) => (section.choice && (section.choiceRule || "different") === "different" ? bank.questions[slot.questions.find((_, i) => i !== qIndex)]?.chapter : "") || undefined;
  const swap = async (sectionId, slotIndex, qIndex) => {
    const section = config.sections.find((s) => s.id === sectionId);
    const slot = selection[sectionId][slotIndex];
    setBusy(`swap-${sectionId}-${slotIndex}-${qIndex}`);
    try {
      const old = bank.questions[slot.questions[qIndex]];
      const { data } = await axiosInstance.post("/papers/suggest", { config, sectionId, exclude: usedIds(), chapter: old?.chapter, avoidChapter: otherSide(section, slot, qIndex) });
      remember([data.question]);
      setSelection((current) => ({ ...current, [sectionId]: current[sectionId].map((s, i) => (i === slotIndex ? { ...s, questions: s.questions.map((q, j) => (j === qIndex ? data.question._id : q)) } : s)) })); touch();
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "No other question is available." }); } finally { setBusy(""); }
  };
  // Fills the empty side of an OR pair with a suitable question from the bank.
  const fillSide = async (sectionId, slotIndex) => {
    const section = config.sections.find((s) => s.id === sectionId);
    const slot = selection[sectionId][slotIndex];
    setBusy(`fill-${sectionId}-${slotIndex}`);
    try {
      const { data } = await axiosInstance.post("/papers/suggest", { config, sectionId, exclude: usedIds(), avoidChapter: otherSide(section, slot, slot.questions.length) });
      remember([data.question]);
      setSelection((current) => ({ ...current, [sectionId]: current[sectionId].map((s, i) => (i === slotIndex ? { ...s, questions: [...s.questions, data.question._id] } : s)) })); touch();
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "No other question is available." }); } finally { setBusy(""); }
  };
  // Removes one question; an OR pair keeps its other side, and a scenario goes as a whole.
  const removeQuestion = (sectionId, slotIndex, qIndex) => {
    setSelection((current) => ({ ...current, [sectionId]: current[sectionId].flatMap((slot, i) => {
      if (i !== slotIndex) return [slot];
      if (slot.scenario) return [];
      const questions = slot.questions.filter((_, j) => j !== qIndex);
      return questions.length ? [{ ...slot, questions }] : [];
    }) })); touch();
  };
  const moveSlot = (sectionId, from, to) => { setSelection((current) => { const list = [...current[sectionId]]; [list[from], list[to]] = [list[to], list[from]]; return { ...current, [sectionId]: list }; }); touch(); };
  const addToSection = ({ sectionId, slotIndex, qIndex }, picked, scenarioId) => {
    setSelection((current) => {
      const slots = [...(current[sectionId] || [])];
      if (qIndex !== undefined && slotIndex !== undefined) slots[slotIndex] = { ...slots[slotIndex], questions: slots[slotIndex].questions.map((q, j) => (j === qIndex ? picked[0]._id : q)) };
      else if (slotIndex !== undefined && slotIndex !== null) slots[slotIndex] = { ...slots[slotIndex], questions: [...slots[slotIndex].questions, ...picked.map((q) => q._id)] };
      else if (scenarioId) slots.push({ scenario: scenarioId, questions: picked.map((q) => q._id) });
      else picked.forEach((q) => slots.push({ scenario: "", questions: [q._id] }));
      return { ...current, [sectionId]: slots };
    });
    remember(picked); touch();
  };
  const saveCustom = (question) => {
    const isNew = !custom.some((q) => q._id === question._id);
    setCustom((list) => (isNew ? [...list, question] : list.map((q) => (q._id === question._id ? question : q))));
    remember([question]);
    if (isNew) addToSection({ sectionId: writer.section.id, slotIndex: writer.slotIndex, qIndex: writer.qIndex }, [question]);
    touch(); setWriter(null);
  };

  // Questions whose wording appears more than once in the paper.
  const repeated = useMemo(() => {
    const seen = new Map();
    for (const qid of Object.values(selection).flat().flatMap((slot) => slot.questions)) {
      const text = (bank.questions[qid]?.questionText || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (text) seen.set(text, [...(seen.get(text) || []), qid]);
    }
    return new Set([...seen.values()].filter((ids) => ids.length > 1).flat());
  }, [selection, bank.questions]);

  // What the paper covers: questions and marks from each chapter.
  const coverage = useMemo(() => {
    const rows = new Map();
    for (const section of config.sections) {
      const slots = selection[section.id] || [];
      const share = section.kind === "mcq" ? section.marksEach : (section.marksEach * section.attempt) / Math.max(1, section.total) / (section.choice ? 2 : 1);
      for (const slot of slots) for (const qid of slot.questions) {
        const q = bank.questions[qid]; const key = q?.chapter || "";
        const row = rows.get(key) || { mcq: 0, short: 0, long: 0, marks: 0 };
        row[section.kind] += 1; row.marks += share; rows.set(key, row);
      }
    }
    return [...rows.entries()].map(([chapterId, row]) => ({ chapterId, ...row, marks: Math.round(row.marks * 10) / 10 }));
  }, [selection, bank.questions, config.sections]);

  const readyForQuestions = Boolean(subjectId && config.scope.chapters.length && config.sections.length);
  const goTo = (next) => { if (next === 1 && !Object.keys(selection).length && !autoPicked.current) { autoPicked.current = true; generate(false); } setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ---- Saving, preview, downloads.
  const [autoState, setAutoState] = useState("");
  const saving = useRef(false);
  const save = async (quiet, auto = false) => {
    if (saving.current) return paperId || null;
    saving.current = true;
    if (auto) setAutoState("saving"); else setBusy("save");
    try {
      const body = { title: title.trim() || [config.header.subjectTitle, config.header.examName].filter(Boolean).join(" - "), config, selection, custom: activeCustom(), seed };
      let savedId = paperId;
      if (paperId) { const { data } = await axiosInstance.put(`/papers/${paperId}`, body); setSeed(data.paper.seed); }
      else { const { data } = await axiosInstance.post("/papers", body); savedId = data.paper._id; setPaperId(savedId); setSeed(data.paper.seed); window.history.replaceState(null, "", `/admin/papers/${savedId}`); }
      setDirty(false); setAutoState(auto ? "saved" : "");
      if (!quiet) setNotice({ type: "success", text: "Paper saved." });
      return savedId;
    } catch (err) { if (auto) setAutoState("failed"); else setNotice({ type: "error", text: err.response?.data?.message || "Could not save the paper." }); return null; } finally { saving.current = false; if (!auto) setBusy(""); }
  };
  // Changes save themselves a few seconds after the teacher stops editing, once the paper has questions.
  const saveLater = useRef(save);
  useEffect(() => { saveLater.current = save; });
  const hasQuestions = Object.keys(selection).length > 0;
  useEffect(() => {
    if (!dirty || busy || !(paperId || hasQuestions)) return undefined;
    const timer = setTimeout(() => saveLater.current(true, true), 4000);
    return () => clearTimeout(timer);
  }, [dirty, busy, paperId, hasQuestions, config, selection, custom, title]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const loadPreview = useCallback(async () => {
    setBusy("preview");
    try {
      const used = new Set(Object.values(selection).flat().flatMap((slot) => slot.questions));
      const { data } = await axiosInstance.post("/papers/preview", { config, selection, custom: custom.filter((q) => used.has(q._id)), seed });
      setPapers(data.papers); setFit(data.layout); setVersion((current) => (data.papers.some((p) => p.version === current) ? current : data.papers[0].version));
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not build the preview." }); } finally { setBusy(""); }
  }, [config, selection, custom, seed]);
  useEffect(() => { if (step === 2 && !papers && Object.keys(selection).length) loadPreview(); }, [step, papers, selection, loadPreview]);

  const exportFile = async (format, key) => {
    setBusy(`export-${format}-${key}`); setNotice(null);
    try {
      const savedId = dirty || !paperId ? await save(true) : paperId;
      if (!savedId) return;
      const response = await axiosInstance.get(`/papers/${savedId}/export`, { params: { format, key: key ? 1 : 0, version }, responseType: "blob", timeout: 120000 });
      download(response.data, /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || `paper.${format}`);
    } catch (err) { setNotice({ type: "error", text: await blobMessage(err, "The file could not be created. Please try again.") }); } finally { setBusy(""); }
  };

  // Uploads a school logo or a watermark picture and hands back its address.
  const uploadImage = async (file, done, label = "logo") => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { setNotice({ type: "error", text: "Upload the image as a PNG or JPG file." }); return; }
    const form = new FormData(); form.append("logo", file);
    setBusy(label); setNotice(null);
    try {
      const { data } = await axiosInstance.post("/papers/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
      done(data.logoUrl);
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "The image could not be uploaded." }); } finally { setBusy(""); }
  };
  const uploadLogo = (file) => uploadImage(file, (url) => setHeader({ logoUrl: url }));

  if (loading || !catalog) return notice?.type === "error" ? <AdminAlert type="error">{notice.text}</AdminAlert> : <AdminLoader label="Loading Paper Maker..." />;
  const slotsFilled = config.sections.every((s) => questionsInSlots(selection[s.id]) > 0);
  const chapterName = (chapterId) => { const ch = outline?.chapters.find((c) => c._id === chapterId); return ch ? `Chapter ${ch.chapterNumber}: ${ch.name}` : "No chapter"; };

  return <div className="mx-auto max-w-5xl space-y-5">
    <AdminPageHeader icon={FileText} eyebrow="Paper Maker" title={title || "New question paper"} description="Set up the paper, check the questions, then download a print-ready PDF or an editable Word file." />
    {notice && <AdminAlert type={notice.type}>{notice.text}</AdminAlert>}

    <nav aria-label="Steps" className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {STEPS.map(([label, hint], index) => <button key={label} type="button" disabled={index > 0 && !readyForQuestions} aria-current={step === index ? "step" : undefined} onClick={() => goTo(index)}
        className={`flex items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-left transition disabled:opacity-40 sm:justify-start sm:px-3 ${step === index ? "bg-primary text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${step === index ? "bg-white/25" : index < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100"}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span>
        <span className="min-w-0"><span className="block text-sm font-black">{label}</span><span className={`hidden truncate text-[11px] sm:block ${step === index ? "text-white/80" : "text-slate-400"}`}>{hint}</span></span>
      </button>)}
    </nav>

    {step === 0 && <section className="space-y-5">
      <Section number={1} title="Paper type" hint="Pick how the paper prints, then a starting pattern. Every number can be changed.">
        <div className="grid gap-3 sm:grid-cols-2">{LAYOUTS.map(([key, name, note]) => <button key={key} type="button" aria-pressed={config.layout.mode === key} onClick={() => chooseLayout(key)} className={`rounded-2xl border-2 p-4 text-left transition ${config.layout.mode === key ? "border-primary bg-primary-soft/40" : "border-slate-200 hover:border-primary/50"}`}>
          <span className="flex items-center gap-2 font-black text-slate-900">{key === "tear" && <Scissors className="h-4 w-4" />}{name}{config.layout.mode === key && <Check className="ml-auto h-4 w-4 text-primary" />}</span><span className="mt-1 block text-sm text-slate-500">{note}</span></button>)}</div>
        <p className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Starting pattern</p>
        <div className="flex flex-wrap gap-2">{TEMPLATES.map((t) => <button key={t.key} type="button" onClick={() => applyTemplate(t.key)} title={t.note} className="min-h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary">{t.title}</button>)}</div>
      </Section>

      <Section number={2} title="School and exam">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><SubjectPicker catalog={catalog} value={subjectId} onChange={chooseSubject} /></div>
          <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">School name</span><SchoolInput value={config.header.schoolName} onChange={(value) => setHeader({ schoolName: value })} schools={schools} /></div>
          <Field label="Name of exam"><input className={input} value={config.header.examName} onChange={(e) => setHeader({ examName: e.target.value })} placeholder="Assessment-II 2026" /></Field>
          <DatePicker label="Date" value={config.header.date} onChange={(value) => setHeader({ date: value })} placeholder="Choose the exam date" />
          {hasObjective && hasSubjective ? <>
            <DurationPicker label="Objective time (MCQs)" value={config.header.timeObjective} onChange={(value) => setHeader({ timeObjective: value })} placeholder="e.g. 20 mins" />
            <DurationPicker label="Subjective time (written)" value={config.header.timeSubjective} onChange={(value) => setHeader({ timeSubjective: value })} placeholder="e.g. 1 hour 10 mins" />
          </> : <DurationPicker label="Time allowed" value={config.header.timeAllowed} onChange={(value) => setHeader({ timeAllowed: value })} placeholder="e.g. 1 hour 20 mins" />}
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 p-3">
          {config.header.logoUrl ? <img src={config.header.logoUrl} alt="School logo" className="h-14 w-14 rounded-lg border border-slate-200 object-contain" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImagePlus className="h-6 w-6" /></span>}
          <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-800">School logo (optional)</p><p className="text-xs text-slate-500">PNG or JPG, up to 2 MB.</p></div>
          <input ref={logoInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="secondary" loading={busy === "logo"} onClick={() => logoInput.current?.click()}>{config.header.logoUrl ? "Change" : "Upload"}</Button>
          {config.header.logoUrl && <Button variant="ghost" onClick={() => setHeader({ logoUrl: "" })} aria-label="Remove logo"><X className="h-4 w-4" /></Button>}
        </div>
      </Section>

      <Section number={3} title="Questions and marks" aside={<Pill tone="violet">Total {total} marks</Pill>}>
        <div className="space-y-3">{config.sections.map((section) => <div key={section.id} className="rounded-2xl border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <input aria-label="Section name" className={`${input} max-w-40 font-black`} value={section.name} onChange={(e) => setSection(section.id, { name: e.target.value })} />
            <div className="w-44"><CustomSelect value={section.kind} allowClear={false} onChange={(kind) => { setSection(section.id, { kind, choice: kind === "mcq" ? false : section.choice, attempt: kind === "mcq" ? section.total : Math.min(section.attempt, section.total), marksEach: kind === "mcq" ? 1 : kind === "short" ? 2 : 5 }); setSelection((c) => ({ ...c, [section.id]: [] })); }} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} /></div>
            <Pill>{sectionMarks(section)} marks</Pill>
            <Button variant="danger" className="ml-auto" disabled={config.sections.length === 1} aria-label={`Remove ${section.name}`} onClick={() => { edit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== section.id) })); setSelection((c) => { const { [section.id]: gone, ...rest } = c; void gone; return rest; }); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
            <div><span className="mb-1 block text-xs font-bold text-slate-500">{section.kind === "mcq" ? "Number of MCQs" : "Questions given"}</span><Stepper label="questions" value={section.total} min={1} max={100} onChange={(value) => setSection(section.id, { total: value, attempt: section.kind === "mcq" ? value : Math.min(section.attempt, value) })} /></div>
            {section.kind !== "mcq" && <div><span className="mb-1 block text-xs font-bold text-slate-500">Student attempts</span><Stepper label="attempts" value={section.attempt} min={1} max={section.total} onChange={(value) => setSection(section.id, { attempt: value })} /></div>}
            <div><span className="mb-1 block text-xs font-bold text-slate-500">Marks each</span><Stepper label="marks" value={section.marksEach} min={0.5} max={100} step={0.5} onChange={(value) => setSection(section.id, { marksEach: value })} /></div>
            {section.kind !== "mcq" && <div className="pb-2.5"><Toggle checked={Boolean(section.choice)} onChange={(v) => { setSection(section.id, { choice: v }); setSelection((c) => ({ ...c, [section.id]: [] })); }} label="Internal choice (OR)" /></div>}
          </div>
          {section.kind !== "mcq" && section.choice && <div className="mt-3 max-w-sm"><span className="mb-1 block text-xs font-bold text-slate-500">Both OR questions come from</span><CustomSelect value={section.choiceRule || "different"} allowClear={false} onChange={(value) => { setSection(section.id, { choiceRule: value }); setSelection((c) => ({ ...c, [section.id]: [] })); }} options={CHOICE_RULES} /></div>}
          {section.kind !== "mcq" && section.attempt < section.total && <p className="mt-2 text-xs font-semibold text-slate-500">Printed as: "Answer any {section.attempt} of the following questions."</p>}
        </div>)}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button variant="secondary" icon={Plus} disabled={config.sections.length >= 8} onClick={() => edit((c) => { const next = c.sections.length + 1; return { ...c, sections: [...c.sections, { id: `S${Date.now() % 100000}`, kind: "short", name: `Section ${String.fromCharCode(64 + next)}`, total: 5, attempt: 5, marksEach: 2, choiceRule: "different" }] }; })}>Add section</Button>
          {!tear && hasObjective && hasSubjective && <Toggle checked={config.layout.subjectiveNewPage} onChange={(v) => setLayout({ subjectiveNewPage: v })} label="Start the subjective part on a new page" />}
        </div>
      </Section>

      <Section number={4} title="Chapters" hint="Tick the chapters to take questions from, then decide how many each one gives."
        aside={outline && <div className="flex gap-2"><Button variant="secondary" className="min-h-9" onClick={() => setChapters(usable.map((ch) => ({ chapter: ch._id, weight: 1, quota: {}, topics: [] })))}>All</Button><Button variant="ghost" className="min-h-9" onClick={() => setChapters([])}>None</Button></div>}>
        {!subjectId ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Choose a subject first.</p> : !outline ? <AdminLoader label="Loading chapters..." /> : !usable.length ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">This subject has no questions in the bank yet. You can still write your own questions.</p> :
          <div className="grid gap-2 sm:grid-cols-2">{usable.map((chapter) => <label key={chapter._id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${chosenIds.has(chapter._id) ? "border-primary/40 bg-primary-soft/30" : "border-slate-200 hover:border-slate-300"}`}>
            <input type="checkbox" checked={chosenIds.has(chapter._id)} onChange={() => toggleChapter(chapter._id)} className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--color-primary)]" />
            <span className="min-w-0"><span className="block text-sm font-black text-slate-900">Chapter {chapter.chapterNumber}: {chapter.name}</span><span className="text-xs text-slate-500">{chapter.counts.mcq} MCQs · {chapter.counts.short} short · {chapter.counts.long} long</span></span></label>)}</div>}
        {config.scope.chapters.length > 0 && outline && <>
          <p className="mt-3 text-sm text-slate-600">Available: <b>{available("mcq")}</b> MCQs, <b>{available("short")}</b> short, <b>{available("long")}</b> long questions.</p>
          <div className="mt-5 border-t border-slate-100 pt-5"><h3 className="mb-3 text-base font-black text-slate-900">Questions from each chapter</h3>
            <ChapterPlan sections={config.sections} chosen={config.scope.chapters} chapters={outline.chapters} onQuota={setQuota} onSpread={spread} onClear={() => setChapters(config.scope.chapters.map((item) => ({ ...item, quota: {} })))} /></div></>}
        {outline?.urduQuestions > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{outline.urduQuestions} Urdu questions are left out because Urdu printing is not available yet.</p>}
      </Section>

      <Section number={5} title="Look and watermark" hint="Choose the font, text size and spacing, and add a watermark if you like. Every page ends with “Prepared by IlmiDunya”.">
        <PaperStyle layout={config.layout} setLayout={setLayout} uploading={busy === "mark"} onUpload={(file, done) => uploadImage(file, done, "mark")} />
      </Section>

      <div className={card}>
        <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="flex w-full items-center justify-between text-left"><span className="text-lg font-black text-slate-900">More options</span><ChevronDown className={`h-5 w-5 text-slate-500 transition ${more ? "rotate-180" : ""}`} /></button>
        {more && <div className="mt-4 space-y-5 animate-in fade-in slide-in-from-top-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Paper size</span><CustomSelect value={config.layout.paper} allowClear={false} onChange={(value) => setLayout({ paper: value })} options={[{ value: "A4", label: "A4" }, { value: "Letter", label: "Letter" }]} /></div>
            {!tear && <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Fit to</span><CustomSelect value={String(config.layout.pages)} allowClear={false} onChange={(value) => setLayout({ pages: Number(value) })} options={[{ value: "0", label: "As many pages as needed" }, ...[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} page${n > 1 ? "s" : ""} at most` }))]} /></div>}
            {tear && <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Cut line</span><CustomSelect value={config.layout.cutLine} allowClear={false} onChange={(value) => setLayout({ cutLine: value })} options={[{ value: "back", label: "Back side only" }, { value: "both", label: "Both sides" }, { value: "none", label: "None" }]} /></div>}
            <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Question difficulty</span><CustomSelect value={config.options.difficulty || "mixed"} allowClear={false} onChange={(value) => edit((c) => ({ ...c, options: { ...c.options, difficulty: value } }))} options={[{ value: "mixed", label: "Mixed" }, { value: "easy", label: "Easier questions first" }, { value: "hard", label: "Harder questions first" }]} /></div>
            <Field label="Subject title on paper"><input className={input} value={config.header.subjectTitle} onChange={(e) => setHeader({ subjectTitle: e.target.value })} /></Field>
            <Field label="Class on paper"><input className={input} value={config.header.className} onChange={(e) => setHeader({ className: e.target.value })} /></Field>
            <Field label="Name in my list" className="sm:col-span-3"><input className={input} value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="Class 9 Physics mid term" /></Field>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={config.layout.bubbles} onChange={(v) => setLayout({ bubbles: v })} label="Bubble column for MCQs" /><Toggle checked={config.options.importantFirst} onChange={(v) => edit((c) => ({ ...c, options: { ...c.options, importantFirst: v } }))} label="Prefer important questions" /><Toggle checked={config.options.avoidRepeats} onChange={(v) => edit((c) => ({ ...c, options: { ...c.options, avoidRepeats: v } }))} label="Avoid questions from my last 10 papers" /></div>
          {!tear && <div><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Paper versions</p>
            <div className="flex flex-wrap items-center gap-2">{["A", "B", "C", "D"].map((letter) => <button key={letter} type="button" aria-pressed={config.versions.includes(letter)} disabled={letter === "A"} onClick={() => edit((c) => ({ ...c, versions: c.versions.includes(letter) ? c.versions.filter((v) => v !== letter) : [...c.versions, letter].sort() }))} className={`h-11 w-11 rounded-xl border text-base font-black transition ${config.versions.includes(letter) ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-500 hover:border-primary"}`}>{letter}</button>)}<span className="text-xs text-slate-500">Extra versions shuffle questions and options. Each gets its own answer key.</span></div></div>}
          <Field label="Instructions for students (one per line, optional)"><textarea className={`${input} min-h-20 py-2`} value={config.header.instructions.join("\n")} onChange={(e) => setHeader({ instructions: e.target.value.split("\n") })} /></Field>
        </div>}
      </div>
    </section>}

    {step === 1 && <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <Button icon={Sparkles} loading={busy === "generate"} onClick={() => generate(false)}>{slotsFilled ? "Pick all again" : "Pick questions"}</Button>
        <Button variant="secondary" icon={Shuffle} loading={busy === "generate"} disabled={!Object.keys(selection).length} onClick={() => generate(true, selection)}>Fill missing only</Button>
        <p className="text-xs text-slate-500">Swap a question with the arrow, move it up or down, remove it, add one from the bank, or write your own.</p>
      </div>
      {warnings.map((w) => <AdminAlert key={w.message} type="error">{w.message}</AdminAlert>)}
      {busy === "generate" && !Object.keys(selection).length && <AdminLoader label="Picking questions..." />}
      {config.sections.map((section) => { const slots = selection[section.id] || []; const have = questionsInSlots(slots); const needs = section.kind === "mcq" ? section.total : section.total * (section.choice ? 2 : 1);
        return <div key={section.id} className={card}>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-slate-900">{section.name} · {KIND_LABEL[section.kind]}</h3><Pill tone={have === needs ? "green" : "amber"}>{have} / {needs}{have > needs ? " (extra)" : ""}</Pill><Pill tone="violet">{sectionMarks(section)} marks</Pill>
            <div className="ml-auto flex flex-wrap gap-2"><Button variant="ghost" className="min-h-10" icon={RefreshCw} loading={busy === `repick-${section.id}`} onClick={() => repick(section.id)}>Re-pick</Button><Button variant="secondary" icon={PenLine} className="min-h-10" onClick={() => setWriter({ section })}>Add my own</Button><Button variant="secondary" icon={Plus} className="min-h-10" onClick={() => setPicker({ sectionId: section.id })}>Add from bank</Button></div></div>
          {!slots.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No questions yet.</p>}
          <ol className="mt-3 space-y-3">{slots.map((slot, slotIndex) => <li key={slotIndex} className="rounded-2xl border border-slate-200 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 min-w-7 place-items-center rounded-lg bg-slate-900 text-xs font-black text-white">{slotIndex + 1}</span>
              <div className="min-w-0 flex-1 space-y-2.5">
                {slot.scenario && <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-700"><p className="min-w-0 flex-1"><b>Scenario:</b> {bank.scenarios[slot.scenario]?.scenarioText?.slice(0, 180) || "Scenario"}… <Pill>{slot.questions.length} linked questions</Pill></p>
                  <ActionButton icon={Trash2} tone="danger" label="Remove scenario" onClick={() => removeQuestion(section.id, slotIndex, 0)} /></div>}
                {slot.questions.map((qid, qIndex) => { const q = bank.questions[qid]; const either = section.choice && !slot.scenario; return <Fragment key={qid}>
                  {qIndex > 0 && <div className="flex items-center gap-3 text-xs font-black text-slate-400"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div>}
                  <div className={either ? "rounded-xl border border-slate-100 bg-slate-50/60 p-2.5" : ""}>
                    {either && <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">{qIndex === 0 ? "Question (a)" : "OR question (b)"}</p>}
                    <p className="text-sm font-semibold text-slate-800">{q ? q.questionText : "Question unavailable"}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">{q?.isCustom && <Pill tone="violet">Your question</Pill>}{repeated.has(qid) && <Pill tone="amber">Repeated in paper</Pill>}{q?.chapter && outline && <span className="text-slate-400">{chapterName(q.chapter)}</span>}</p>
                    {q?.contentType === "mcq" && <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">{q.options.map((o) => <span key={o.key} className={`rounded-md px-2 py-0.5 ${o.key === q.correctOption ? "bg-emerald-50 font-black text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{o.key}. {o.text}</span>)}</p>}
                    {!slot.scenario && <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {!q?.isCustom && <ActionButton icon={RefreshCw} label="Swap" spinning={busy === `swap-${section.id}-${slotIndex}-${qIndex}`} disabled={Boolean(busy)} onClick={() => swap(section.id, slotIndex, qIndex)} />}
                      <ActionButton icon={Library} label="From bank" onClick={() => setPicker({ sectionId: section.id, slotIndex, qIndex })} />
                      <ActionButton icon={PenLine} label={q?.isCustom ? "Edit" : "Write my own"} onClick={() => setWriter(q?.isCustom ? { section, existing: q } : { section, slotIndex, qIndex })} />
                      <ActionButton icon={Trash2} tone="danger" label="Delete" onClick={() => removeQuestion(section.id, slotIndex, qIndex)} />
                    </div>}
                  </div>
                </Fragment>; })}
                {section.choice && !slot.scenario && slot.questions.length < 2 && <>
                  <div className="flex items-center gap-3 text-xs font-black text-slate-400"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div>
                  <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-3"><p className="text-sm font-bold text-amber-800">The OR question is missing.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5"><ActionButton icon={Wand2} label="Pick for me" spinning={busy === `fill-${section.id}-${slotIndex}`} disabled={Boolean(busy)} onClick={() => fillSide(section.id, slotIndex)} /><ActionButton icon={Library} label="From bank" onClick={() => setPicker({ sectionId: section.id, slotIndex })} /><ActionButton icon={PenLine} label="Write my own" onClick={() => setWriter({ section, slotIndex })} /></div></div>
                </>}
              </div>
              <div className="flex shrink-0 flex-col">
                <button type="button" disabled={slotIndex === 0} onClick={() => moveSlot(section.id, slotIndex, slotIndex - 1)} aria-label="Move up" title="Move up" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={slotIndex === slots.length - 1} onClick={() => moveSlot(section.id, slotIndex, slotIndex + 1)} aria-label="Move down" title="Move down" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
              </div>
            </div>
          </li>)}</ol>
        </div>; })}
      {coverage.length > 0 && <div className={card}>
        <h3 className="text-base font-black text-slate-900">What this paper covers</h3><p className="mb-3 text-sm text-slate-500">Questions and approximate marks taken from each chapter.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Chapter</th><th className="px-2 text-center">MCQs</th><th className="px-2 text-center">Short</th><th className="px-2 text-center">Long</th><th className="pl-2 text-right">Marks</th></tr></thead>
          <tbody>{coverage.map((row) => <tr key={row.chapterId || "none"} className="border-b border-slate-100 last:border-0"><td className="py-2 pr-3 font-semibold text-slate-800">{row.chapterId ? chapterName(row.chapterId) : "Your own questions"}</td><td className="px-2 text-center">{row.mcq || "-"}</td><td className="px-2 text-center">{row.short || "-"}</td><td className="px-2 text-center">{row.long || "-"}</td><td className="pl-2 text-right font-black">{row.marks}</td></tr>)}</tbody></table></div>
      </div>}
    </section>}

    {step === 2 && <section className="space-y-4">
      <div className={`${card} space-y-4`}>
        {fit && <p role="status" className={`rounded-xl px-4 py-3 text-sm font-bold ${fit.fits ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {fit.mode === "tear" ? (fit.fits ? "Fits half a sheet on both sides. Print double-sided (flip on long edge), then tear in the middle." : "Too long for half a sheet. Remove a question or two, or switch to a single paper.")
            : fit.fits ? `Fits on ${fit.pages} page${fit.pages > 1 ? "s" : ""}${fit.scale < 1 ? " (text slightly reduced to fit)" : ""}.` : `Needs ${fit.pages} pages. Remove some questions or allow more pages in More options.`}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {!tear && (papers || []).length > 1 && (papers || []).map((p) => <button key={p.version} type="button" aria-pressed={version === p.version} onClick={() => setVersion(p.version)} className={`h-11 min-w-11 rounded-xl border px-3 text-sm font-black ${version === p.version ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary"}`}>Version {p.version}</button>)}
          <div className="ml-auto"><Toggle checked={showAnswers} onChange={setShowAnswers} label="Show answers in preview" /></div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button icon={FileDown} loading={busy === "export-pdf-0"} disabled={tear && fit && !fit.fits} onClick={() => exportFile("pdf", false)}>Paper PDF</Button>
          <Button variant="secondary" icon={FileText} loading={busy === "export-docx-0"} disabled={tear && fit && !fit.fits} onClick={() => exportFile("docx", false)}>Paper Word</Button>
          <Button variant="secondary" icon={KeyRound} loading={busy === "export-pdf-1"} onClick={() => exportFile("pdf", true)}>Answer key PDF</Button>
          <Button variant="secondary" icon={KeyRound} loading={busy === "export-docx-1"} onClick={() => exportFile("docx", true)}>Answer key Word</Button>
        </div>
        <p className="text-xs text-slate-500">The PDF is exact and ready to print. Word can be edited. The answer key is for teachers only. Downloads save the paper first.</p>
      </div>
      {busy === "preview" || !papers ? <AdminLoader label="Building the preview..." /> : <div className="overflow-x-auto pb-2"><PaperPreview papers={papers} version={version} showAnswers={showAnswers} logoUrl={config.header.logoUrl} /></div>}
    </section>}

    <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <Button variant="secondary" icon={ArrowLeft} onClick={() => (step === 0 ? navigate("/admin/papers") : goTo(step - 1))}>{step === 0 ? "My papers" : "Back"}</Button>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs font-bold text-slate-400 sm:inline" aria-live="polite">{autoState === "saving" ? "Saving…" : dirty ? "Unsaved changes" : autoState === "saved" ? "Saved automatically" : autoState === "failed" ? "Auto-save failed" : paperId ? "Saved" : ""}</span>
        <Button variant="secondary" icon={Save} loading={busy === "save"} onClick={() => save(false)} disabled={!readyForQuestions}>Save</Button>
        {step < 2 && <Button disabled={!readyForQuestions || (step === 1 && !Object.keys(selection).length)} onClick={() => goTo(step + 1)}>Next<ArrowRight className="h-4 w-4" /></Button>}
      </div>
    </div>

    {picker && <QuestionPicker replace={picker.qIndex !== undefined} config={config} outline={outline} section={config.sections.find((s) => s.id === picker.sectionId)} used={new Set(usedIds())} onClose={() => setPicker(null)} onAdd={(picked, scenarioId) => { addToSection(picker, picked, scenarioId); if (picker.slotIndex !== undefined) setPicker(null); }} />}
    {writer && <CustomQuestionModal section={writer.section} chapters={outline?.chapters || []} existing={writer.existing} onClose={() => setWriter(null)} onSave={saveCustom} />}
  </div>;
}
