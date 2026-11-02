import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import axiosInstance from "@/api/axios";
import { Button, Field, card, input } from "../paperMaker/ui";
import { messageOf } from "./pbaUtils";

// The box at the top of the student page: a short text, a few facts and official links.
export default function PbaOverview({ subjectId, setting, onSaved, notify }) {
  const [intro, setIntro] = useState(setting.intro || "");
  const [facts, setFacts] = useState(setting.facts?.length ? setting.facts : []);
  const [links, setLinks] = useState(setting.links?.length ? setting.links : []);
  const [busy, setBusy] = useState(false);
  const change = (setter) => (index, patch) => setter((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const save = async () => {
    setBusy(true);
    try { await axiosInstance.put(`/pba-manage/${subjectId}/setting`, { intro, facts, links }); notify("success", "The introduction was saved."); onSaved(); }
    catch (error) { notify("error", messageOf(error, "Could not save the introduction.")); } finally { setBusy(false); }
  };
  return <div className={`${card} space-y-6`}>
    <div><h3 className="text-lg font-black text-slate-900">Introduction box</h3><p className="text-sm text-slate-500">Shown at the top of the student page. Everything here is optional.</p></div>
    <Field label="Short introduction"><textarea className={`${input} min-h-24 py-2`} maxLength={1200} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="What PBA is and how students should use this page" /></Field>
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Key facts (up to 8)</p>
      <div className="space-y-2">{facts.map((fact, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input className={input} aria-label="Fact name" placeholder="e.g. Total marks" maxLength={40} value={fact.label} onChange={(e) => change(setFacts)(i, { label: e.target.value })} /><input className={input} aria-label="Fact value" placeholder="e.g. 30" maxLength={80} value={fact.value} onChange={(e) => change(setFacts)(i, { value: e.target.value })} /><Button variant="danger" aria-label="Remove fact" onClick={() => setFacts((list) => list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
      <Button variant="secondary" className="mt-2" icon={Plus} disabled={facts.length >= 8} onClick={() => setFacts((list) => [...list, { label: "", value: "" }])}>Add a fact</Button>
    </div>
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Official links (up to 6)</p>
      <div className="space-y-2">{links.map((link, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"><input className={input} aria-label="Link title" placeholder="e.g. FBISE assessment framework" maxLength={100} value={link.title} onChange={(e) => change(setLinks)(i, { title: e.target.value })} /><input className={input} aria-label="Link address" placeholder="https://..." maxLength={1000} value={link.url} onChange={(e) => change(setLinks)(i, { url: e.target.value })} /><Button variant="danger" aria-label="Remove link" onClick={() => setLinks((list) => list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
      <Button variant="secondary" className="mt-2" icon={Plus} disabled={links.length >= 6} onClick={() => setLinks((list) => [...list, { title: "", url: "" }])}>Add a link</Button>
    </div>
    <Button icon={Save} loading={busy} onClick={save}>Save introduction</Button>
  </div>;
}
