import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FileDown, FileText, KeyRound, Library, PenLine, Plus, Save, Shuffle, Sparkles, Trash2, Wand2, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import CustomSelect from "../../shared/CustomSelect";
import ModalViewport from "../../shared/ModalViewport";
import { Blocks } from "../../shared/PbaContent";
import { AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";
import BlockEditor from "../pba/BlockEditor";
import PartsEditor from "../pba/PartsEditor";
import { messageOf, newPart } from "../pba/pbaUtils";
import DurationPicker from "./DurationPicker";
import DatePicker from "./DatePicker";
import PaperStyle from "./PaperStyle";
import PbaPaperPreview from "./PbaPaperPreview";
import SubjectPicker from "./SubjectPicker";
import { Button, Field, Pill, Stepper, Toggle, card, input } from "./ui";
import { PBA_TEMPLATES, entryMarks, marksOfParts, newCustomId, newPbaConfig } from "./pbaPaperDefaults";
import "./paper-maker.css";

const STEPS = [["Set up", "Details, pattern and style"], ["Questions", "Pick, swap or write your own"], ["Download", "Preview, PDF and Word"]];
const PAGE_CHOICES = [["0", "Any length"], ["1", "1 page"], ["2", "2 pages"], ["3", "3 pages"], ["4", "4 pages"]].map(([value, label]) => ({ value, label }));
const blobMessage = async (error, fallback) => { try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { return error.response?.data?.message || fallback; } };
const save = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
const nextId = (list, prefix) => { let n = list.length + 1; while (list.some((item) => item.id === `${prefix}${n}`)) n += 1; return `${prefix}${n}`; };

const Warning = ({ children }) => <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><span>{children}</span></div>;

function Heading({ number, title, hint, children }) {
  return <div className={card}><div className="mb-4 flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-white">{number}</span><div><h2 className="text-lg font-black leading-tight text-slate-900">{title}</h2>{hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}</div></div>{children}</div>;
}

// A window with a title, a scrolling body and buttons at the bottom.
function Dialog({ title, onClose, footer, children, wide }) {
  return <ModalViewport onClose={onClose}><div className={`flex max-h-[96dvh] w-full ${wide ? "max-w-3xl" : "max-w-xl"} flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl`}>
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="text-lg font-black text-slate-900">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
    {footer && <div className="flex justify-end gap-2 border-t border-slate-100 p-4">{footer}</div>}
  </div></ModalViewport>;
}

// Choose one practical from the list, with a search box and filters.
function Chooser({ data, slot, usedIds, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(slot.topics[0] || "");
  const [category, setCategory] = useState(slot.categories[0] || "");
  const shown = data.practicals.filter((p) => (!topic || p.topic === topic) && (!category || p.category === category) && (!query.trim() || `${p.title} ${p.label}`.toLowerCase().includes(query.trim().toLowerCase())));
  return <Dialog title="Choose a practical" onClose={onClose} wide>
    <div className="grid gap-3 sm:grid-cols-3">
      <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search practicals" aria-label="Search practicals" />
      <CustomSelect value={topic} onChange={setTopic} options={data.topics.map((t) => ({ value: t._id, label: t.name }))} placeholder="All topics" />
      <CustomSelect value={category} onChange={setCategory} options={data.categories.map((c) => ({ value: c._id, label: c.name }))} placeholder="All categories" />
    </div>
    {!shown.length ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No written practical matches. Add questions to practicals in Prepare PBA, or write your own here.</p> :
      <ul className="space-y-2">{shown.map((p) => <li key={p._id}><button type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left hover:border-primary">
        <span className="min-w-0 flex-1"><span className="block truncate font-black text-slate-900">{p.title}</span><span className="block text-xs text-slate-500">{[data.topics.find((t) => t._id === p.topic)?.name, data.categories.find((c) => c._id === p.category)?.name].filter(Boolean).join(" · ")}</span></span>
        {usedIds.has(p._id) && <Pill tone="amber">In paper</Pill>}<Pill tone="violet">{p.marks} marks</Pill></button></li>)}</ul>}
  </Dialog>;
}

// Write a question for this paper only, or change a copy of a practical. It never changes the practical list.
function Writer({ initial, upload, onSave, onClose }) {
  const [title, setTitle] = useState(initial.title || "");
  const [blocks, setBlocks] = useState(initial.blocks || []);
  const [parts, setParts] = useState(initial.parts?.length ? initial.parts : [newPart()]);
  const [error, setError] = useState("");
  const done = () => {
    if (!blocks.length && !parts.some((p) => p.blocks?.length)) return setError("Write the question first.");
    onSave({ _id: initial._id || newCustomId(), title: title.trim() || "My question", blocks, parts, marks: marksOfParts(parts) });
  };
  return <Dialog title={initial._id ? "Edit your question" : "Write a question"} onClose={onClose} wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={done}>Use in paper</Button></>}>
    <Field label="Name (only you see this)"><input className={input} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Debug the JavaScript loop" /></Field>
    <div><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Question (shown before the parts)</p><BlockEditor blocks={blocks} onChange={setBlocks} upload={upload} label="question" /></div>
    <div><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Parts, marks and answer space · {marksOfParts(parts)} marks</p><PartsEditor parts={parts} onChange={setParts} upload={upload} /></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
  </Dialog>;
}

export default function PbaPaperEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [data, setData] = useState({ topics: [], categories: [], practicals: [] });
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [config, setConfig] = useState(() => newPbaConfig());
  const [selection, setSelection] = useState({});
  const [custom, setCustom] = useState([]);
  const [seed, setSeed] = useState("");
  const [paperId, setPaperId] = useState(id || "");
  const [warnings, setWarnings] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false);
  const [chooser, setChooser] = useState(null);
  const [writer, setWriter] = useState(null);
  const [papers, setPapers] = useState(null);
  const [fit, setFit] = useState(null);
  const [version, setVersion] = useState("A");
  const [view, setView] = useState("paper");
  const logoInput = useRef(null);

  const edit = (fn) => { setConfig(fn); setDirty(true); setPapers(null); };
  const touch = () => { setDirty(true); setPapers(null); };
  const setHeader = (patch) => edit((c) => ({ ...c, header: { ...c.header, ...patch } }));
  const setLayout = (patch) => edit((c) => ({ ...c, layout: { ...c.layout, ...patch } }));
  const setSection = (sectionId, patch) => edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) }));
  const setSlot = (sectionId, index, patch) => edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === sectionId ? { ...s, slots: s.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)) } : s)) }));
  const fail = (err, fallback) => setNotice({ type: "error", text: messageOf(err, fallback) });

  useEffect(() => { axiosInstance.get("/papers/catalog").then(({ data: cat }) => setCatalog(cat)).catch((err) => setNotice({ type: "error", text: messageOf(err, "Could not load the paper tools.") })); }, []);
  const subjectId = config.scope.subject;
  useEffect(() => {
    if (!subjectId) return undefined;
    let live = true;
    axiosInstance.get("/papers/pba/practicals", { params: { subject: subjectId } }).then((res) => live && setData(res.data)).catch((err) => live && fail(err, "Could not load the practicals."));
    return () => { live = false; };
  }, [subjectId]);
  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`/papers/${id}`).then(({ data: res }) => {
      if (res.paper.config?.kind !== "pba") { navigate(`/admin/papers/${id}`, { replace: true }); return; }
      const fresh = newPbaConfig();
      setConfig({ ...fresh, ...res.paper.config, header: { ...fresh.header, ...res.paper.config.header }, layout: { ...fresh.layout, ...res.paper.config.layout } });
      setTitle(res.paper.title); setSelection(res.paper.selection || {}); setCustom(res.paper.custom || []); setSeed(res.paper.seed); setPaperId(res.paper._id); setStep(1);
    }).catch((err) => fail(err, "Paper not found.")).finally(() => setLoading(false));
  }, [id, navigate]);

  const byId = useMemo(() => new Map([...data.practicals, ...custom].map((p) => [p._id, p])), [data, custom]);
  const usedIds = useMemo(() => new Set(Object.values(selection).flat().filter(Boolean).map((e) => e.id)), [selection]);
  const total = config.sections.reduce((sum, section) => sum + section.slots.reduce((inner, _slot, i) => { const entry = selection[section.id]?.[i]; return inner + (entry ? entryMarks(entry, byId.get(entry.id)) : 0); }, 0), 0);
  const nameOf = (list, value) => (list || []).find((item) => item._id === value)?.name || "";

  const chooseSubject = (value) => {
    const subject = catalog.subjects.find((s) => s._id === value);
    if (!subject) return;
    setSelection({}); setPapers(null); setDirty(true);
    setConfig((c) => ({ ...c, scope: { board: subject.board, class: subject.class, group: subject.group || "", subject: value }, sections: c.sections.map((s) => ({ ...s, slots: s.slots.map((slot) => ({ ...slot, topics: [], categories: [] })) })), header: { ...c.header, subjectTitle: c.header.subjectTitle || subject.name, className: c.header.className || nameOf(catalog.classes, subject.class).replace(/^class\s*/i, "") } }));
  };
  const applyTemplate = (template) => { edit((c) => ({ ...c, sections: newPbaConfig(template).sections, header: { ...c.header, note: template.paperNote } })); setSelection({}); };

  const upload = async (file) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error("Upload the image as a PNG or JPG file.");
    const form = new FormData(); form.append("logo", file);
    try { return (await axiosInstance.post("/papers/logo", form, { headers: { "Content-Type": "multipart/form-data" } })).data.logoUrl; } catch (err) { throw new Error(messageOf(err, "The picture could not be uploaded.")); }
  };
  const uploadTo = async (file, done, label) => { if (!file) return; setBusy(label); setNotice(null); try { done(await upload(file)); } catch (err) { setNotice({ type: "error", text: err.message }); } finally { setBusy(""); } };

  const payload = () => ({ title, config, selection, custom, seed });
  const persist = async () => {
    const body = payload();
    if (paperId) { const { data: res } = await axiosInstance.put(`/papers/${paperId}`, body); setSeed(res.paper.seed); setDirty(false); return paperId; }
    const { data: res } = await axiosInstance.post("/papers", body);
    setPaperId(res.paper._id); setSeed(res.paper.seed); setDirty(false); window.history.replaceState(window.history.state, "", `/admin/papers/pba/${res.paper._id}`); // the address changes without reloading the editor
    return res.paper._id;
  };
  const saveNow = async () => { setBusy("save"); setNotice(null); try { await persist(); setNotice({ type: "success", text: "Paper saved." }); } catch (err) { fail(err, "Could not save the paper."); } finally { setBusy(""); } };

  const autoPick = async (keepAll) => {
    setBusy("pick"); setNotice(null);
    try {
      const keep = keepAll ? selection : Object.fromEntries(Object.entries(selection).map(([key, list]) => [key, list.map((e) => (e && e.id.startsWith("c_") ? e : null))]));
      const { data: res } = await axiosInstance.post("/papers/pba/generate", { config, custom, keep, seed });
      setSelection(res.selection); setWarnings(res.warnings || []); setSeed(res.seed); touch();
    } catch (err) { fail(err, "Could not pick the practicals."); } finally { setBusy(""); }
  };
  const goQuestions = async () => {
    if (!subjectId) return setNotice({ type: "error", text: "Choose the board, class and subject first." });
    setNotice(null); setStep(1);
    if (!Object.values(selection).some((list) => list?.some(Boolean))) await autoPick(true);
  };
  const goDownload = async () => {
    setNotice(null); setStep(2); setBusy("preview");
    try {
      const { data: res } = await axiosInstance.post("/papers/pba/preview", { config, selection, custom, seed });
      setPapers(res.papers); setFit(res.layout); setVersion((v) => (res.papers.some((p) => p.version === v) ? v : res.papers[0].version));
    } catch (err) { fail(err, "Could not build the preview."); } finally { setBusy(""); }
  };

  const setEntry = (sectionId, index, entry) => { setSelection((current) => { const list = [...(current[sectionId] || [])]; list[index] = entry; return { ...current, [sectionId]: list }; }); touch(); };
  const pickPractical = (p) => { setEntry(chooser.sectionId, chooser.index, { id: p._id }); setChooser(null); };
  // Moves a question up or down inside its section; its topic filter travels with it.
  const moveSlot = (section, index, delta) => {
    const to = index + delta;
    if (to < 0 || to >= section.slots.length) return;
    const swapped = (list) => { const next = [...list]; [next[index], next[to]] = [next[to], next[index]]; return next; };
    edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === section.id ? { ...s, slots: swapped(s.slots) } : s)) }));
    setSelection((current) => { const list = [...(current[section.id] || [])]; while (list.length < section.slots.length) list.push(null); return { ...current, [section.id]: swapped(list) }; });
  };
  const swap = (section, index) => {
    const slot = section.slots[index];
    const pool = data.practicals.filter((p) => !usedIds.has(p._id) && (!slot.topics.length || slot.topics.includes(p.topic)) && (!slot.categories.length || slot.categories.includes(p.category)));
    if (!pool.length) return setNotice({ type: "error", text: "No other practical matches this question. Relax the topic or category, or choose from the list." });
    setEntry(section.id, index, { id: pool[Math.floor(Math.random() * pool.length)]._id });
  };
  const saveWritten = (item) => {
    setCustom((list) => [...list.filter((c) => c._id !== item._id), item]);
    setEntry(writer.sectionId, writer.index, { id: item._id }); setWriter(null);
  };
  const setPartMark = (sectionId, index, partIndex, value, parts) => {
    const entry = selection[sectionId][index];
    const marks = parts.map((part, i) => entry.partMarks?.[i] ?? part.marks); marks[partIndex] = value;
    setEntry(sectionId, index, { ...entry, partMarks: marks });
  };

  const download = async (kind, format) => {
    setBusy(`${kind}-${format}`); setNotice(null);
    try {
      const savedId = await persist();
      const response = await axiosInstance.get(`/papers/${savedId}/export`, { params: { format, key: kind === "key" ? 1 : 0, esheet: kind === "esheet" ? 1 : 0, version }, responseType: "blob", timeout: 120000 });
      save(response.data, /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || `paper.${format}`);
    } catch (err) { setNotice({ type: "error", text: await blobMessage(err, "The file could not be created. Please try again.") }); } finally { setBusy(""); }
  };

  if (loading || !catalog) return <div className="mx-auto max-w-5xl">{notice ? <AdminAlert type={notice.type}>{notice.text}</AdminAlert> : <AdminLoader label="Loading..." />}</div>;
  const h = config.header;
  const subjectName = catalog.subjects.find((s) => s._id === subjectId)?.name;

  return <div className="mx-auto max-w-5xl space-y-5 pb-4">
    <AdminPageHeader icon={FileText} eyebrow="Paper Maker · PBA" title={title || "New PBA paper"} description="Build a practical based assessment paper from your practicals, with code, pictures and labelling. Download it as PDF, Word, an answer key or an E-sheet." />
    <nav aria-label="Steps" className="grid grid-cols-3 gap-2">{STEPS.map(([name, hint], i) => <button key={name} type="button" onClick={() => (i === 0 ? setStep(0) : i === 1 ? goQuestions() : goDownload())} aria-current={step === i} className={`rounded-2xl border-2 p-3 text-left transition ${step === i ? "border-primary bg-primary-soft/40" : "border-slate-200 bg-white hover:border-primary/40"}`}><span className="block text-sm font-black text-slate-900">{i + 1}. {name}</span><span className="hidden text-xs text-slate-500 sm:block">{hint}</span></button>)}</nav>
    {notice && <AdminAlert type={notice.type}>{notice.text}</AdminAlert>}

    {step === 0 && <>
      <Heading number="1" title="Subject" hint="Papers use the practicals added for this subject in Prepare PBA.">
        <SubjectPicker catalog={catalog} value={subjectId} onChange={chooseSubject} />
        {subjectId && <p className="mt-3 text-sm text-slate-500">{subjectName}: {data.practicals.length} practical{data.practicals.length === 1 ? "" : "s"} with a written question.</p>}
      </Heading>
      <Heading number="2" title="Paper details" hint="Everything here prints in the header. Leave out what you do not need.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paper name (for your list)"><input className={input} value={title} maxLength={160} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="e.g. PBA Computer, first term" /></Field>
          <Field label="School name"><input className={input} value={h.schoolName} maxLength={120} onChange={(e) => setHeader({ schoolName: e.target.value })} /></Field>
          <Field label="Exam"><input className={input} value={h.examName} maxLength={120} onChange={(e) => setHeader({ examName: e.target.value })} /></Field>
          <Field label="Paper title"><input className={input} value={h.paperTitle} maxLength={120} onChange={(e) => setHeader({ paperTitle: e.target.value })} /></Field>
          <Field label="Session"><input className={input} value={h.session} maxLength={60} onChange={(e) => setHeader({ session: e.target.value })} placeholder="e.g. SESSION 2026-27" /></Field>
          <Field label="Subject (footer)"><input className={input} value={h.subjectTitle} maxLength={100} onChange={(e) => setHeader({ subjectTitle: e.target.value })} /></Field>
          <Field label="Class (footer)"><input className={input} value={h.className} maxLength={60} onChange={(e) => setHeader({ className: e.target.value })} placeholder="e.g. X" /></Field>
          <DatePicker label="Date" value={h.date} onChange={(value) => setHeader({ date: value })} placeholder="Choose the exam date" />
          <DurationPicker label="Time allowed" value={h.timeAllowed} onChange={(value) => setHeader({ timeAllowed: value })} placeholder="e.g. 2 hours" />
          <Field label="Note under the marks"><input className={input} value={h.note} maxLength={300} onChange={(e) => setHeader({ note: e.target.value })} placeholder="e.g. Attempt all questions" /></Field>
          <Field label="Lines for the candidate (one per line)" className="sm:col-span-2"><textarea className={`${input} min-h-24 py-2`} value={h.candidateFields.join("\n")} onChange={(e) => setHeader({ candidateFields: e.target.value.split("\n").slice(0, 8) })} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <input ref={logoInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { uploadTo(e.target.files?.[0], (url) => setHeader({ logoUrl: url }), "logo"); e.target.value = ""; }} />
          {h.logoUrl && <img src={h.logoUrl} alt="School logo" className="h-14 w-14 rounded-lg border border-slate-200 object-contain" />}
          <Button variant="secondary" icon={Plus} loading={busy === "logo"} onClick={() => logoInput.current?.click()}>{h.logoUrl ? "Change logo" : "Add school logo"}</Button>
          {h.logoUrl && <Button variant="ghost" onClick={() => setHeader({ logoUrl: "" })}>Remove</Button>}
          <Toggle checked={config.layout.rollNumber} onChange={(value) => setLayout({ rollNumber: value })} label="Roll number boxes and bubbles" />
          {config.layout.rollNumber && <span className="flex items-center gap-2 text-sm font-bold text-slate-600">Digits <Stepper label="roll number digits" value={config.layout.rollDigits} min={4} max={10} onChange={(value) => setLayout({ rollDigits: value })} /></span>}
        </div>
      </Heading>
      <Heading number="3" title="Pattern" hint="Sections and questions. Choose a topic or category for a question to limit what it picks from.">
        <div className="mb-4 grid gap-2.5 sm:grid-cols-3">{PBA_TEMPLATES.map((t) => <button key={t.key} type="button" onClick={() => applyTemplate(t)} className="rounded-2xl border-2 border-slate-200 p-3 text-left hover:border-primary"><span className="block font-black text-slate-900">{t.title}</span><span className="text-xs text-slate-500">{t.note}</span></button>)}</div>
        <div className="space-y-4">{config.sections.map((section, si) => <div key={section.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Section name" className="min-w-48 flex-1"><input className={input} value={section.name} maxLength={40} onChange={(e) => setSection(section.id, { name: e.target.value })} /></Field>
            <Field label="Instruction (optional)" className="min-w-48 flex-[2]"><input className={input} value={section.note} maxLength={200} onChange={(e) => setSection(section.id, { note: e.target.value })} /></Field>
            {config.sections.length > 1 && <Button variant="danger" icon={Trash2} aria-label={`Remove ${section.name}`} onClick={() => { edit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== section.id) })); setSelection((s) => { const next = { ...s }; delete next[section.id]; return next; }); }} />}
          </div>
          <ul className="mt-3 space-y-2">{section.slots.map((slot, i) => <li key={slot.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5">
            <span className="w-16 text-sm font-black text-slate-700">Q{i + 1}</span>
            <div className="min-w-40 flex-1"><CustomSelect value={slot.topics[0] || ""} onChange={(v) => setSlot(section.id, i, { topics: v ? [v] : [] })} options={data.topics.map((t) => ({ value: t._id, label: t.name }))} placeholder="Any topic" /></div>
            <div className="min-w-40 flex-1"><CustomSelect value={slot.categories[0] || ""} onChange={(v) => setSlot(section.id, i, { categories: v ? [v] : [] })} options={data.categories.map((c) => ({ value: c._id, label: c.name }))} placeholder="Any category" /></div>
            {section.slots.length > 1 && <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => { edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === section.id ? { ...s, slots: s.slots.filter((_x, j) => j !== i) } : s)) })); setSelection((s) => ({ ...s, [section.id]: (s[section.id] || []).filter((_x, j) => j !== i) })); }} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>}
          </li>)}</ul>
          {section.slots.length < 12 && <Button variant="secondary" icon={Plus} className="mt-3" onClick={() => edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === section.id ? { ...s, slots: [...s.slots, { id: nextId(s.slots, `Q${si + 1}`), topics: [], categories: [] }] } : s)) }))}>Add question</Button>}
        </div>)}</div>
        {config.sections.length < 6 && <Button variant="secondary" icon={Plus} className="mt-3" onClick={() => edit((c) => ({ ...c, sections: [...c.sections, { id: nextId(c.sections, "S"), name: `SECTION-${String.fromCharCode(65 + c.sections.length)}`, note: "", slots: [{ id: "Q1", topics: [], categories: [] }] }] }))}>Add section</Button>}
      </Heading>
      <Heading number="4" title="Style and options">
        <PaperStyle layout={config.layout} setLayout={setLayout} onUpload={(file, done) => uploadTo(file, done, "mark")} uploading={busy === "mark"} />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Fit to pages"><CustomSelect value={String(config.layout.pages || 0)} onChange={(v) => setLayout({ pages: Number(v) || 0 })} options={PAGE_CHOICES} allowClear={false} /></Field>
          <Field label="Versions"><div className="flex gap-2">{["A", "B", "C", "D"].map((letter) => { const on = config.versions.includes(letter); return <button key={letter} type="button" aria-pressed={on} onClick={() => edit((c) => { const next = on ? c.versions.filter((v) => v !== letter) : [...c.versions, letter].sort(); return { ...c, versions: next.length ? next : c.versions }; })} className={`h-11 w-11 rounded-xl border-2 text-sm font-black ${on ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600"}`}>{letter}</button>; })}</div></Field>
          <div className="space-y-3 pt-6"><Toggle checked={config.layout.spaceMode !== "none"} onChange={(value) => setLayout({ spaceMode: value ? "practical" : "none" })} label="Leave answer space" /><Toggle checked={config.options.avoidRepeats} onChange={(value) => edit((c) => ({ ...c, options: { ...c.options, avoidRepeats: value } }))} label="Different practical in each version" /></div>
        </div>
      </Heading>
    </>}

    {step === 1 && <>
      <div className="flex flex-wrap items-center gap-3"><Button icon={Wand2} loading={busy === "pick"} onClick={() => autoPick(true)}>Fill empty questions</Button><Button variant="secondary" icon={Shuffle} loading={busy === "pick"} onClick={() => autoPick(false)}>Pick everything again</Button><Pill tone="violet">{Math.round(total * 100) / 100} marks</Pill></div>
      {warnings.length > 0 && <Warning>{warnings.map((w, i) => <span key={i} className="block">{w.message}</span>)}</Warning>}
      {config.sections.map((section) => <div key={section.id} className="space-y-3"><h2 className="text-lg font-black text-slate-900">{section.name}</h2>
        {section.slots.map((slot, index) => { const entry = selection[section.id]?.[index]; const p = entry && byId.get(entry.id); const mine = entry?.id.startsWith("c_");
          return <div key={slot.id} className={card}>
            <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-base font-black text-slate-900">Question {index + 1}</span>{p && <><Pill tone="violet">{entryMarks(entry, p)} marks</Pill>{mine ? <Pill tone="amber">Written for this paper</Pill> : <Pill>{p.title}</Pill>}</>}
              <span className="flex w-full flex-wrap gap-1.5 sm:ml-auto sm:w-auto">
                <Button variant="ghost" icon={ArrowUp} className="!min-h-9 !px-2" disabled={index === 0} aria-label={`Move question ${index + 1} up`} onClick={() => moveSlot(section, index, -1)} />
                <Button variant="ghost" icon={ArrowDown} className="!min-h-9 !px-2" disabled={index === section.slots.length - 1} aria-label={`Move question ${index + 1} down`} onClick={() => moveSlot(section, index, 1)} />
                <Button variant="secondary" icon={Shuffle} className="!min-h-9 !px-3" onClick={() => swap(section, index)}>Swap</Button>
                <Button variant="secondary" icon={Library} className="!min-h-9 !px-3" onClick={() => setChooser({ sectionId: section.id, index, slot })}>Choose</Button>
                <Button variant="secondary" icon={PenLine} className="!min-h-9 !px-3" onClick={() => setWriter({ sectionId: section.id, index, initial: p ? (mine ? p : { title: `${p.title} (edited)`, blocks: p.blocks, parts: p.parts }) : {} })}>{p ? (mine ? "Edit" : "Customize copy") : "Write own"}</Button>
                {p && <Button variant="danger" icon={Trash2} className="!min-h-9 !px-3" aria-label={`Remove question ${index + 1}`} onClick={() => setEntry(section.id, index, null)} />}
              </span></div>
            {!p ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No question yet. Swap, choose one, or write your own.</p> : <>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"><Blocks blocks={p.blocks} />{p.parts.map((part, i) => <div key={i} className="mt-2 flex items-start gap-3 border-t border-slate-100 pt-2"><b className="w-5 text-sm">{String.fromCharCode(97 + i)}.</b><div className="min-w-0 flex-1"><Blocks blocks={part.blocks} /></div>
                {!mine && <Stepper label={`marks for part ${String.fromCharCode(97 + i)}`} value={Number(entry.partMarks?.[i] ?? part.marks)} min={0} max={100} step={0.5} onChange={(v) => setPartMark(section.id, index, i, v, p.parts)} />}
                {mine && <Pill>{part.marks}</Pill>}</div>)}</div></>}
          </div>; })}</div>)}
    </>}

    {step === 2 && <>
      {busy === "preview" || !papers ? <AdminLoader label="Building the preview..." /> : <>
        {fit && !fit.fits && <Warning>{`This paper needs ${fit.pages} pages, but you asked for ${fit.wanted}. Remove some answer space or questions, or choose a longer page limit.`}</Warning>}
        {fit && fit.fits && <p className="text-sm text-slate-500">Prints on {fit.pages} page{fit.pages === 1 ? "" : "s"}.</p>}
        {papers.some((p) => p.missing) && <Warning>Some questions have no practical yet. They are left out.</Warning>}
        <div className="flex flex-wrap items-center gap-2">
          {papers.length > 1 && papers.map((p) => <button key={p.version} type="button" aria-pressed={version === p.version} onClick={() => setVersion(p.version)} className={`h-10 w-10 rounded-xl border-2 text-sm font-black ${version === p.version ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600"}`}>{p.version}</button>)}
          <div role="radiogroup" aria-label="Preview" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">{[["paper", "Paper"], ["esheet", "E-sheet"], ["key", "Answer key"]].map(([k, name]) => <button key={k} type="button" role="radio" aria-checked={view === k} onClick={() => setView(k)} className={`min-h-9 rounded-lg px-3.5 text-sm font-bold ${view === k ? "bg-white text-primary-dark shadow-sm" : "text-slate-600"}`}>{name}</button>)}</div>
        </div>
        <div className="overflow-x-auto"><PbaPaperPreview paper={papers.find((p) => p.version === version) || papers[0]} mode={view} logoUrl={h.logoUrl} /></div>
        <div className={card}><h2 className="mb-3 text-lg font-black text-slate-900">Download</h2>
          <div className="grid gap-3 sm:grid-cols-3">{[["paper", "Question paper", FileDown], ["esheet", "E-sheet (answer sheet)", Sparkles], ["key", "Answer key", KeyRound]].map(([kind, name, Icon]) => <div key={kind} className="rounded-2xl border border-slate-200 p-3"><p className="mb-2 font-black text-slate-900">{name}</p><div className="flex gap-2"><Button icon={Icon} loading={busy === `${kind}-pdf`} onClick={() => download(kind, "pdf")}>PDF</Button><Button variant="secondary" loading={busy === `${kind}-docx`} onClick={() => download(kind, "docx")}>Word</Button></div></div>)}</div>
          <p className="mt-3 text-xs text-slate-500">The PDF is exact and ready to print. Word can be edited. The answer key is for teachers only. Downloads save the paper first.</p></div>
      </>}
    </>}

    <div className="sticky bottom-0 z-30 -mx-1 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="flex items-center gap-2">
      <Button variant="secondary" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
      <Button variant="secondary" icon={Save} loading={busy === "save"} onClick={saveNow}>{dirty ? "Save" : "Saved"}</Button>
      <span className="ml-auto" />
      {step < 2 && <Button onClick={step === 0 ? goQuestions : goDownload}>{step === 0 ? "Questions" : "Preview"}<ArrowRight className="h-4 w-4" /></Button>}
    </div></div>

    {chooser && <Chooser data={data} slot={chooser.slot} usedIds={usedIds} onPick={pickPractical} onClose={() => setChooser(null)} />}
    {writer && <Writer initial={writer.initial} upload={upload} onSave={saveWritten} onClose={() => setWriter(null)} />}
  </div>;
}
