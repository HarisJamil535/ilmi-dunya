import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Download, FileText, Square } from "lucide-react";
import { AdminActionButton, AdminLoader } from "../components/AdminUI";
import { Dialog } from "./CoordUI";
import { api, download, messageOf } from "./coordApi";

const STATUS_DOT = { draft: "bg-amber-400", submitted: "bg-sky-500", approved: "bg-emerald-500" };

// Pick any weeks of a file (one, several or all) and download them as one Word or PDF file,
// one A4 page per week.
export default function DownloadDialog({ fileId, title, weeks: given, onClose }) {
  const [weeks, setWeeks] = useState(given || null);
  const [picked, setPicked] = useState(() => new Set((given || []).map((w) => w.week)));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (given) return;
    api.get(`/files/${fileId}`).then((d) => { setWeeks(d.weeks); setPicked(new Set(d.weeks.map((w) => w.week))); }).catch((e) => setError(messageOf(e)));
  }, [fileId, given]);
  const all = useMemo(() => (weeks || []).map((w) => w.week), [weeks]);
  const toggle = (n) => setPicked((s) => { const next = new Set(s); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  const choose = (filter) => setPicked(new Set((weeks || []).filter(filter).map((w) => w.week)));
  const get = async (format) => {
    setBusy(format); setError("");
    const list = [...picked].sort((a, b) => a - b);
    try { await download(`/files/${fileId}/export?format=${format}${list.length && list.length !== all.length ? `&weeks=${list.join(",")}` : ""}`); onClose(); }
    catch (e) { setError(e.response?.status === 404 ? "There are no weeks to download with these choices." : messageOf(e)); } finally { setBusy(""); }
  };
  const quick = [["All", () => true], ["Approved", (w) => w.status === "approved"], ["Last 4", (w) => all.slice(-4).includes(w.week)], ["None", () => false]];
  return <Dialog title="Download weeks" subtitle={title ? `${title} — tick the weeks you want. They come as one document, one page per week.` : "Tick the weeks you want."} onClose={onClose} busy={Boolean(busy)}
    footer={<><span className="mr-auto self-center text-sm font-bold text-slate-500">{picked.size} week{picked.size === 1 ? "" : "s"} selected</span><AdminActionButton variant="secondary" icon={FileText} loading={busy === "docx"} disabled={!picked.size || Boolean(busy)} onClick={() => get("docx")}>Word</AdminActionButton><AdminActionButton icon={Download} loading={busy === "pdf"} disabled={!picked.size || Boolean(busy)} onClick={() => get("pdf")}>PDF</AdminActionButton></>}>
    {!weeks ? <AdminLoader /> : weeks.length === 0 ? <p className="text-sm text-slate-500">No weeks have been made yet.</p> : <>
      <div className="flex flex-wrap gap-1.5">{quick.map(([label, fn]) => <button key={label} type="button" onClick={() => choose(fn)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary">{label}</button>)}</div>
      <div className="dl-grid">{weeks.map((w) => { const on = picked.has(w.week); return <button key={w.id} type="button" aria-pressed={on} onClick={() => toggle(w.week)} className={`dl-week ${on ? "is-on" : ""}`}>
        {on ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}<span className="text-sm font-black">Week {w.week}</span><span className={`ml-auto h-2 w-2 rounded-full ${STATUS_DOT[w.status]}`} title={w.status} />
      </button>; })}</div>
      <p className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Approved</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />Awaiting approval</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Draft (marked on the page)</span></p>
    </>}
    {error && <p role="alert" className="text-sm font-bold text-rose-600">{error}</p>}
  </Dialog>;
}
