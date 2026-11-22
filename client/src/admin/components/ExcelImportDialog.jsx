import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload, X } from "lucide-react";
import axiosInstance from "../../api/axios";

// Adds many chapters or topics at once from an Excel file.
// 1. Download the sample file and fill it in.  2. Upload it: every row is checked and shown.
// 3. Confirm: only the rows marked "Will be added" are saved. Nothing is saved before step 3.
const STATUS = {
  new: { label: "Will be added", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  exists: { label: "Already added", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  error: { label: "Needs fixing", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export default function ExcelImportDialog({ kind, contextLabel, templateUrl, importUrl, fields, onClose, onImported }) {
  const noun = kind === "chapter" ? "chapter" : "topic";
  const nouns = `${noun}s`;
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const message = (e, fallback) => e?.response?.data?.message || fallback;

  const downloadSample = async () => {
    setBusy("sample"); setError("");
    try {
      const res = await axiosInstance.get(templateUrl, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement("a"), { href: url, download: `${nouns}-sample.xlsx` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setError(message(e, "The sample file could not be downloaded. Please try again.")); }
    finally { setBusy(""); }
  };

  const send = async (chosen, save) => {
    const data = new FormData();
    data.append("file", chosen);
    Object.entries(fields).forEach(([k, v]) => data.append(k, v));
    if (save) data.append("save", "1");
    return (await axiosInstance.post(importUrl, data, { timeout: 60000, headers: { "Content-Type": "multipart/form-data" } })).data;
  };

  const check = async (chosen) => {
    if (!chosen) return;
    if (!/\.xlsx$/i.test(chosen.name)) { setError("Choose an Excel file that ends in .xlsx (for example the sample file). Save .xls or .csv files as .xlsx first."); return; }
    setFile(chosen); setResult(null); setError(""); setBusy("check");
    try { setResult(await send(chosen, false)); }
    catch (e) { setError(message(e, "This file could not be checked. Please try again.")); setFile(null); }
    finally { setBusy(""); }
  };

  const confirm = async () => {
    setBusy("save"); setError("");
    try {
      const saved = await send(file, true);
      setDone(saved);
      onImported?.(saved);
    } catch (e) { setError(message(e, `The ${nouns} could not be added. Please try again.`)); }
    finally { setBusy(""); }
  };

  const reset = () => { setFile(null); setResult(null); setDone(null); setError(""); };
  const s = result?.summary;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="xl-title" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><FileSpreadsheet className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <h3 id="xl-title" className="text-lg font-bold text-slate-900">Add {nouns} from Excel</h3>
            <p className="truncate text-xs text-slate-500">{contextLabel}</p>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-9 w-9" /></span>
              <h4 className="text-xl font-bold text-slate-900">{done.added} {done.added === 1 ? noun : nouns} added</h4>
              <p className="max-w-md text-sm text-slate-500">
                {done.summary.skipped ? `${done.summary.skipped} already existed and ${done.summary.skipped === 1 ? "was" : "were"} skipped. ` : ""}
                {done.summary.errors ? `${done.summary.errors} row${done.summary.errors === 1 ? "" : "s"} had problems and were not added; fix them in the file and upload it again.` : "Everything in the file is now in the list."}
              </p>
            </div>
          ) : (
            <>
              <ol className="grid gap-3 sm:grid-cols-3">
                {[
                  ["1", "Download the sample", `It shows the columns to fill${kind === "topic" ? ". The YouTube link is optional" : ""}.`],
                  ["2", "Fill in your " + nouns, "One per row. Keep the first row (the headings) as it is."],
                  ["3", "Upload and check", "Every row is checked first. Nothing is saved until you confirm."],
                ].map(([n, title, text]) => (
                  <li key={n} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{n}</span>
                    <span><b className="block text-sm text-slate-800">{title}</b><span className="text-xs text-slate-500">{text}</span></span>
                  </li>
                ))}
              </ol>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-violet-50 text-violet-900"><tr>{(kind === "chapter" ? ["Chapter Number", "Chapter Name"] : ["Topic Number", "Topic Name", "Description (optional)", "YouTube Link (optional)"]).map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-bold">{h}</th>)}</tr></thead>
                  <tbody className="text-slate-600">
                    {(kind === "chapter" ? [["1", "Physical Quantities and Measurement"], ["2", "Kinematics"]] : [["1.1", "Introduction to Physics", "What physics is", "https://youtube.com/watch?v=…"], ["1.2", "Physical Quantities", "", ""]]).map((row) => <tr key={row[0]} className="border-t border-slate-100">{row.map((c, i) => <td key={i} className="whitespace-nowrap px-3 py-2">{c || <span className="text-slate-300">empty</span>}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>

              <button type="button" onClick={downloadSample} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
                {busy === "sample" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download sample Excel file
              </button>

              {!result && (
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); check(e.dataTransfer.files?.[0]); }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-primary bg-primary-soft" : "border-slate-300 bg-slate-50 hover:border-primary"}`}
                >
                  {busy === "check" ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-primary" />}
                  <span className="text-sm font-bold text-slate-700">{busy === "check" ? `Checking ${file?.name}…` : "Choose your filled Excel file, or drop it here"}</span>
                  <span className="text-xs text-slate-500">.xlsx · up to 300 rows · 2 MB</span>
                  <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={Boolean(busy)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; check(f); }} />
                </label>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"><FileSpreadsheet className="h-3.5 w-3.5" />{file?.name}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{s.add} to add</span>
                    {s.skipped > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{s.skipped} already added</span>}
                    {s.errors > 0 && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{s.errors} need fixing</span>}
                    <button type="button" onClick={reset} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><RotateCcw className="h-3.5 w-3.5" />Choose another file</button>
                  </div>
                  {s.errors > 0 && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Rows that need fixing will not be added. You can add the others now, then fix those rows in Excel and upload the file again (rows already added are skipped).</p>}
                  <div className="max-h-80 overflow-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">No.</th><th className="px-3 py-2">{kind === "chapter" ? "Chapter" : "Topic"}</th><th className="px-3 py-2">Status</th></tr></thead>
                      <tbody>
                        {result.rows.map((r) => (
                          <tr key={r.line} className={`border-t border-slate-100 align-top ${r.status === "error" ? "bg-rose-50/40" : ""}`}>
                            <td className="px-3 py-2 text-xs text-slate-400">{r.line}</td>
                            <td className="px-3 py-2 font-semibold text-slate-700">{r.number || "—"}</td>
                            <td className="px-3 py-2"><span className="font-semibold text-slate-800">{r.name || <i className="text-slate-400">empty</i>}</span>{r.videoUrl && <span className="block truncate text-xs text-sky-600">▶ {r.videoUrl}</span>}{r.description && <span className="block truncate text-xs text-slate-500">{r.description}</span>}</td>
                            <td className="px-3 py-2"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span>{r.message && <span className="mt-1 block text-xs text-slate-500">{r.message}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          {done ? (
            <>
              <button type="button" onClick={reset} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Upload another file</button>
              <button type="button" onClick={onClose} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark">Done</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirm} disabled={!result || !s?.add || Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
                {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
                {result ? (s.add ? `Add ${s.add} ${s.add === 1 ? noun : nouns}` : `Nothing new to add`) : `Add ${nouns}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
