import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import axiosInstance from "@/api/axios";
import CustomSelect from "../../shared/CustomSelect";
import { ConfirmDelete } from "./ConfirmDelete";
import { Button, Field, Pill, card, input } from "../paperMaker/ui";
import BlockEditor from "./BlockEditor";
import PartsEditor from "./PartsEditor";
import { Dialog, LinkDots, MoveButtons } from "./pbaUi";
import { messageOf, moved, totalMarks } from "./pbaUtils";

const blank = () => ({ title: "", label: "", summary: "", videoUrl: "", notesUrl: "", topic: "", category: "", blocks: [], parts: [], marks: 0, answerVisible: false });
const TABS = [["details", "Details"], ["question", "Question"], ["links", "Video and notes"]];

// Exam-style practical tasks. Each can belong to a topic and a category, and carries a video and notes.
export default function PbaPracticals({ subjectId, data, reload, notify }) {
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("details");
  const [newCategory, setNewCategory] = useState("");
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = `/pba-manage/${subjectId}`;
  const topicName = (id) => data.topics.find((t) => t._id === id)?.title || "";
  const categoryName = (id) => data.categories.find((c) => c._id === id)?.name || "";
  const filtering = Boolean(query.trim() || topicFilter || categoryFilter);
  const shown = useMemo(() => data.practicals.filter((p) => (!topicFilter || p.topic === topicFilter) && (!categoryFilter || p.category === categoryFilter) && (!query.trim() || [p.title, p.label, p.summary, topicName(p.topic), categoryName(p.category)].join(" ").toLowerCase().includes(query.trim().toLowerCase()))), [data, query, topicFilter, categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (job, ok) => { setBusy(true); try { await job(); if (ok) notify("success", ok); await reload(); return true; } catch (error) { notify("error", messageOf(error, "That did not work. Please try again.")); return false; } finally { setBusy(false); } };

  const save = async () => {
    if (await run(async () => {
      let category = form.category;
      if (category === "__new") { category = (await axiosInstance.post(`${base}/categories`, { name: newCategory })).data.category._id; }
      const body = { ...form, category };
      await (form._id ? axiosInstance.put(`${base}/practicals/${form._id}`, body) : axiosInstance.post(`${base}/practicals`, body));
    }, form._id ? "Practical saved." : "Practical added.")) { setForm(null); setNewCategory(""); }
  };
  const move = (from, to) => run(() => axiosInstance.post(`${base}/reorder`, { kind: "practicals", ids: moved(data.practicals, from, to).map((p) => p._id) }));
  const remove = async () => { if (await run(() => axiosInstance.delete(`${base}/practicals/${removing._id}`), "Practical deleted.")) setRemoving(null); };
  // Pictures for questions go to this subject's media; the server checks size and type.
  const upload = async (file) => {
    const body = new FormData(); body.append("image", file);
    try { return (await axiosInstance.post(`${base}/image`, body, { headers: { "Content-Type": "multipart/form-data" } })).data.url; }
    catch (error) { throw new Error(messageOf(error, "The picture could not be uploaded.")); }
  };
  const topicOptions = data.topics.map((t) => ({ value: t._id, label: t.title }));
  const categoryOptions = data.categories.map((c) => ({ value: c._id, label: c.name }));

  return <div className="space-y-4">
    <div className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">Practicals</h3><p className="text-sm text-slate-500">Exam-style tasks, each with a lecture video and notes. Link each one to a topic and a category.</p></div>
        <Button icon={Plus} onClick={() => { setTab("details"); setForm(blank()); }}>Add practical</Button></div>
      {data.practicals.length > 0 && <div className="grid gap-2 sm:grid-cols-3">
        <label className="relative sm:col-span-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${input} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search practicals" aria-label="Search practicals" /></label>
        <CustomSelect value={topicFilter} onChange={setTopicFilter} options={topicOptions} placeholder="All topics" />
        <CustomSelect value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" />
      </div>}
    </div>
    {!data.practicals.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No practicals yet.</p> : !shown.length ? <p className="rounded-2xl bg-white p-8 text-center text-slate-500">No practicals match.</p> : <ol className="space-y-2.5">{shown.map((p) => { const index = data.practicals.findIndex((x) => x._id === p._id); return <li key={p._id} className={`${card} flex flex-wrap items-center gap-3 !p-3 sm:!p-4`}>
      <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-slate-900 px-1 text-xs font-black text-white">{index + 1}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">{p.title}</p><p className="mt-1 flex flex-wrap items-center gap-1.5">{p.topic && <Pill tone="violet">{topicName(p.topic)}</Pill>}{p.category && <Pill tone="green">{categoryName(p.category)}</Pill>}{p.label && <Pill>{p.label}</Pill>}{p.marks > 0 && <Pill tone="amber">{p.marks} marks</Pill>}{p.hasQuestion && <Pill tone="green">Question added</Pill>}</p></div>
      <LinkDots videoUrl={p.videoUrl} notesUrl={p.notesUrl} />
      <div className="flex items-center">
        {!filtering && <MoveButtons index={index} count={data.practicals.length} onMove={move} label={p.title} />}
        <button type="button" aria-label={`Edit ${p.title}`} onClick={() => { setTab("details"); setForm({ ...p, blocks: p.blocks || [], parts: p.parts || [] }); }} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
        <button type="button" aria-label={`Delete ${p.title}`} onClick={() => setRemoving(p)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>; })}</ol>}
    {filtering && data.practicals.length > 1 && <p className="text-center text-xs text-slate-400">Clear the search and filters to change the order.</p>}

    {form && <Dialog wide title={form._id ? "Edit practical" : "Add a practical"} busy={busy} onClose={() => setForm(null)}
      footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button loading={busy} disabled={!form.title.trim() || (form.category === "__new" && !newCategory.trim())} onClick={save}>{form._id ? "Save practical" : "Add practical"}</Button></>}>
      <div role="tablist" aria-label="Practical sections" className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-9 rounded-lg px-4 text-sm font-bold transition ${tab === key ? "bg-white text-primary-dark shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{label}</button>)}</div>
      {tab === "details" && <div className="space-y-4">
        <Field label="Practical title"><input autoFocus className={input} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Build a personal portfolio page" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Topic</span><CustomSelect value={form.topic} onChange={(value) => setForm({ ...form, topic: value })} options={topicOptions} placeholder="No topic" /></div>
          <div><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Category</span><CustomSelect value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={[...categoryOptions, { value: "__new", label: "+ New category..." }]} placeholder="No category" /></div>
        </div>
        {form.category === "__new" && <Field label="New category name"><input className={input} maxLength={60} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Business plan" /></Field>}
        <Field label="Badge (optional)" hint='A short tag such as "Section A - Q2 - 6 marks" or an SLO code.'><input className={input} maxLength={80} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
        <Field label="Short description (optional)"><textarea className={`${input} min-h-20 py-2`} maxLength={400} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
      </div>}
      {tab === "question" && <div className="space-y-5">
        <p className="rounded-xl bg-primary-soft/50 p-3 text-sm text-slate-700">Write the question exactly as it should appear in a paper: text, code, pictures, tables and labelling pictures, then split it into parts with their marks. Papers made in the Paper Maker use this content.</p>
        <div><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Question (shown before the parts)</p><BlockEditor blocks={form.blocks} onChange={(blocks) => setForm({ ...form, blocks })} upload={upload} label="question" /></div>
        <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Parts</p>{form.parts.length === 0 && <label className="flex items-center gap-2 text-sm font-bold text-slate-600">Total marks<input type="number" min="0" max="100" step="0.5" className={`${input} w-24`} value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></label>}</div>
          <PartsEditor parts={form.parts} onChange={(parts) => setForm({ ...form, parts, marks: totalMarks(parts) })} upload={upload} /></div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={form.answerVisible} onChange={(e) => setForm({ ...form, answerVisible: e.target.checked })} className="mt-0.5 h-5 w-5 accent-[var(--color-primary)]" /><span><span className="block text-sm font-black text-slate-800">Let students see the model answer</span><span className="text-xs text-slate-500">Off by default. When on, students can open the answers you wrote on the practical's page.</span></span></label>
      </div>}
      {tab === "links" && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lecture video (YouTube link)"><input className={input} maxLength={500} value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtu.be/..." /></Field>
        <Field label="Notes (PDF link)"><input className={input} maxLength={1000} value={form.notesUrl} onChange={(e) => setForm({ ...form, notesUrl: e.target.value })} placeholder="https://drive.google.com/..." /></Field>
      </div>}
    </Dialog>}
    <ConfirmDelete item={removing} title="Delete this practical?" detail={removing ? `"${removing.title}" will be removed for students.` : ""} busy={busy} onClose={() => setRemoving(null)} onConfirm={remove} />
  </div>;
}
