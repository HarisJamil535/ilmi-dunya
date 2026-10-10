import BookLoader from "../../shared/BookLoader";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, ExternalLink, FileCheck2, SearchX } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import Breadcrumbs from "../components/Breadcrumbs";

export default function AnswerSheetViewer() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [state, setState] = useState({ loading: true, answerSheet: null, error: "" });
  const isLoggedIn = Boolean(localStorage.getItem("studentToken"));

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (searchParams.get("boardId")) params.set("board", searchParams.get("boardId"));
    if (searchParams.get("classId")) params.set("class", searchParams.get("classId"));
    axiosInstance.get(`/resources/answer-sheets?${params}`, { signal: controller.signal })
      .then(({ data }) => {
        const answerSheet = data.answerSheets?.[0] || null;
        if (answerSheet?.title) document.title = `${answerSheet.title} | IlmiDunya`;
        setState({ loading: false, answerSheet, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ loading: false, answerSheet: null, error: error.response?.data?.message || "Answer sheet could not be loaded." });
      });
    return () => controller.abort();
  }, [searchParams]);

  const backParams = new URLSearchParams(searchParams);
  const answerSheet = state.answerSheet;

  return <main className="min-h-[75vh] bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
    <section className="mx-auto max-w-6xl space-y-6">
      <Breadcrumbs items={[{ label: "Chapters", to: `/chapters?${backParams}` }, { label: "Answer Sheet Pattern" }]} />
      <header className="overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-sm">
        <div className="h-1.5 bg-primary" />
        <div className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><FileCheck2 /></span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Board Exam Resource</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{answerSheet?.title || "Answer Sheet Pattern"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Understand the official response layout, margins and answer presentation before exam day.</p></div></div>
          <Link to={`/chapters?${backParams}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"><ArrowLeft size={16} />Back to chapters</Link>
        </div>
      </header>

      {state.loading ? <div className="flex justify-center py-20"><BookLoader size={72} /></div> : state.error ? <div role="alert" className="rounded-xl bg-rose-50 p-5 text-center text-sm font-bold text-rose-700">{state.error}</div> : !answerSheet ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><SearchX className="mx-auto text-slate-400" /><h2 className="mt-3 text-lg font-black text-slate-950">Answer sheet not available</h2><p className="mt-2 text-sm text-slate-500">No pattern has been uploaded for this board and class.</p></div> : !answerSheet.pdfUrl ? <div className="rounded-2xl border border-primary/15 bg-white p-7 text-center shadow-sm"><FileCheck2 className="mx-auto text-primary" size={36} /><h2 className="mt-4 text-xl font-black text-slate-950">Sign in to view the answer sheet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">The resource is available for your board and class. Sign in to open or download the PDF.</p><Link to="/login" state={{ from: `${location.pathname}${location.search}` }} className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-black text-white">Sign in to continue</Link></div> : <>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"><p className="text-sm font-semibold text-slate-600">Preview the pattern below or open the full PDF in a new tab.</p><div className="flex gap-2"><a href={answerSheet.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><ExternalLink size={16} />Open PDF</a>{isLoggedIn && <a href={answerSheet.pdfUrl} download className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"><Download size={16} />Download</a>}</div></div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><iframe title={answerSheet.title} src={answerSheet.pdfUrl} className="h-[72vh] min-h-[520px] w-full" /></div>
      </>}
    </section>
  </main>;
}
