import { useState } from "react";
import { ChevronRight, ClipboardPaste, Pencil, Plus, Trash2 } from "lucide-react";
import axiosInstance from "@/api/axios";
import { ConfirmDelete } from "./ConfirmDelete";
import { Button, Field, Pill, card, input } from "../paperMaker/ui";
import { Dialog, LinkDots, MoveButtons } from "./pbaUi";
import { messageOf, moved } from "./pbaUtils";

const fieldsOf = (topic, subtopics) => ({ title: topic.title, summary: topic.summary, videoUrl: topic.videoUrl, notesUrl: topic.notesUrl, subtopics: subtopics.map(({ _id, title, summary, videoUrl, notesUrl }) => ({ _id, title, summary, videoUrl, notesUrl })) });

// Topics (HTML, CSS, Flowcharts...) with their subtopics. Each subtopic holds a lecture video and a notes link.
export default function PbaTopics({ subjectId, data, reload, notify }) {
  const [open, setOpen] = useState(() => new Set());
  const [topicForm, setTopicForm] = useState(null);
  const [subForm, setSubForm] = useState(null);
  const [bulk, setBulk] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = `/pba-manage/${subjectId}`;
  const run = async (job, ok) => { setBusy(true); try { await job(); if (ok) notify("success", ok); await reload(); return true; } catch (error) { notify("error", messageOf(error, "That did not work. Please try again.")); return false; } finally { setBusy(false); } };
  const toggle = (id) => setOpen((set) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const saveTopic = async () => { if (await run(() => (topicForm._id ? axiosInstance.put(`${base}/topics/${topicForm._id}`, topicForm) : axiosInstance.post(`${base}/topics`, topicForm)), topicForm._id ? "Topic saved." : "Topic added.")) setTopicForm(null); };
  const moveTopic = (from, to) => run(() => axiosInstance.post(`${base}/reorder`, { kind: "topics", ids: moved(data.topics, from, to).map((t) => t._id) }));
  const removeTopic = async () => { if (await run(() => axiosInstance.delete(`${base}/topics/${removing._id}`), "Topic deleted.")) setRemoving(null); };
  const saveSubtopics = (topic, subtopics, ok) => run(() => axiosInstance.put(`${base}/topics/${topic._id}`, fieldsOf(topic, subtopics)), ok);
  const saveSub = async () => {
    const { topic, index, ...sub } = subForm;
    const list = index === undefined ? [...topic.subtopics, sub] : topic.subtopics.map((s, i) => (i === index ? { ...s, ...sub } : s));
    if (await saveSubtopics(topic, list, index === undefined ? "Subtopic added." : "Subtopic saved.")) { setSubForm(null); setOpen((set) => new Set(set).add(topic._id)); }
  };
  const saveBulk = async () => {
    const rows = bulk.text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [title, videoUrl = "", notesUrl = ""] = line.split("|").map((part) => part.trim()); return { title, videoUrl, notesUrl, summary: "" }; });
    if (!rows.length) return;
    if (await saveSubtopics(bulk.topic, [...bulk.topic.subtopics, ...rows], `${rows.length} subtopic${rows.length > 1 ? "s" : ""} added.`)) { setOpen((set) => new Set(set).add(bulk.topic._id)); setBulk(null); }
  };

  return <div className="space-y-4">
    <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
      <div><h3 className="text-lg font-black text-slate-900">Topics</h3><p className="text-sm text-slate-500">Lessons students study first. Open a topic to add subtopics with a lecture video and notes.</p></div>
      <Button icon={Plus} onClick={() => setTopicForm({ title: "", summary: "", videoUrl: "", notesUrl: "" })}>Add topic</Button>
    </div>
    {!data.topics.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No topics yet. Add the first one, for example HTML, CSS or Flowcharts.</p>}
    {data.topics.map((topic, index) => {
      const expanded = open.has(topic._id);
      return <section key={topic._id} className={`${card} !p-0`}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          <button type="button" aria-expanded={expanded} onClick={() => toggle(topic._id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-black text-primary-dark">{index + 1}</span>
            <span className="min-w-0"><span className="block truncate text-base font-black text-slate-900">{topic.title}</span><span className="text-xs text-slate-500">{topic.subtopics.length} subtopic{topic.subtopics.length === 1 ? "" : "s"}</span></span>
            <ChevronRight className={`ml-auto h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90 text-primary" : ""}`} />
          </button>
          <div className="flex items-center">
            <MoveButtons index={index} count={data.topics.length} onMove={moveTopic} label={topic.title} />
            <button type="button" aria-label={`Edit ${topic.title}`} onClick={() => setTopicForm({ ...topic })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
            <button type="button" aria-label={`Delete ${topic.title}`} onClick={() => setRemoving(topic)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        {expanded && <div className="space-y-3 border-t border-slate-100 p-3 sm:p-4 animate-in fade-in slide-in-from-top-1">
          {(topic.videoUrl || topic.notesUrl) && <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">Whole topic: <LinkDots videoUrl={topic.videoUrl} notesUrl={topic.notesUrl} /></p>}
          {!topic.subtopics.length ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No subtopics yet.</p> : <ol className="space-y-2">{topic.subtopics.map((sub, i) => <li key={sub._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2.5 pl-3">
            <span className="w-6 text-xs font-black text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{sub.title}</span>{sub.summary && <span className="block truncate text-xs text-slate-500">{sub.summary}</span>}</span>
            <LinkDots videoUrl={sub.videoUrl} notesUrl={sub.notesUrl} />
            <MoveButtons index={i} count={topic.subtopics.length} onMove={(from, to) => saveSubtopics(topic, moved(topic.subtopics, from, to))} label={sub.title} />
            <button type="button" aria-label={`Edit ${sub.title}`} onClick={() => setSubForm({ topic, index: i, ...sub })} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
            <button type="button" aria-label={`Delete ${sub.title}`} onClick={() => { if (window.confirm(`Delete the subtopic "${sub.title}"?`)) saveSubtopics(topic, topic.subtopics.filter((_, j) => j !== i), "Subtopic deleted."); }} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
          </li>)}</ol>}
          <div className="flex flex-wrap gap-2"><Button variant="secondary" icon={Plus} onClick={() => setSubForm({ topic, title: "", summary: "", videoUrl: "", notesUrl: "" })}>Add subtopic</Button><Button variant="secondary" icon={ClipboardPaste} onClick={() => setBulk({ topic, text: "" })}>Paste many</Button></div>
        </div>}
      </section>;
    })}

    {topicForm && <Dialog title={topicForm._id ? "Edit topic" : "Add a topic"} hint="For example HTML, CSS, JavaScript, Flowcharts or Concept maps." busy={busy} onClose={() => setTopicForm(null)}
      footer={<><Button variant="secondary" onClick={() => setTopicForm(null)}>Cancel</Button><Button loading={busy} disabled={!topicForm.title.trim()} onClick={saveTopic}>{topicForm._id ? "Save topic" : "Add topic"}</Button></>}>
      <Field label="Topic name"><input autoFocus className={input} maxLength={140} value={topicForm.title} onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })} placeholder="e.g. HTML" /></Field>
      <Field label="Short description (optional)"><textarea className={`${input} min-h-20 py-2`} maxLength={400} value={topicForm.summary} onChange={(e) => setTopicForm({ ...topicForm, summary: e.target.value })} /></Field>
      <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-bold text-slate-700">A video and notes for the whole topic (optional)</summary>
        <div className="mt-3 space-y-3"><Field label="YouTube video link"><input className={input} maxLength={500} value={topicForm.videoUrl} onChange={(e) => setTopicForm({ ...topicForm, videoUrl: e.target.value })} placeholder="https://youtu.be/..." /></Field><Field label="Notes PDF link"><input className={input} maxLength={1000} value={topicForm.notesUrl} onChange={(e) => setTopicForm({ ...topicForm, notesUrl: e.target.value })} placeholder="https://..." /></Field></div></details>
    </Dialog>}

    {subForm && <Dialog title={subForm.index === undefined ? `Add a subtopic to ${subForm.topic.title}` : "Edit subtopic"} busy={busy} onClose={() => setSubForm(null)}
      footer={<><Button variant="secondary" onClick={() => setSubForm(null)}>Cancel</Button><Button loading={busy} disabled={!subForm.title.trim()} onClick={saveSub}>{subForm.index === undefined ? "Add subtopic" : "Save subtopic"}</Button></>}>
      <Field label="Subtopic name"><input autoFocus className={input} maxLength={140} value={subForm.title} onChange={(e) => setSubForm({ ...subForm, title: e.target.value })} placeholder="e.g. HTML tables" /></Field>
      <Field label="Short description (optional)"><input className={input} maxLength={240} value={subForm.summary} onChange={(e) => setSubForm({ ...subForm, summary: e.target.value })} /></Field>
      <Field label="Lecture video (YouTube link)" hint="Leave empty if there is no video yet; the button stays hidden for students."><input className={input} maxLength={500} value={subForm.videoUrl} onChange={(e) => setSubForm({ ...subForm, videoUrl: e.target.value })} placeholder="https://youtu.be/..." /></Field>
      <Field label="Notes (PDF link)"><input className={input} maxLength={1000} value={subForm.notesUrl} onChange={(e) => setSubForm({ ...subForm, notesUrl: e.target.value })} placeholder="https://drive.google.com/..." /></Field>
    </Dialog>}

    {bulk && <Dialog title={`Paste many subtopics into ${bulk.topic.title}`} hint="One per line. You can add the links too, separated by | (video first, then notes)." busy={busy} onClose={() => setBulk(null)}
      footer={<><Button variant="secondary" onClick={() => setBulk(null)}>Cancel</Button><Button loading={busy} disabled={!bulk.text.trim()} onClick={saveBulk}>Add subtopics</Button></>}>
      <textarea autoFocus className={`${input} min-h-48 py-2 font-mono text-[13px]`} value={bulk.text} onChange={(e) => setBulk({ ...bulk, text: e.target.value })} placeholder={"HTML tags\nTables | https://youtu.be/abc | https://drive.google.com/file/d/..\nHeadings"} aria-label="Subtopics, one per line" />
      <Pill>{bulk.text.split("\n").filter((line) => line.trim()).length} lines</Pill>
    </Dialog>}

    <ConfirmDelete item={removing} title="Delete this topic?" detail={removing ? `"${removing.title}" and its ${removing.subtopics.length} subtopic(s) will be removed. Practicals linked to it stay, but lose their topic.` : ""} busy={busy} onClose={() => setRemoving(null)} onConfirm={removeTopic} />
  </div>;
}
