import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, ExternalLink, Layers, ListChecks, ListTree, Tags } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";
import SubjectPicker from "../paperMaker/SubjectPicker";
import { Toggle, card } from "../paperMaker/ui";
import PbaCategories from "./PbaCategories";
import PbaOverview from "./PbaOverview";
import PbaPracticals from "./PbaPracticals";
import PbaTopics from "./PbaTopics";
import { messageOf } from "./pbaUtils";

const idOf = (value) => value?._id || value || "";
const TABS = [["topics", "Topics", ListTree], ["practicals", "Practicals", ListChecks], ["categories", "Categories", Tags], ["intro", "Introduction", Layers]];

export default function PbaManagement() {
  const [catalog, setCatalog] = useState(null);
  const [subjectId, setSubjectId] = useState(() => { try { return sessionStorage.getItem("pbaSubject") || ""; } catch { return ""; } });
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("topics");
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    Promise.all([axiosInstance.get("/boards"), axiosInstance.get("/classes"), axiosInstance.get("/groups"), axiosInstance.get("/subjects")])
      .then(([boards, classes, groups, subjects]) => setCatalog({
        boards: boards.data.boards || [], classes: classes.data.classes || [], groups: groups.data.groups || [],
        subjects: (subjects.data.subjects || []).map((s) => ({ ...s, board: idOf(s.board), class: idOf(s.class), group: idOf(s.group) })),
      }))
      .catch((error) => setNotice({ type: "error", text: messageOf(error, "Could not load the subjects.") }));
  }, []);

  const reload = useCallback(async () => {
    if (!subjectId) return;
    try { setData((await axiosInstance.get(`/pba-manage/${subjectId}`)).data); }
    catch (error) { setNotice({ type: "error", text: messageOf(error, "Could not load the PBA lists.") }); }
  }, [subjectId]);

  useEffect(() => {
    if (!subjectId) { setData(null); return; }
    try { sessionStorage.setItem("pbaSubject", subjectId); } catch { /* remembering the subject is optional */ }
    setLoading(true); setNotice(null);
    reload().finally(() => setLoading(false));
  }, [subjectId, reload]);

  const notify = useCallback((type, text) => setNotice({ type, text }), []);
  const toggleEnabled = async (enabled) => {
    setSwitching(true);
    try { await axiosInstance.put(`/pba-manage/${subjectId}/enabled`, { enabled }); notify("success", enabled ? "The PBA button is now visible to students." : "The PBA button is hidden from students."); await reload(); }
    catch (error) { notify("error", messageOf(error, "Could not change this setting.")); } finally { setSwitching(false); }
  };
  const counts = useMemo(() => ({ topics: data?.topics.length || 0, practicals: data?.practicals.length || 0, categories: data?.categories.length || 0 }), [data]);
  const subject = catalog?.subjects.find((s) => s._id === subjectId);

  return <div className="mx-auto max-w-5xl space-y-5">
    <AdminPageHeader icon={BookMarked} eyebrow="PBA Prep Lab" title="Practical Based Assessment" description="Choose a subject, turn the PBA button on, then add topics with lecture videos and notes, and the list of practicals students should prepare." />
    {notice && <AdminAlert type={notice.type}>{notice.text}</AdminAlert>}
    <div className={card}>
      <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Subject</p>
      {catalog ? <SubjectPicker catalog={catalog} value={subjectId} onChange={setSubjectId} /> : <AdminLoader label="Loading subjects..." />}
    </div>

    {!subjectId && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Choose a board, group, class and subject to manage its PBA lists.</p>}
    {subjectId && (loading || !data) && <AdminLoader label="Loading PBA lists..." />}
    {subjectId && data && !loading && <>
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div className="min-w-0"><p className="truncate text-lg font-black text-slate-900">{data.subject.name} <span className="text-sm font-bold text-slate-400">· {data.subject.class} · {data.subject.board}</span></p>
          <p className="text-sm text-slate-500">{data.enabled ? "Students see the PBA Prep Lab button on this subject's chapters page." : "Hidden from students until you turn it on."}</p></div>
        <div className="flex flex-wrap items-center gap-4">
          {data.enabled && subject && <a href={`/pba?subjectId=${subjectId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"><ExternalLink className="h-4 w-4" />View student page</a>}
          <span className={switching ? "opacity-60" : ""}><Toggle checked={data.enabled} onChange={toggleEnabled} label={data.enabled ? "PBA button on" : "PBA button off"} /></span>
        </div>
      </div>
      <nav aria-label="PBA sections" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-4">
        {TABS.map(([key, label, Glyph]) => { const TabIcon = Glyph; return <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition ${tab === key ? "bg-primary text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}>
          <TabIcon className="h-4 w-4" />{label}{counts[key] !== undefined && <span className={`rounded-full px-1.5 text-[11px] ${tab === key ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>{counts[key]}</span>}</button>; })}
      </nav>
      {tab === "topics" && <PbaTopics subjectId={subjectId} data={data} reload={reload} notify={notify} />}
      {tab === "practicals" && <PbaPracticals subjectId={subjectId} data={data} reload={reload} notify={notify} />}
      {tab === "categories" && <PbaCategories subjectId={subjectId} data={data} reload={reload} notify={notify} />}
      {tab === "intro" && <PbaOverview key={subjectId} subjectId={subjectId} setting={data.setting} onSaved={reload} notify={notify} />}
    </>}
  </div>;
}
