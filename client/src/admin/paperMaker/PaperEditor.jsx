import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileDown, FileText, ImagePlus, KeyRound, Plus, RefreshCw, Save, Scissors, Shuffle, Sparkles, Trash2, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";
import PaperPreview from "./PaperPreview";
import QuestionPicker from "./QuestionPicker";
import { Button, Field, Pill, Stepper, Toggle, card, input } from "./ui";
import { KIND_LABEL, TEMPLATES, newConfig, questionsInSlots, sectionMarks, sectionsFromTemplate, templateLayout, totalMarks } from "./paperDefaults";
import "./paper-maker.css";

const STEPS = [["Set up", "Layout, pattern and chapters"], ["Questions", "Pick and review"], ["Download", "Preview, PDF and Word"]];
const blobMessage = async (error, fallback) => { try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { return error.response?.data?.message || fallback; } };
const download = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
const LAYOUTS = [["single", "Single paper", "One paper for every student. Optional versions A to D."], ["tear", "Two groups, one sheet", "Groups A and B on one sheet, printed both sides, then torn in half."]];

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
  const [fit, setFit] = useState(null);
  const [version, setVersion] = useState("A");
  const [showAnswers, setShowAnswers] = useState(false);
  const [more, setMore] = useState(false);
  const logoInput = useRef(null);
  const autoPicked = useRef(false);

  const remember = useCallback((questions = [], scenarios = []) => setBank((current) => ({ questions: { ...current.questions, ...Object.fromEntries(questions.map((q) => [q._id, q])) }, scenarios: { ...current.scenarios, ...Object.fromEntries(scenarios.map((s) => [s._id, s])) } })), []);
  const edit = (fn) => { setConfig(fn); setDirty(true); setPapers(null); };
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
      const saved = { ...newConfig(), ...data.paper.config, layout: { ...newConfig().layout, ...data.paper.config.layout } };
      setTitle(data.paper.title); setConfig(saved); setSelection(data.paper.selection || {}); setSeed(data.paper.seed); setPaperId(data.paper._id);
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
      setConfig((c) => (c.scope.chapters.length || c.scope.subject !== subjectId ? c : { ...c, scope: { ...c.scope, chapters: data.chapters.filter((ch) => ch.counts.mcq + ch.counts.short + ch.counts.long > 0).map((ch) => ({ chapter: ch._id, weight: 1, topics: [] })) } }));
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

  const chosen = new Set(config.scope.chapters.map((item) => item.chapter));
  const toggleChapter = (chapterId) => { edit((c) => ({ ...c, scope: { ...c.scope, chapters: chosen.has(chapterId) ? c.scope.chapters.filter((item) => item.chapter !== chapterId) : [...c.scope.chapters, { chapter: chapterId, weight: 1, topics: [] }] } })); };
  const usable = (outline?.chapters || []).filter((ch) => ch.counts.mcq + ch.counts.short + ch.counts.long > 0);
  const available = (kind) => config.scope.chapters.reduce((sum, item) => sum + (outline?.chapters.find((c) => c._id === item.chapter)?.counts[kind] || 0), 0);

  const applyTemplate = (key) => { edit((c) => ({ ...c, sections: sectionsFromTemplate(key), layout: { ...c.layout, ...templateLayout(key) } })); clearSelection(); };
  // Switching layout also swaps the untouched starter pattern, so the teacher lands on numbers that suit it.
  const sameAs = (key) => { const want = sectionsFromTemplate(key); return config.sections.length === want.length && want.every((w, i) => config.sections[i].kind === w.kind && config.sections[i].total === w.total && config.sections[i].marksEach === w.marksEach); };
  const chooseLayout = (mode) => {
    if (mode === "tear" && sameAs("full")) applyTemplate("tear");
    else if (mode === "single" && sameAs("tear")) applyTemplate("full");
    else edit((c) => ({ ...c, layout: { ...c.layout, mode, pages: mode === "tear" ? 0 : c.layout.pages } }));
  };

  // ---- Questions.
  const usedIds = () => Object.values(selection).flat().flatMap((slot) => slot.questions);
  const generate = useCallback(async (keepCurrent, current = {}) => {
    setBusy("generate"); setNotice(null);
    try {
      const { data } = await axiosInstance.post("/papers/generate", { config, seed: seed || undefined, paperId: paperId || undefined, keep: keepCurrent ? current : {} });
      setSelection(data.selection); setSeed(data.seed); setWarnings(data.warnings || []); remember(data.questions, data.scenarios); setDirty(true); setPapers(null);
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not pick questions." }); } finally { setBusy(""); }
  }, [config, seed, paperId, remember]);
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

  const readyForQuestions = Boolean(subjectId && config.scope.chapters.length && config.sections.length);
  const goTo = (next) => { if (next === 1 && !Object.keys(selection).length && !autoPicked.current) { autoPicked.current = true; generate(false); } setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ---- Saving, preview, downloads.
  const save = async (quiet) => {
    setBusy("save");
    try {
      const body = { title: title.trim() || [config.header.subjectTitle, config.header.examName].filter(Boolean).join(" - "), config, selection, seed };
      let savedId = paperId;
      if (paperId) { const { data } = await axiosInstance.put(`/papers/${paperId}`, body); setSeed(data.paper.seed); }
      else { const { data } = await axiosInstance.post("/papers", body); savedId = data.paper._id; setPaperId(savedId); setSeed(data.paper.seed); window.history.replaceState(null, "", `/admin/papers/${savedId}`); }
      setDirty(false);
      if (!quiet) setNotice({ type: "success", text: "Paper saved." });
      return savedId;
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not save the paper." }); return null; } finally { setBusy(""); }
  };
  const loadPreview = useCallback(async () => {
    setBusy("preview");
    try {
      const { data } = await axiosInstance.post("/papers/preview", { config, selection, seed });
      setPapers(data.papers); setFit(data.layout); setVersion((current) => (data.papers.some((p) => p.version === current) ? current : data.papers[0].version));
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "Could not build the preview." }); } finally { setBusy(""); }
  }, [config, selection, seed]);
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

  const uploadLogo = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { setNotice({ type: "error", text: "Upload the logo as a PNG or JPG image." }); return; }
    const form = new FormData(); form.append("logo", file);
    setBusy("logo"); setNotice(null);
    try {
      const { data } = await axiosInstance.post("/papers/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
      setHeader({ logoUrl: data.logoUrl });
    } catch (err) { setNotice({ type: "error", text: err.response?.data?.message || "The logo could not be uploaded." }); } finally { setBusy(""); }
  };

  const subjects = useMemo(() => catalog?.subjects || [], [catalog]);
  if (loading || !catalog) return notice?.type === "error" ? <AdminAlert type="error">{notice.text}</AdminAlert> : <AdminLoader label="Loading Paper Maker..." />;
  const slotsFilled = config.sections.every((s) => questionsInSlots(selection[s.id]) > 0);

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
      <div className={card}>
        <h2 className="text-lg font-black text-slate-900">1. Paper type</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{LAYOUTS.map(([key, name, note]) => <button key={key} type="button" aria-pressed={config.layout.mode === key} onClick={() => chooseLayout(key)} className={`rounded-2xl border-2 p-4 text-left transition ${config.layout.mode === key ? "border-primary bg-primary-soft/40" : "border-slate-200 hover:border-primary/50"}`}>
          <span className="flex items-center gap-2 font-black text-slate-900">{key === "tear" && <Scissors className="h-4 w-4" />}{name}{config.layout.mode === key && <Check className="ml-auto h-4 w-4 text-primary" />}</span><span className="mt-1 block text-sm text-slate-500">{note}</span></button>)}</div>
        <p className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Start from a pattern (you can change every number)</p>
        <div className="flex flex-wrap gap-2">{TEMPLATES.map((t) => <button key={t.key} type="button" onClick={() => applyTemplate(t.key)} title={t.note} className="min-h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary">{t.title}</button>)}</div>
      </div>

      <div className={card}>
        <h2 className="mb-4 text-lg font-black text-slate-900">2. School and exam</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject" className="sm:col-span-2"><select className={input} value={subjectId} onChange={(e) => chooseSubject(e.target.value)}><option value="">Choose class and subject</option>{subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({nameOf(catalog.classes, s.class)})</option>)}</select></Field>
          <Field label="School name"><input className={input} list="paper-schools" value={config.header.schoolName} onChange={(e) => setHeader({ schoolName: e.target.value })} placeholder="Your school" /><datalist id="paper-schools">{schools.map((s) => <option key={s._id} value={s.name} />)}</datalist></Field>
          <Field label="Name of exam"><input className={input} value={config.header.examName} onChange={(e) => setHeader({ examName: e.target.value })} placeholder="Assessment-II 2026" /></Field>
          <Field label="Time allowed"><input className={input} value={config.header.timeAllowed} onChange={(e) => setHeader({ timeAllowed: e.target.value })} placeholder="1 hour 20 mins" /></Field>
          <Field label="Date (optional)"><input className={input} value={config.header.date} onChange={(e) => setHeader({ date: e.target.value })} placeholder="14 Jan 2026" /></Field>
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 p-3">
          {config.header.logoUrl ? <img src={config.header.logoUrl} alt="School logo" className="h-14 w-14 rounded-lg border border-slate-200 object-contain" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImagePlus className="h-6 w-6" /></span>}
          <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-800">School logo (optional)</p><p className="text-xs text-slate-500">PNG or JPG, up to 2 MB.</p></div>
          <input ref={logoInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="secondary" loading={busy === "logo"} onClick={() => logoInput.current?.click()}>{config.header.logoUrl ? "Change" : "Upload"}</Button>
          {config.header.logoUrl && <Button variant="ghost" onClick={() => setHeader({ logoUrl: "" })} aria-label="Remove logo"><X className="h-4 w-4" /></Button>}
        </div>
      </div>

      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-slate-900">3. Questions and marks</h2><Pill tone="violet">Total {total} marks</Pill></div>
        <div className="space-y-3">{config.sections.map((section) => <div key={section.id} className="rounded-2xl border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <input aria-label="Section name" className={`${input} max-w-40 font-black`} value={section.name} onChange={(e) => setSection(section.id, { name: e.target.value })} />
            <select aria-label="Section type" className={`${input} max-w-40`} value={section.kind} onChange={(e) => { const kind = e.target.value; setSection(section.id, { kind, choice: kind === "mcq" ? false : section.choice, attempt: kind === "mcq" ? section.total : Math.min(section.attempt, section.total), marksEach: kind === "mcq" ? 1 : kind === "short" ? 2 : 5 }); setSelection((c) => ({ ...c, [section.id]: [] })); }}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <Pill>{sectionMarks(section)} marks</Pill>
            <Button variant="danger" className="ml-auto" disabled={config.sections.length === 1} aria-label={`Remove ${section.name}`} onClick={() => { edit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== section.id) })); setSelection((c) => { const { [section.id]: gone, ...rest } = c; void gone; return rest; }); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
            <div><span className="mb-1 block text-xs font-bold text-slate-500">{section.kind === "mcq" ? "Number of MCQs" : "Questions given"}</span><Stepper label="questions" value={section.total} min={1} max={100} onChange={(value) => setSection(section.id, { total: value, attempt: section.kind === "mcq" ? value : Math.min(section.attempt, value) })} /></div>
            {section.kind !== "mcq" && <div><span className="mb-1 block text-xs font-bold text-slate-500">Student attempts</span><Stepper label="attempts" value={section.attempt} min={1} max={section.total} onChange={(value) => setSection(section.id, { attempt: value })} /></div>}
            <div><span className="mb-1 block text-xs font-bold text-slate-500">Marks each</span><Stepper label="marks" value={section.marksEach} min={0.5} max={100} step={0.5} onChange={(value) => setSection(section.id, { marksEach: value })} /></div>
            {section.kind !== "mcq" && <div className="pb-2.5"><Toggle checked={Boolean(section.choice)} onChange={(v) => { setSection(section.id, { choice: v }); setSelection((c) => ({ ...c, [section.id]: [] })); }} label="Internal choice (OR)" /></div>}
          </div>
          {section.kind !== "mcq" && section.attempt < section.total && <p className="mt-2 text-xs font-semibold text-slate-500">Printed as: "Answer any {section.attempt} of the following questions."</p>}
        </div>)}</div>
        <Button className="mt-3" variant="secondary" icon={Plus} disabled={config.sections.length >= 8} onClick={() => edit((c) => { const next = c.sections.length + 1; return { ...c, sections: [...c.sections, { id: `S${Date.now() % 100000}`, kind: "short", name: `Section ${String.fromCharCode(64 + next)}`, total: 5, attempt: 5, marksEach: 2 }] }; })}>Add section</Button>
      </div>

      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black text-slate-900">4. Chapters</h2>
          {outline && <div className="flex gap-2"><Button variant="secondary" className="min-h-9" onClick={() => edit((c) => ({ ...c, scope: { ...c.scope, chapters: usable.map((ch) => ({ chapter: ch._id, weight: 1, topics: [] })) } }))}>All</Button><Button variant="ghost" className="min-h-9" onClick={() => edit((c) => ({ ...c, scope: { ...c.scope, chapters: [] } }))}>None</Button></div>}</div>
        {!subjectId ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Choose a subject first.</p> : !outline ? <AdminLoader label="Loading chapters..." /> : !usable.length ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">This subject has no questions in the bank yet.</p> :
          <div className="grid gap-2 sm:grid-cols-2">{usable.map((chapter) => <label key={chapter._id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${chosen.has(chapter._id) ? "border-primary/40 bg-primary-soft/30" : "border-slate-200 hover:border-slate-300"}`}>
            <input type="checkbox" checked={chosen.has(chapter._id)} onChange={() => toggleChapter(chapter._id)} className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--color-primary)]" />
            <span className="min-w-0"><span className="block text-sm font-black text-slate-900">Chapter {chapter.chapterNumber}: {chapter.name}</span><span className="text-xs text-slate-500">{chapter.counts.mcq} MCQs · {chapter.counts.short} short · {chapter.counts.long} long</span></span></label>)}</div>}
        {config.scope.chapters.length > 0 && <p className="mt-3 text-sm text-slate-600">Available: <b>{available("mcq")}</b> MCQs, <b>{available("short")}</b> short, <b>{available("long")}</b> long questions.</p>}
        {outline?.urduQuestions > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{outline.urduQuestions} Urdu questions are left out because Urdu printing is not available yet.</p>}
      </div>

      <div className={card}>
        <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="flex w-full items-center justify-between text-left"><span className="text-lg font-black text-slate-900">More options</span><ChevronDown className={`h-5 w-5 text-slate-500 transition ${more ? "rotate-180" : ""}`} /></button>
        {more && <div className="mt-4 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Paper size"><select className={input} value={config.layout.paper} onChange={(e) => setLayout({ paper: e.target.value })}><option value="A4">A4</option><option value="Letter">Letter</option></select></Field>
            <Field label="Font"><select className={input} value={config.layout.font} onChange={(e) => setLayout({ font: e.target.value })}><option value="sans">Arial (clean)</option><option value="serif">Times (classic)</option></select></Field>
            {!tear && <Field label="Fit to"><select className={input} value={config.layout.pages} onChange={(e) => setLayout({ pages: Number(e.target.value) })}><option value={0}>As many pages as needed</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} page{n > 1 ? "s" : ""} at most</option>)}</select></Field>}
            {tear && <Field label="Cut line"><select className={input} value={config.layout.cutLine} onChange={(e) => setLayout({ cutLine: e.target.value })}><option value="back">Back side only</option><option value="both">Both sides</option><option value="none">None</option></select></Field>}
            <Field label="Subject title on paper"><input className={input} value={config.header.subjectTitle} onChange={(e) => setHeader({ subjectTitle: e.target.value })} /></Field>
            <Field label="Class on paper"><input className={input} value={config.header.className} onChange={(e) => setHeader({ className: e.target.value })} /></Field>
            <Field label="Name in my list"><input className={input} value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="Class 9 Physics mid term" /></Field>
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
        <p className="text-xs text-slate-500">Swap any question with the arrow, remove it, or add your own from the bank.</p>
      </div>
      {warnings.map((w) => <AdminAlert key={w.message} type="error">{w.message}</AdminAlert>)}
      {busy === "generate" && !Object.keys(selection).length && <AdminLoader label="Picking questions..." />}
      {config.sections.map((section) => { const slots = selection[section.id] || []; const have = questionsInSlots(slots); const needs = section.kind === "mcq" ? section.total : section.total * (section.choice ? 2 : 1);
        return <div key={section.id} className={card}>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-slate-900">{section.name} · {KIND_LABEL[section.kind]}</h3><Pill tone={have >= needs ? "green" : "amber"}>{have} / {needs}</Pill><Pill tone="violet">{sectionMarks(section)} marks</Pill>
            <Button variant="secondary" icon={Plus} className="ml-auto min-h-10" onClick={() => setPicker({ sectionId: section.id })}>Add from bank</Button></div>
          {!slots.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No questions yet.</p>}
          <ol className="mt-3 space-y-2.5">{slots.map((slot, slotIndex) => <li key={slotIndex} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 min-w-7 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{slotIndex + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                {slot.scenario && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"><b>Scenario:</b> {bank.scenarios[slot.scenario]?.scenarioText?.slice(0, 160) || "Scenario"}… <Pill>{slot.questions.length} linked questions</Pill></p>}
                {slot.questions.map((qid, qIndex) => { const q = bank.questions[qid]; return <div key={qid}>
                  {qIndex > 0 && <p className="my-1 text-center text-xs font-black text-slate-400">OR</p>}
                  <div className="flex items-start gap-2"><p className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{q ? q.questionText : "Question unavailable"}</p>
                    {!slot.scenario && <button type="button" onClick={() => swap(section.id, slotIndex, qIndex)} disabled={Boolean(busy)} title="Replace with another question" aria-label="Replace this question" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-primary-soft hover:text-primary disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy === `swap-${section.id}-${slotIndex}-${qIndex}` ? "animate-spin" : ""}`} /></button>}</div>
                  {q?.contentType === "mcq" && <p className="mt-1 flex flex-wrap gap-1.5 text-xs">{q.options.map((o) => <span key={o.key} className={`rounded-md px-2 py-0.5 ${o.key === q.correctOption ? "bg-emerald-50 font-black text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{o.key}. {o.text}</span>)}</p>}
                </div>; })}
                {section.choice && slot.questions.length < 2 && <Button variant="secondary" className="min-h-9" icon={Plus} onClick={() => setPicker({ sectionId: section.id, slotIndex })}>Add the OR question</Button>}
              </div>
              <button type="button" onClick={() => removeSlot(section.id, slotIndex)} aria-label="Remove this question" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>)}</ol>
        </div>; })}
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
        <span className="hidden text-xs font-bold text-slate-400 sm:inline">{dirty ? "Unsaved changes" : paperId ? "Saved" : ""}</span>
        <Button variant="secondary" icon={Save} loading={busy === "save"} onClick={() => save(false)} disabled={!readyForQuestions}>Save</Button>
        {step < 2 && <Button disabled={!readyForQuestions || (step === 1 && !Object.keys(selection).length)} onClick={() => goTo(step + 1)}>Next<ArrowRight className="h-4 w-4" /></Button>}
      </div>
    </div>

    {picker && <QuestionPicker config={config} outline={outline} section={config.sections.find((s) => s.id === picker.sectionId)} used={new Set(usedIds())} onClose={() => setPicker(null)} onAdd={(picked, scenarioId) => { addToSection(picker, picked, scenarioId); if (picker.slotIndex !== undefined) setPicker(null); }} />}
  </div>;
}
