import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Trash2, UploadCloud } from "lucide-react";
import axiosInstance from "@/api/axios";
import SmartSelect from "../../shared/CustomSelect";
import { IMPORT_KINDS, detectKind, isWrittenKind, matchTopic } from "./chapterImportMatching";

const COMMIT_BATCH = 150;
let nextId = 0;

const summaryText = (file) => {
  if (file.phase === "checking") return "Checking...";
  if (file.phase === "error") return file.message;
  if (file.phase === "needs-topic") return "Choose a topic for short and long questions.";
  if (file.phase === "importing") return `Importing... ${file.progress || 0}/${file.valid}`;
  if (file.phase === "done") return `Imported ${file.imported}${file.failed ? ` · ${file.failed} failed` : ""}`;
  if (file.phase === "ready") return `${file.valid} ready${file.invalid ? ` · ${file.invalid} skipped` : ""}`;
  return "";
};

/**
 * Upload every Excel file of a chapter at once. Each file goes to the topic whose number
 * is in its name ("2.3 MCQs.xlsx"), and its type comes from words like "short" or "long".
 */
export default function ChapterBulkImport({ context, chapter, topics, onImported }) {
  const [files, setFiles] = useState([]);
  const [defaultKind, setDefaultKind] = useState("standard_mcq");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const input = useRef(null);

  const patch = (id, changes) => setFiles((current) => current.map((file) => file.id === id ? { ...file, ...changes } : file));

  const check = async (file) => {
    if (isWrittenKind(file.kind) && !file.topic) {
      patch(file.id, { phase: "needs-topic", rows: [], valid: 0, invalid: 0 });
      return;
    }
    patch(file.id, { phase: "checking", details: [] });
    try {
      const data = new FormData();
      data.append("file", file.file);
      data.append("context", JSON.stringify({ ...context, topic: file.topic || "" }));
      data.append("kind", file.kind);
      const response = await axiosInstance.post("/questions/import/preview", data, { headers: { "Content-Type": "multipart/form-data" } });
      const preview = response.data.preview || [];
      patch(file.id, {
        phase: "ready",
        rows: preview.filter((item) => item.status === "valid").map((item) => item.row),
        valid: response.data.summary.valid,
        invalid: response.data.summary.invalid,
        details: preview.filter((item) => item.status !== "valid").slice(0, 20).map((item) => `Row ${item.rowNumber}: ${item.errors.join(" ")}`),
      });
    } catch (err) {
      patch(file.id, { phase: "error", message: err.response?.data?.message || "This file could not be read.", rows: [], valid: 0, invalid: 0 });
    }
  };

  const addFiles = async (list) => {
    setResult(null);
    const added = [...list].filter((item) => /\.xlsx$/i.test(item.name)).map((item) => {
      const topic = matchTopic(item.name, topics, chapter?.chapterNumber);
      return { id: ++nextId, file: item, name: item.name, topic: topic?._id || "", autoMatched: Boolean(topic), kind: detectKind(item.name, defaultKind), phase: "checking", rows: [], valid: 0, invalid: 0, details: [] };
    });
    const skipped = list.length - added.length;
    if (skipped) setResult({ type: "error", text: `${skipped} ${skipped === 1 ? "file was" : "files were"} skipped. Only .xlsx Excel files can be uploaded.` });
    setFiles((current) => [...current, ...added]);
    // A few at a time keeps the server responsive for everyone else.
    for (let index = 0; index < added.length; index += 3) await Promise.all(added.slice(index, index + 3).map(check));
  };

  const change = (file, changes) => {
    const next = { ...file, ...changes, autoMatched: changes.topic !== undefined ? false : file.autoMatched };
    patch(file.id, next);
    check(next);
  };

  const ready = files.filter((file) => file.phase === "ready" && file.valid > 0);
  const totalReady = ready.reduce((sum, file) => sum + file.valid, 0);
  const busy = running || files.some((file) => file.phase === "checking");

  const importAll = async () => {
    setRunning(true);
    setResult(null);
    let imported = 0;
    let failed = 0;
    for (const file of ready) {
      patch(file.id, { phase: "importing", progress: 0 });
      let fileImported = 0;
      let fileFailed = 0;
      const errors = [];
      try {
        for (let start = 0; start < file.rows.length; start += COMMIT_BATCH) {
          const { data } = await axiosInstance.post("/questions/import/commit", { rows: file.rows.slice(start, start + COMMIT_BATCH), context: { ...context, topic: file.topic || "" }, kind: file.kind });
          fileImported += data.imported;
          fileFailed += data.failed;
          errors.push(...(data.errors || []).map((item) => `Question ${start + item.rowNumber}: ${item.message}`));
          patch(file.id, { progress: Math.min(start + COMMIT_BATCH, file.rows.length) });
        }
        patch(file.id, { phase: "done", imported: fileImported, failed: fileFailed, details: errors.slice(0, 20) });
      } catch (err) {
        patch(file.id, { phase: "error", message: err.response?.data?.message || "Import stopped. Questions saved so far were kept; upload the file again to add the rest." });
      }
      imported += fileImported;
      failed += fileFailed;
    }
    setRunning(false);
    setResult({ type: failed ? "error" : "success", text: `Imported ${imported} ${imported === 1 ? "question" : "questions"} from ${ready.length} ${ready.length === 1 ? "file" : "files"}${failed ? `. ${failed} could not be saved; see the rows marked below.` : "."}` });
    onImported?.();
  };

  const topicOptions = [{ value: "", label: "No topic (chapter MCQs)" }, ...topics.map((topic) => ({ value: topic._id, label: `${topic.topicNumber} · ${topic.name}` }))];

  return <div className="space-y-4">
    <div className="rounded-2xl bg-primary-soft/60 p-4 text-sm leading-6 text-slate-700">
      <p className="font-black text-slate-900">Name each file with its topic number</p>
      <p>Each file goes to the topic whose number is in its name. Add "short", "long" or "scenario" to the name for those question types:</p>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs">
        {[`${topics[0]?.topicNumber || "2.1"} MCQs.xlsx`, `${topics[0]?.topicNumber || "2.1"} short.xlsx`, `${topics[1]?.topicNumber || "2.2"} long.xlsx`, `${topics[1]?.topicNumber || "2.2"} scenario.xlsx`].map((example) => <span key={example} className="rounded-lg bg-white px-2 py-1 font-bold text-primary-dark ring-1 ring-primary/15">{example}</span>)}
      </div>
      <p className="mt-2 text-xs text-slate-500">Check the matches below before importing; you can change any topic or type. Questions already in the question bank are skipped, so uploading a file again is safe.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
      <button type="button" disabled={running}
        onClick={() => input.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!running) addFiles(event.dataTransfer.files); }}
        className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${dragging ? "border-primary bg-primary-soft" : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary-soft/40"} disabled:opacity-50`}>
        <UploadCloud className="h-7 w-7 text-primary" />
        <span className="text-sm font-black text-slate-800">Drop all Excel files of this chapter here, or click to choose</span>
        <span className="text-xs text-slate-500">You can select many files at once</span>
      </button>
      <label className="block">
        <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">If the name has no type</span>
        <SmartSelect value={defaultKind} onChange={setDefaultKind} options={IMPORT_KINDS} />
      </label>
      <input ref={input} type="file" accept=".xlsx" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
    </div>

    {files.length > 0 && <div className="overflow-hidden rounded-2xl border border-slate-200">
      <ul className="divide-y divide-slate-100">
        {files.map((file) => {
          const bad = ["error", "needs-topic"].includes(file.phase) || (file.phase === "ready" && !file.valid);
          return <li key={file.id} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_170px_minmax(0,1fr)_40px] md:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="min-w-0 break-words text-sm font-bold text-slate-900">{file.name}</span>
            </div>
            <div>
              <SmartSelect value={file.topic} onChange={(topic) => change(file, { topic })} options={topicOptions} disabled={running || file.phase === "done"} searchable />
              {!file.topic && <p className="mt-1 text-xs font-bold text-amber-600">No topic number found in the name.</p>}
            </div>
            <SmartSelect value={file.kind} onChange={(kind) => change(file, { kind })} options={IMPORT_KINDS} disabled={running || file.phase === "done"} />
            <div className="text-xs font-bold">
              <p className={`flex items-center gap-1.5 ${file.phase === "done" ? "text-emerald-700" : bad ? "text-rose-600" : file.phase === "ready" ? "text-slate-700" : "text-slate-500"}`}>
                {["checking", "importing"].includes(file.phase) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : file.phase === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : bad || file.invalid ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                {summaryText(file)}
              </p>
              {file.details?.length > 0 && <details className="mt-1 font-normal text-slate-500"><summary className="cursor-pointer">See {file.phase === "done" ? "failed" : "skipped"} rows</summary><ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">{file.details.map((line) => <li key={line}>{line}</li>)}</ul></details>}
            </div>
            <button type="button" disabled={running} onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} aria-label={`Remove ${file.name}`} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
          </li>;
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 p-3">
        <p className="text-sm font-bold text-slate-600">{files.length} {files.length === 1 ? "file" : "files"} · {totalReady} {totalReady === 1 ? "question" : "questions"} ready</p>
        <div className="flex gap-2">
          <button type="button" disabled={running} onClick={() => { setFiles([]); setResult(null); }} className="rounded-xl px-4 py-2 text-sm font-black text-slate-500 hover:bg-white disabled:opacity-50">Clear list</button>
          <button type="button" disabled={busy || !totalReady} onClick={importAll} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary-dark disabled:opacity-50">
            {running && <Loader2 className="h-4 w-4 animate-spin" />}{running ? "Importing..." : `Import ${totalReady} ${totalReady === 1 ? "question" : "questions"}`}
          </button>
        </div>
      </div>
    </div>}
    {result && <p role="status" className={`rounded-xl p-3 text-sm font-bold ${result.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{result.text}</p>}
  </div>;
}
