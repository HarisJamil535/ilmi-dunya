import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, FileDown, FileText, ImagePlus, KeyRound, Loader2, Plus, RefreshCw, Save, Search, Shuffle, Sparkles, Trash2, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";
import PaperPreview from "./PaperPreview";
import { KIND_LABEL, TEMPLATES, newConfig, questionsInSlots, sectionMarks, sectionsFromTemplate, totalMarks } from "./paperDefaults";
import "./paper-maker.css";

const STEPS = [["Details", "School, exam and instructions"], ["Pattern", "Sections, marks and choice"], ["Content", "Chapters and topics"], ["Questions", "Pick and review"], ["Preview", "Versions and downloads"]];
const input = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6";
const Field = ({ label, hint, children, className = "" }) => <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}</label>;
const Toggle = ({ checked, onChange, label }) => <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-slate-700"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 rounded accent-[var(--color-primary)]" />{label}</label>;
const Pill = ({ children, tone = "slate" }) => <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${{ slate: "bg-slate-100 text-slate-600", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", violet: "bg-primary-soft text-primary-dark" }[tone]}`}>{children}</span>;
const Button = ({ children, icon: Icon, variant = "primary", loading, className = "", ...props }) => <button type="button" {...props} disabled={props.disabled || loading} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${{ primary: "bg-primary text-white shadow-sm hover:brightness-110", secondary: "border border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary", ghost: "text-slate-600 hover:bg-slate-100", danger: "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50" }[variant]} ${className}`}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}{children}</button>;

const blobMessage = async (error, fallback) => { try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { return error.response?.data?.message || fallback; } };
const download = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); };

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
  const [seed, setSeed] = useState("");
  const [paperId, setPaperId] = useState(id || "");
  const [bank, setBank] = useState({ questions: {}, scenarios: {} });
  const [warnings, setWarnings] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState(null);
  const [papers, setPapers] = useState(null);
  const [version, setVersion] = useState("A");
  const [showAnswers, setShowAnswers] = useState(false);
  const logoInput = useRef(null);

  const remember = useCallback((questions = [], scenarios = []) => setBank((current) => ({ questions: { ...current.questions, ...Object.fromEntries(questions.map((q) => [q._id, q])) }, scenarios: { ...current.scenarios, ...Object.fromEntries(scenarios.map((s) => [s._id, s])) } })), []);
  const edit = (fn) => { setConfig(fn); setDirty(true); setPapers(null); };
  const setHeader = (patch) => edit((c) => ({ ...c, header: { ...c.header, ...patch } }));
  const setSection = (sectionId, patch) => edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) }));

  useEffect(() => {
    Promise.all([axiosInstance.get("/papers/catalog"), axiosInstance.get("/papers/schools")])
      .then(([cat, sch]) => { setCatalog(cat.data); setSchools(sch.data.schools || []); })
      .catch((err) => setNotice({ type: "error", text: err.response?.data?.message || "Could not load the paper tools." }));
  }, []);

  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`/papers/${id}`).then(({ data }) => {
      setTitle(data.paper.title); setConfig(data.paper.config); setSelection(data.paper.selection || {}); setSeed(data.paper.seed); setPaperId(data.paper._id);
      remember(data.questions, data.scenarios); setStep(3);
    }).catch((err) => setNotice({ type: "error", text: err.response?.data?.message || "Paper not found." })).finally(() => setLoading(false));
  }, [id, remember]);

  const subjectId = config.scope.subject;
  useEffect(() => {
    if (!subjectId) { setOutline(null); return undefined; }
    let live = true;
    axiosInstance.get(`/papers/subjects/${subjectId}/outline`).then(({ data }) => live && setOutline(data)).catch(() => live && setOutline(null));
    return () => { live = false; };
  }, [subjectId]);

  const subjects = useMemo(() => (catalog?.subjects || []).filter((s) => (!config.scope.board || s.board === config.scope.board) && (!config.scope.class || s.class === config.scope.class)), [catalog, config.scope.board, config.scope.class]);
  const nameOf = (list, value) => (list || []).find((item) => item._id === value)?.name || "";
  const chooseSubject = (value) => {
    const subject = (catalog?.subjects || []).find((s) => s._id === value);
    if (!subject) return;
    edit((c) => ({ ...c, scope: { board: subject.board, class: subject.class, group: subject.group || "", subject: subject._id, chapters: [] }, header: { ...c.header, subjectTitle: nameOf(catalog.subjects, value).toUpperCase(), className: nameOf(catalog.classes, subject.class) } }));
    setSelection({});
  };
  const total = totalMarks(config.sections);

  // ---- Step 3: chapters and topics.
  const chosen = new Map(config.scope.chapters.map((item) => [item.chapter, item]));
  const toggleChapter = (chapter) => edit((c) => ({ ...c, scope: { ...c.scope, chapters: chosen.has(chapter._id) ? c.scope.chapters.filter((item) => item.chapter !== chapter._id) : [...c.scope.chapters, { chapter: chapter._id, weight: 1, topics: [] }] } }));
  const setChapter = (chapterId, patch) => edit((c) => ({ ...c, scope: { ...c.scope, chapters: c.scope.chapters.map((item) => (item.chapter === chapterId ? { ...item, ...patch } : item)) } }));
  const toggleTopic = (chapterId, topicId, allTopics) => { const item = chosen.get(chapterId); const current = item.topics.length ? item.topics : allTopics; const next = current.includes(topicId) ? current.filter((t) => t !== topicId) : [...current, topicId]; setChapter(chapterId, { topics: next.length === allTopics.length ? [] : next }); };
  const available = (kind) => config.scope.chapters.reduce((sum, item) => sum + (outline?.chapters.find((c) => c._id === item.chapter)?.counts[kind] || 0), 0);

  // ---- Step 4: questions.
  const usedIds = () => Object.values(selection).flat().flatMap((slot) => slot.questions);
  const generate = async (keepCurrent) => {
    setBusy("generate"); setNotice(null);
    try {
      const { data } = await axiosInstance.post("/papers/generate", { config, seed: seed || undefined, paperId: paperId || undefined, keep: keepCurrent ? selection : {} });
      setSelection(data.selection); setSeed(data.seed); setWarnings(data.warnings || []); remember(data.questions, data.scenarios); setDirty(true); setPapers(null);
      if (!data.warnings?.length) setNotice({ type: "success", text: keepCurrent ? "The remaining questions were filled in." : "Questions picked. Swap or remove any you do not like." });
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not pick questions." }); } finally { setBusy(""); }
  };
  const swap = async (sectionId, slotIndex, qIndex) => {
    const slot = selection[sectionId][slotIndex];
    setBusy(`swap-${sectionId}-${slotIndex}-${qIndex}`);
    try {
      const old = bank.questions[slot.questions[qIndex]];
      const { data } = await axiosInstance.post("/papers/suggest", { config, sectionId, exclude: usedIds(), chapter: old?.chapter });
      remember([data.question]);
      setSelection((current) => ({ ...current, [sectionId]: current[sectionId].map((s, i) => (i === slotIndex ? { ...s, questions: s.questions.map((q, j) => (j === qIndex ? data.question._id : q)) } : s)) })); setDirty(true); setPapers(null);
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "No other question is available." }); } finally { setBusy(""); }
  };
  const removeSlot = (sectionId, slotIndex) => { setSelection((current) => ({ ...current, [sectionId]: current[sectionId].filter((_, i) => i !== slotIndex) })); setDirty(true); setPapers(null); };
  const addToSection = ({ sectionId, slotIndex }, picked, scenarioId) => {
    setSelection((current) => {
      const slots = [...(current[sectionId] || [])];
      if (slotIndex !== undefined && slotIndex !== null) slots[slotIndex] = { ...slots[slotIndex], questions: [...slots[slotIndex].questions, ...picked.map((q) => q._id)] };
      else if (scenarioId) slots.push({ scenario: scenarioId, questions: picked.map((q) => q._id) });
      else picked.forEach((q) => slots.push({ scenario: "", questions: [q._id] }));
      return { ...current, [sectionId]: slots };
    });
    remember(picked); setDirty(true); setPapers(null);
  };

  // ---- Saving, preview, downloads.
  const save = async (quiet) => {
    setBusy("save");
    try {
      const body = { title: title.trim() || [config.header.subjectTitle, config.header.examName].filter(Boolean).join(" - "), config, selection, seed };
      let savedId = paperId;
      if (paperId) { const { data } = await axiosInstance.put(`/papers/${paperId}`, body); setSeed(data.paper.seed); }
      else { const { data } = await axiosInstance.post("/papers", body); savedId = data.paper._id; setPaperId(savedId); setSeed(data.paper.seed); navigate(`/admin/papers/${savedId}`, { replace: true }); }
      setDirty(false);
      if (!quiet) setNotice({ type: "success", text: "Paper saved." });
      return savedId;
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not save the paper." }); return null; } finally { setBusy(""); }
  };
  const loadPreview = useCallback(async () => {
    setBusy("preview");
    try {
      const { data } = await axiosInstance.post("/papers/preview", { config, selection, seed });
      setPapers(data.papers); setVersion((current) => (data.papers.some((p) => p.version === current) ? current : data.papers[0].version));
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not build the preview." }); } finally { setBusy(""); }
  }, [config, selection, seed]);
  useEffect(() => { if (step === 4 && !papers && Object.keys(selection).length) loadPreview(); }, [step, papers, selection, loadPreview]);

  const exportFile = async (format, key) => {
    setBusy(`export-${format}-${key}`);
    try {
      const savedId = dirty || !paperId ? await save(true) : paperId;
      if (!savedId) return;
      const response = await axiosInstance.get(`/papers/${savedId}/export`, { params: { format, key: key ? 1 : 0, version }, responseType: "blob", timeout: 120000 });
      download(response.data, /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || `paper.${format}`);
    } catch (err) { setNotice({ type: "error", text: await blobMessage(err, "The file could not be created. Please try again.") }); } finally { setBusy(""); }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    const form = new FormData(); form.append("logo", file);
    setBusy("logo");
    try { const { data } = await axiosInstance.post("/papers/logo", form); setHeader({ logoUrl: data.logoUrl }); } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "The logo could not be uploaded." }); } finally { setBusy(""); }
  };

  const canGo = (index) => index <= 1 || Boolean(subjectId && config.sections.length) && (index <= 2 || config.scope.chapters.length > 0) && (index <= 3 || true);
  const slotsFilled = config.sections.every((s) => questionsInSlots(selection[s.id]) > 0);
  const lastStepOk = step === 0 ? Boolean(subjectId) : step === 2 ? config.scope.chapters.length > 0 : true;

  if (loading || !catalog) return notice?.type === "error" ? <AdminAlert type="error">{notice.text}</AdminAlert> : <AdminLoader label="Loading Paper Maker..." />;
  const current = papers?.find((p) => p.version === version);

  return <div className="mx-auto max-w-6xl space-y-5">
    <AdminPageHeader icon={FileText} eyebrow="Paper Maker" title={title || "New question paper"} description="Build a question paper in a few steps, preview every version, then download a print-ready PDF or an editable Word file with the answer key." />
    {notice && <AdminAlert type={notice.type}>{notice.text}</AdminAlert>}

    <nav aria-label="Steps" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {STEPS.map(([label, hint], index) => <button key={label} type="button" disabled={!canGo(index)} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}
        className={`flex min-w-[8.5rem] flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:opacity-40 ${step === index ? "bg-primary text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${step === index ? "bg-white/25" : index < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100"}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span>
        <span className="min-w-0"><span className="block text-sm font-black">{label}</span><span className={`hidden truncate text-[11px] sm:block ${step === index ? "text-white/80" : "text-slate-400"}`}>{hint}</span></span>
      </button>)}
    </nav>

    {step === 0 && <section className="grid gap-5 lg:grid-cols-2">
      <div className={card}>
        <h2 className="mb-4 text-lg font-black text-slate-900">School and exam</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School name" className="sm:col-span-2"><input className={input} list="paper-schools" value={config.header.schoolName} onChange={(e) => setHeader({ schoolName: e.target.value })} placeholder="Choose or type your school" /><datalist id="paper-schools">{schools.map((s) => <option key={s._id} value={s.name} />)}</datalist></Field>
          <Field label="Name of exam"><input className={input} value={config.header.examName} onChange={(e) => setHeader({ examName: e.target.value })} placeholder="First Term Examination 2026" /></Field>
          <Field label="Paper title (your own list)"><input className={input} value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="Class 9 Physics - Mid Term" /></Field>
          <Field label="Time allowed"><input className={input} value={config.header.timeAllowed} onChange={(e) => setHeader({ timeAllowed: e.target.value })} placeholder="1:20 Hours" /></Field>
          <Field label="Date"><input className={input} value={config.header.date} onChange={(e) => setHeader({ date: e.target.value })} placeholder="12 Nov 2026" /></Field>
          <Field label="Paper code"><input className={input} value={config.header.paperCode} onChange={(e) => setHeader({ paperCode: e.target.value })} placeholder="CS-09-2026" /></Field>
          <Field label="Scheme note"><input className={input} value={config.header.schemeNote} onChange={(e) => setHeader({ schemeNote: e.target.value })} placeholder="(50% MCQs & 50% Descriptive)" /></Field>
        </div>
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 p-4">
          {config.header.logoUrl ? <img src={config.header.logoUrl} alt="School logo" className="h-16 w-16 rounded-xl border border-slate-200 object-contain" /> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 text-slate-400"><ImagePlus className="h-6 w-6" /></span>}
          <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-800">School or board logo</p><p className="text-xs text-slate-500">PNG or JPG, up to 2 MB. Printed at the top left.</p></div>
          <input ref={logoInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="secondary" loading={busy === "logo"} onClick={() => logoInput.current?.click()}>{config.header.logoUrl ? "Change" : "Upload"}</Button>
          {config.header.logoUrl && <Button variant="ghost" onClick={() => setHeader({ logoUrl: "" })} aria-label="Remove logo"><X className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div className="space-y-5">
        <div className={card}>
          <h2 className="mb-4 text-lg font-black text-slate-900">Class and subject</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Board"><select className={input} value={config.scope.board} onChange={(e) => edit((c) => ({ ...c, scope: { ...c.scope, board: e.target.value, subject: "", chapters: [] } }))}><option value="">All boards</option>{catalog.boards.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>
            <Field label="Class"><select className={input} value={config.scope.class} onChange={(e) => edit((c) => ({ ...c, scope: { ...c.scope, class: e.target.value, subject: "", chapters: [] } }))}><option value="">All classes</option>{catalog.classes.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></Field>
            <Field label="Subject" className="sm:col-span-2"><select className={input} value={subjectId} onChange={(e) => chooseSubject(e.target.value)}><option value="">Choose a subject</option>{subjects.map((s) => <option key={s._id} value={s._id}>{s.name}{!config.scope.class ? ` (${nameOf(catalog.classes, s.class)})` : ""}</option>)}</select></Field>
            <Field label="Subject title on the paper"><input className={input} value={config.header.subjectTitle} onChange={(e) => setHeader({ subjectTitle: e.target.value })} /></Field>
            <Field label="Class on the paper"><input className={input} value={config.header.className} onChange={(e) => setHeader({ className: e.target.value })} /></Field>
          </div>
          {outline?.urduQuestions > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{outline.urduQuestions} Urdu questions in this subject are left out for now, because Urdu printing is not available yet.</p>}
        </div>
        <div className={card}>
          <h2 className="mb-3 text-lg font-black text-slate-900">Instructions and layout</h2>
          <Field label="Instructions (one per line)"><textarea className={`${input} min-h-28 py-2`} value={config.header.instructions.join("\n")} onChange={(e) => setHeader({ instructions: e.target.value.split("\n") })} /></Field>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3"><Toggle checked={config.header.showRollBoxes} onChange={(v) => setHeader({ showRollBoxes: v })} label="Roll number boxes" /><Toggle checked={config.header.showSignatures} onChange={(v) => setHeader({ showSignatures: v })} label="Candidate / invigilator signatures" /></div>
          <div className="mt-4"><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Paper versions</p>
            <div className="flex flex-wrap items-center gap-2">{["A", "B", "C", "D"].map((letter) => <button key={letter} type="button" aria-pressed={config.versions.includes(letter)} disabled={letter === "A"} onClick={() => edit((c) => ({ ...c, versions: c.versions.includes(letter) ? c.versions.filter((v) => v !== letter) : [...c.versions, letter].sort() }))} className={`h-11 w-11 rounded-xl border text-base font-black transition ${config.versions.includes(letter) ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-500 hover:border-primary"}`}>{letter}</button>)}<span className="text-xs text-slate-500">Extra versions shuffle MCQs and options. Each gets its own answer key.</span></div></div>
        </div>
      </div>
    </section>}

    {step === 1 && <section className="space-y-5">
      <div className={card}>
        <h2 className="text-lg font-black text-slate-900">Start from a ready pattern</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{TEMPLATES.map((t) => <button key={t.key} type="button" onClick={() => { edit((c) => ({ ...c, sections: sectionsFromTemplate(t.key) })); setSelection({}); }} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"><p className="font-black text-slate-900">{t.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{t.note}</p></button>)}</div>
      </div>
      <div className="space-y-4">{config.sections.map((section, index) => <div key={section.id} className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-sm font-black text-primary-dark">{index + 1}</span>
          <input aria-label="Section name" className={`${input} max-w-48 font-black`} value={section.name} onChange={(e) => setSection(section.id, { name: e.target.value })} />
          <select aria-label="Section type" className={`${input} max-w-44`} value={section.kind} onChange={(e) => { const kind = e.target.value; setSection(section.id, { kind, choice: kind === "mcq" ? false : section.choice, attempt: kind === "mcq" ? section.total : section.attempt, heading: { mcq: "Multiple Choice Questions", short: "Short Questions", long: "Long Questions" }[kind] }); setSelection((c) => ({ ...c, [section.id]: [] })); }}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <Pill tone="violet">{sectionMarks(section)} marks</Pill>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" disabled={index === 0} aria-label="Move up" onClick={() => edit((c) => { const s = [...c.sections]; [s[index - 1], s[index]] = [s[index], s[index - 1]]; return { ...c, sections: s }; })}><ChevronUp className="h-4 w-4" /></Button>
            <Button variant="ghost" disabled={index === config.sections.length - 1} aria-label="Move down" onClick={() => edit((c) => { const s = [...c.sections]; [s[index + 1], s[index]] = [s[index], s[index + 1]]; return { ...c, sections: s }; })}><ChevronDown className="h-4 w-4" /></Button>
            <Button variant="danger" disabled={config.sections.length === 1} aria-label="Remove section" onClick={() => { edit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== section.id) })); setSelection((c) => { const { [section.id]: gone, ...rest } = c; void gone; return rest; }); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Heading"><input className={input} value={section.heading} onChange={(e) => setSection(section.id, { heading: e.target.value })} /></Field>
          <Field label={section.kind === "mcq" ? "Number of MCQs" : "Questions given"}><input className={input} type="number" min="1" max="100" value={section.total} onChange={(e) => { const total = Math.max(1, Number(e.target.value) || 1); setSection(section.id, { total, attempt: section.kind === "mcq" ? total : Math.min(section.attempt, total) }); }} /></Field>
          {section.kind !== "mcq" && <Field label="Student attempts" hint={section.attempt < section.total ? `"Attempt any ${section.attempt} of ${section.total}"` : "All questions"}><input className={input} type="number" min="1" max={section.total} value={section.attempt} onChange={(e) => setSection(section.id, { attempt: Math.min(section.total, Math.max(1, Number(e.target.value) || 1)) })} /></Field>}
          <Field label="Marks per question"><input className={input} type="number" min="0.5" step="0.5" value={section.marksEach} onChange={(e) => setSection(section.id, { marksEach: Math.max(0.5, Number(e.target.value) || 0.5) })} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          {section.kind !== "mcq" && <Toggle checked={Boolean(section.choice)} onChange={(v) => { setSection(section.id, { choice: v }); setSelection((c) => ({ ...c, [section.id]: [] })); }} label="Internal choice (each question has an OR)" />}
          <Field label="Section instructions (optional)" className="min-w-64 flex-1"><input className={input} value={section.instructions || ""} onChange={(e) => setSection(section.id, { instructions: e.target.value })} placeholder="e.g. Answer on the separate answer sheet" /></Field>
        </div>
      </div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft p-4">
        <Button variant="secondary" icon={Plus} disabled={config.sections.length >= 8} onClick={() => edit((c) => { const next = c.sections.length + 1; return { ...c, sections: [...c.sections, { id: `S${Date.now() % 100000}`, kind: "short", name: `Section ${String.fromCharCode(64 + next)}`, heading: "Short Questions", total: 5, attempt: 5, marksEach: 2 }] }; })}>Add section</Button>
        <p className="text-sm font-black text-primary-dark">Total marks: {total}</p>
      </div>
    </section>}

    {step === 2 && <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-900">Choose the chapters</h2><p className="text-sm text-slate-500">Questions are picked from the chosen chapters. A higher weight gives a chapter more questions.</p></div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => edit((c) => ({ ...c, scope: { ...c.scope, chapters: outline.chapters.filter((ch) => ch.counts.mcq + ch.counts.short + ch.counts.long > 0).map((ch) => ({ chapter: ch._id, weight: 1, topics: [] })) } }))}>Select all</Button><Button variant="ghost" onClick={() => edit((c) => ({ ...c, scope: { ...c.scope, chapters: [] } }))}>Clear</Button></div>
      </div>
      {!outline ? <AdminLoader label="Loading chapters..." /> : <div className="mt-4 space-y-3">{outline.chapters.map((chapter) => {
        const item = chosen.get(chapter._id); const empty = chapter.counts.mcq + chapter.counts.short + chapter.counts.long === 0;
        const topicIds = chapter.topics.map((t) => t._id);
        return <div key={chapter._id} className={`rounded-2xl border p-4 transition ${item ? "border-primary/40 bg-primary-soft/30" : "border-slate-200"} ${empty ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-center gap-3">
            <input type="checkbox" aria-label={`Use chapter ${chapter.chapterNumber}`} disabled={empty} checked={Boolean(item)} onChange={() => toggleChapter(chapter)} className="h-5 w-5 rounded accent-[var(--color-primary)]" />
            <div className="min-w-0 flex-1"><p className="font-black text-slate-900">Chapter {chapter.chapterNumber}: {chapter.name}</p><div className="mt-1 flex flex-wrap gap-1.5"><Pill>{chapter.counts.mcq} MCQs</Pill><Pill>{chapter.counts.short} short</Pill><Pill>{chapter.counts.long} long</Pill></div></div>
            {item && <label className="flex items-center gap-2 text-xs font-bold text-slate-500">Weight<select className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-black" value={item.weight} onChange={(e) => setChapter(chapter._id, { weight: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}x</option>)}</select></label>}
          </div>
          {item && chapter.topics.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-bold text-primary">Topics: {item.topics.length ? `${item.topics.length} of ${chapter.topics.length} chosen` : "all topics"}</summary>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{chapter.topics.map((topic) => { const on = !item.topics.length || item.topics.includes(topic._id); return <label key={topic._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white"><input type="checkbox" checked={on} onChange={() => toggleTopic(chapter._id, topic._id, topicIds)} className="h-4 w-4 accent-[var(--color-primary)]" /><span className="min-w-0 flex-1 truncate">{topic.topicNumber} {topic.name}</span><span className="text-xs text-slate-400">{topic.counts.mcq}/{topic.counts.short}/{topic.counts.long}</span></label>; })}</div></details>}
        </div>;
      })}</div>}
      {config.scope.chapters.length > 0 && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Available in your choice: <b>{available("mcq")}</b> MCQs, <b>{available("short")}</b> short and <b>{available("long")}</b> long questions.</p>}
    </section>}

    {step === 3 && <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <Button icon={Sparkles} loading={busy === "generate"} onClick={() => generate(false)}>{slotsFilled ? "Pick all again" : "Pick questions automatically"}</Button>
        <Button variant="secondary" icon={Shuffle} disabled={!slotsFilled && !Object.keys(selection).length} loading={busy === "generate"} onClick={() => generate(true)}>Fill missing only</Button>
        <div className="ml-auto flex flex-wrap gap-x-5 gap-y-2"><Toggle checked={config.options.importantFirst} onChange={(v) => edit((c) => ({ ...c, options: { ...c.options, importantFirst: v } }))} label="Important questions first" /><Toggle checked={config.options.avoidRepeats} onChange={(v) => edit((c) => ({ ...c, options: { ...c.options, avoidRepeats: v } }))} label="Avoid questions from my last 10 papers" /></div>
      </div>
      {warnings.map((w) => <AdminAlert key={w.message} type="error">{w.message}</AdminAlert>)}
      {config.sections.map((section) => { const slots = selection[section.id] || []; const have = questionsInSlots(slots); const needs = section.kind === "mcq" ? section.total : section.total * (section.choice ? 2 : 1);
        return <div key={section.id} className={card}>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-slate-900">{section.name} · {section.heading}</h3><Pill tone={have >= needs ? "green" : "amber"}>{have} / {needs} {section.kind === "mcq" ? "MCQs" : "questions"}</Pill><Pill tone="violet">{sectionMarks(section)} marks</Pill>
            <Button variant="secondary" icon={Plus} className="ml-auto" onClick={() => setPicker({ sectionId: section.id })}>Add from bank</Button></div>
          {!slots.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No questions yet. Use "Pick questions automatically" or add them by hand.</p>}
          <ol className="mt-3 space-y-2.5">{slots.map((slot, slotIndex) => <li key={slotIndex} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 min-w-7 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{slotIndex + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                {slot.scenario && <p className="rounded-lg bg-primary-soft px-3 py-2 text-xs text-primary-dark"><b>Scenario:</b> {bank.scenarios[slot.scenario]?.scenarioText?.slice(0, 160) || "Scenario"}… <Pill tone="violet">{slot.questions.length} linked questions</Pill></p>}
                {slot.questions.map((qid, qIndex) => { const q = bank.questions[qid]; return <div key={qid}>
                  {qIndex > 0 && <p className="my-1 text-center text-xs font-black text-slate-400">OR</p>}
                  <div className="flex items-start gap-2"><p className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{q ? q.questionText : "Question unavailable"}</p>
                    {!slot.scenario && <button type="button" onClick={() => swap(section.id, slotIndex, qIndex)} disabled={Boolean(busy)} title="Replace with another question" aria-label="Replace this question" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-primary-soft hover:text-primary disabled:opacity-40">{busy === `swap-${section.id}-${slotIndex}-${qIndex}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button>}</div>
                  {q?.contentType === "mcq" && <p className="mt-1 flex flex-wrap gap-1.5 text-xs">{q.options.map((o) => <span key={o.key} className={`rounded-md px-2 py-0.5 ${o.key === q.correctOption ? "bg-emerald-50 font-black text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{o.key}. {o.text}</span>)}</p>}
                </div>; })}
                {section.choice && slot.questions.length < 2 && <Button variant="secondary" className="min-h-9" icon={Plus} onClick={() => setPicker({ sectionId: section.id, slotIndex })}>Add the OR question</Button>}
              </div>
              <button type="button" onClick={() => removeSlot(section.id, slotIndex)} aria-label="Remove this question" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>)}</ol>
        </div>; })}
    </section>}

    {step === 4 && <section className="space-y-4">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center gap-2">
          {(papers || []).map((p) => <button key={p.version} type="button" aria-pressed={version === p.version} onClick={() => setVersion(p.version)} className={`h-11 min-w-11 rounded-xl border px-3 text-sm font-black ${version === p.version ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary"}`}>Version {p.version}</button>)}
          <div className="ml-auto"><Toggle checked={showAnswers} onChange={setShowAnswers} label="Show answers in preview" /></div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button icon={FileDown} loading={busy === "export-pdf-0"} onClick={() => exportFile("pdf", false)}>Paper PDF</Button>
          <Button variant="secondary" icon={FileText} loading={busy === "export-docx-0"} onClick={() => exportFile("docx", false)}>Paper Word</Button>
          <Button variant="secondary" icon={KeyRound} loading={busy === "export-pdf-1"} onClick={() => exportFile("pdf", true)}>Answer key PDF</Button>
          <Button variant="secondary" icon={KeyRound} loading={busy === "export-docx-1"} onClick={() => exportFile("docx", true)}>Answer key Word</Button>
        </div>
        <p className="text-xs text-slate-500">PDF is ready to print. Word can be edited. The answer key lists every version's MCQ answers and is for teachers only. Downloads save the paper first.</p>
      </div>
      {busy === "preview" || !current ? <AdminLoader label="Building the preview..." /> : <div className="overflow-x-auto pb-2"><PaperPreview paper={{ ...current, showAnswers }} logoUrl={config.header.logoUrl} /></div>}
    </section>}

    <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <Button variant="secondary" icon={ArrowLeft} onClick={() => (step === 0 ? navigate("/admin/papers") : setStep(step - 1))}>{step === 0 ? "My papers" : "Back"}</Button>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs font-bold text-slate-400 sm:inline">{dirty ? "Unsaved changes" : paperId ? "Saved" : ""}</span>
        <Button variant="secondary" icon={Save} loading={busy === "save"} onClick={() => save(false)} disabled={!subjectId || !config.scope.chapters.length}>Save</Button>
        {step < 4 && <Button disabled={!lastStepOk || !canGo(step + 1)} onClick={() => setStep(step + 1)}>Next<ArrowRight className="h-4 w-4" /></Button>}
      </div>
    </div>

    {picker && <QuestionPicker picker={picker} config={config} outline={outline} section={config.sections.find((s) => s.id === picker.sectionId)} used={new Set(usedIds())} onClose={() => setPicker(null)} onAdd={(picked, scenarioId) => { addToSection(picker, picked, scenarioId); if (picker.slotIndex !== undefined) setPicker(null); }} />}
  </div>;
}

// Browse the bank and add questions by hand.
function QuestionPicker({ config, outline, section, used, onClose, onAdd }) {
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);
  const chapters = outline?.chapters || [];
  const topics = chapters.find((c) => c._id === chapter)?.topics || [];
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      axiosInstance.get("/papers/questions", { params: { subject: config.scope.subject, kind: section.kind, chapter: chapter || undefined, topic: topic || undefined, search: search || undefined, page } })
        .then((response) => live && setData(response.data)).catch((err) => live && setError(err.response?.data?.message || "Could not load questions."));
    }, search ? 300 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [config.scope.subject, section.kind, chapter, topic, search, page]);
  const addOne = async (q) => {
    if (q.scenario) {
      try { const { data: group } = await axiosInstance.get(`/papers/scenarios/${q.scenario}`); onAdd(group.questions, q.scenario); setAdded((n) => n + group.questions.length); } catch { setError("Could not add that scenario."); }
      return;
    }
    onAdd([q]); setAdded((n) => n + 1);
  };
  return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add questions" onKeyDown={(e) => e.key === "Escape" && onClose()}>
    <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-lg font-black text-slate-900">Add {KIND_LABEL[section.kind].toLowerCase()} to {section.name}</h2><p className="text-sm text-slate-500">{added ? `${added} added. ` : ""}Tap Add on each question you want.{section.kind === "mcq" && " Scenario questions come with all their linked questions."}</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
        <select className={input} value={chapter} onChange={(e) => { setChapter(e.target.value); setTopic(""); setPage(1); }}><option value="">All chapters</option>{chapters.map((c) => <option key={c._id} value={c._id}>Ch {c.chapterNumber}: {c.name}</option>)}</select>
        <select className={input} value={topic} disabled={!topics.length} onChange={(e) => { setTopic(e.target.value); setPage(1); }}><option value="">All topics</option>{topics.map((t) => <option key={t._id} value={t._id}>{t.topicNumber} {t.name}</option>)}</select>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${input} pl-9`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search text" aria-label="Search questions" /></div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        {!data ? <AdminLoader label="Loading questions..." /> : !data.questions.length ? <p className="py-10 text-center text-sm text-slate-500">No questions match.</p> : data.questions.map((q) => { const inPaper = used.has(q._id); return <div key={q._id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{q.questionText}</p>
            {q.scenario && <Pill tone="violet">Scenario group</Pill>}
            {q.contentType === "mcq" && <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">{q.options.map((o) => <span key={o.key} className={`rounded-md px-2 py-0.5 ${o.key === q.correctOption ? "bg-emerald-50 font-black text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{o.key}. {o.text}</span>)}</p>}</div>
          {inPaper ? <Pill tone="green">In paper</Pill> : <Button variant="secondary" className="min-h-9 shrink-0" icon={Plus} onClick={() => addOne(q)}>Add</Button>}
        </div>; })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4"><span className="text-xs font-bold text-slate-500">{data ? `${data.total} questions` : ""}</span>
        <div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" disabled={!data || page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button><Button onClick={onClose}>Done</Button></div></div>
    </div>
  </div>;
}
