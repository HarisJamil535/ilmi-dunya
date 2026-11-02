import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { ConfirmDelete } from "./ConfirmDelete";
import { Button, Pill, card, input } from "../paperMaker/ui";
import { MoveButtons } from "./pbaUi";
import { messageOf, moved } from "./pbaUtils";

// The kinds of practical question for this subject, such as "Error correction" or "Concept map".
export default function PbaCategories({ subjectId, data, reload, notify }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const count = (id) => data.practicals.filter((p) => p.category === id).length;
  const run = async (job, ok) => { setBusy(true); try { await job(); if (ok) notify("success", ok); await reload(); } catch (error) { notify("error", messageOf(error, "That did not work. Please try again.")); } finally { setBusy(false); } };
  const add = () => run(async () => { await axiosInstance.post(`/pba-manage/${subjectId}/categories`, { name }); setName(""); }, "Category added.");
  const rename = (id) => run(async () => { await axiosInstance.put(`/pba-manage/${subjectId}/categories/${id}`, { name: draft }); setEditing(null); }, "Category renamed.");
  const move = (from, to) => run(() => axiosInstance.post(`/pba-manage/${subjectId}/reorder`, { kind: "categories", ids: moved(data.categories, from, to).map((c) => c._id) }));
  const remove = () => run(async () => { await axiosInstance.delete(`/pba-manage/${subjectId}/categories/${removing._id}`); setRemoving(null); }, "Category deleted.");
  return <div className={`${card} space-y-5`}>
    <div><h3 className="text-lg font-black text-slate-900">Question categories</h3><p className="text-sm text-slate-500">Tag each practical with its kind, for example Error correction, HTML code, CSS code, Image labelling or Concept map. Students can filter by these.</p></div>
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add(); }}>
      <input className={`${input} min-w-56 flex-1`} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" aria-label="New category name" />
      <Button icon={Plus} loading={busy} disabled={!name.trim()} onClick={add}>Add category</Button>
    </form>
    {!data.categories.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No categories yet.</p> : <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">{data.categories.map((category, index) => <li key={category._id} className="flex flex-wrap items-center gap-3 p-3">
      {editing === category._id ? <>
        <input autoFocus className={`${input} min-w-48 flex-1`} maxLength={60} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && draft.trim() && rename(category._id)} aria-label="Category name" />
        <Button icon={Check} loading={busy} disabled={!draft.trim()} onClick={() => rename(category._id)}>Save</Button><Button variant="ghost" icon={X} onClick={() => setEditing(null)}>Cancel</Button>
      </> : <>
        <span className="min-w-0 flex-1 font-bold text-slate-800">{category.name}</span><Pill>{count(category._id)} practical{count(category._id) === 1 ? "" : "s"}</Pill>
        <MoveButtons index={index} count={data.categories.length} onMove={move} label={category.name} />
        <button type="button" aria-label={`Rename ${category.name}`} onClick={() => { setEditing(category._id); setDraft(category.name); }} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
        <button type="button" aria-label={`Delete ${category.name}`} onClick={() => setRemoving(category)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
      </>}
    </li>)}</ul>}
    <ConfirmDelete item={removing} title="Delete this category?" detail={removing && count(removing._id) ? `${count(removing._id)} practical(s) still use it, so it cannot be deleted until they move to another category.` : "This cannot be undone."} busy={busy} onClose={() => setRemoving(null)} onConfirm={remove} />
  </div>;
}
