import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import axiosInstance from "../../api/axios";
import Spinner from "../../shared/Spinner";

const when = (d) => (d ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(d)) : "");
const Row = ({ label, value }) => (value ? <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800"><dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt><dd className="text-right text-sm font-bold text-slate-900 dark:text-white">{value}</dd></div> : null);

// Opened by the QR code on an approved Weekly Subject Coordination Meeting Record.
export default function VerifyCoordination() {
  const { code = "" } = useParams();
  const [state, setState] = useState({ loading: true, record: null, error: "" });
  useEffect(() => { document.title = "Verify a coordination record | IlmiDunya"; }, []);
  useEffect(() => {
    const controller = new AbortController();
    axiosInstance.get(`/verify/coordination/${encodeURIComponent(code)}`, { signal: controller.signal })
      .then(({ data }) => setState({ loading: false, record: data.record, error: "" }))
      .catch((e) => { if (!controller.signal.aborted) setState({ loading: false, record: null, error: e.response?.data?.message || "This record could not be checked right now." }); });
    return () => controller.abort();
  }, [code]);
  const r = state.record;
  return <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-12">
    {state.loading ? <div className="flex justify-center"><Spinner /></div> : <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`grid h-12 w-12 place-items-center rounded-2xl ${r?.valid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{r?.valid ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}</span>
        <div><h1 className="text-xl font-black text-slate-900 dark:text-white">{r?.valid ? "Genuine coordination record" : r ? "Record changed after approval" : "Record not found"}</h1><p className="text-sm text-slate-500">{r?.message || state.error}</p></div>
      </div>
      {r && <dl className="mt-5">
        <Row label="Subject" value={r.subject} /><Row label="Class" value={r.className} /><Row label="Session" value={r.session} />
        <Row label="Week" value={`${r.week}${r.term ? ` (${r.term})` : ""}`} />
        <Row label="Signed by Subject Coordinator" value={r.coordinator && `${r.coordinator.name} · ${when(r.coordinator.at)}`} />
        <Row label="Approved by Section Head" value={r.sectionHead && `${r.sectionHead.name} · ${when(r.sectionHead.at)}`} />
      </dl>}
    </section>}
  </main>;
}
