import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, CalendarDays, FileSearch, School, ShieldAlert, ShieldCheck } from "lucide-react";
import axiosInstance from "../../api/axios";
import Spinner from "../../shared/Spinner";

const dateTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th"}`;
const KIND = { report: "Result report", cards: "Student report cards", card: "Student report card" };

const Row = ({ label, value }) => value || value === 0 ? <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800"><dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt><dd className="text-right text-sm font-bold text-slate-900 dark:text-white">{value}</dd></div> : null;

// Public page that confirms a printed IlmiDunya result report or report card is genuine.
const VerifyDocument = () => {
  const { reference = "" } = useParams();
  // Remounting per reference resets the typed value and the previous answer.
  return <VerifyView key={reference} reference={reference} />;
};

const VerifyView = ({ reference }) => {
  const navigate = useNavigate();
  const [input, setInput] = useState(reference);
  const [result, setResult] = useState({ document: null, error: "" });
  const [done, setDone] = useState(!reference);

  useEffect(() => { document.title = "Verify a result document | IlmiDunya"; }, []);

  useEffect(() => {
    if (!reference) return undefined;
    const controller = new AbortController();
    axiosInstance.get(`/verify/${encodeURIComponent(reference)}`, { signal: controller.signal })
      .then(({ data }) => { setResult({ document: data.document, error: "" }); setDone(true); })
      .catch((error) => { if (!controller.signal.aborted) { setResult({ document: null, error: error.response?.status === 404 ? "not-found" : error.response?.data?.message || "Could not check right now. Please try again." }); setDone(true); } });
    return () => controller.abort();
  }, [reference]);

  const state = { loading: !done, ...result };

  const check = (event) => {
    event.preventDefault();
    const value = input.trim().toUpperCase();
    if (value) navigate(`/verify/${value}`);
  };

  const doc = state.document;
  const scope = doc ? [doc.className || "All classes", doc.sectionName || "All sections"].join(" · ") : "";

  return <main className="min-h-[70vh] bg-slate-50 px-4 py-10 dark:bg-slate-950 sm:py-16">
    <section className="mx-auto max-w-xl">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck size={28} /></span>
        <h1 className="mt-4 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Verify a result document</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Enter the reference printed at the bottom of an IlmiDunya result report or report card, or scan its QR code.</p>
      </div>

      <form onSubmit={check} className="mt-6 flex gap-2">
        <label htmlFor="verify-reference" className="sr-only">Reference</label>
        <input id="verify-reference" value={input} onChange={(event) => setInput(event.target.value)} placeholder="IDR-261025-K7Q2MX" autoComplete="off" spellCheck="false"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 font-mono text-sm font-bold uppercase tracking-wider text-slate-800 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-white transition hover:brightness-110"><FileSearch size={17} /> Check</button>
      </form>

      <div className="mt-6" aria-live="polite">
        {state.loading && <div className="flex justify-center py-10"><Spinner /></div>}
        {state.error === "not-found" && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/40">
          <ShieldAlert className="mx-auto text-rose-600" size={30} />
          <p className="mt-3 font-black text-rose-800 dark:text-rose-200">No document found</p>
          <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">IlmiDunya has not issued a document with this reference. Check the characters carefully; if it still does not match, the document may not be genuine.</p>
        </div>}
        {state.error && state.error !== "not-found" && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-center text-sm font-bold text-amber-800">{state.error}</p>}
        {doc && <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-900 dark:bg-slate-900">
          <header className="flex items-center gap-3 bg-emerald-600 px-5 py-4 text-white">
            <BadgeCheck size={26} />
            <div><p className="font-black">Genuine IlmiDunya document</p><p className="text-xs text-emerald-50">{KIND[doc.kind]} · {doc.reference}</p></div>
          </header>
          <dl className="px-5 py-2">
            {doc.kind === "card" && <>
              <Row label="Student" value={doc.student} />
              <Row label="Class" value={[doc.studentClass, doc.studentSection].filter(Boolean).join(" · ")} />
              <Row label="Overall result" value={`${doc.average}% · Grade ${doc.grade}`} />
              <Row label="Position" value={doc.position ? `${ordinal(doc.position)} of ${doc.outOf}` : ""} />
              <Row label="Tests · attempts" value={`${doc.tests} · ${doc.attempts}`} />
            </>}
            <Row label="School" value={doc.schoolName} />
            {doc.kind !== "card" && <Row label="Class and section" value={scope} />}
            <Row label="Subject" value={doc.subjectName || "All subjects"} />
            <Row label="Report period" value={doc.period} />
            {doc.kind !== "card" && <>
              <Row label="Students who took tests" value={`${doc.studentsAttempted} of ${doc.students}`} />
              <Row label="Completed attempts" value={doc.attempts} />
              <Row label="Average score" value={`${doc.average}%`} />
              <Row label="Pass rate" value={`${doc.passRate}%`} />
              {doc.cards > 0 && <Row label="Report cards issued" value={doc.cards} />}
            </>}
          </dl>
          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> Issued {dateTime.format(new Date(doc.issuedAt))}</span>
            <span className="inline-flex items-center gap-1.5"><School size={14} /> Compare these details with the printed copy.</span>
          </footer>
        </article>}
      </div>
    </section>
  </main>;
};

export default VerifyDocument;
