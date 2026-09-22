import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, SearchX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import axiosInstance from "../../api/axios";

const PastPapers = () => {
  const [searchParams] = useSearchParams();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isStudentLoggedIn = Boolean(localStorage.getItem("studentToken"));

  useEffect(() => {
    document.title = "Past Papers | IlmiDunya";
  }, []);

  useEffect(() => {
    const loadPapers = async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      ["boardId", "classId", "groupId", "subjectId"].forEach((key) => {
        const value = searchParams.get(key);
        if (value) params.set(key.replace("Id", ""), value);
      });

      try {
        const res = await axiosInstance.get(`/resources/past-papers?${params.toString()}`);
        setPapers(res.data.papers || []);
      } catch {
        setError("Past papers could not be loaded right now.");
      } finally {
        setLoading(false);
      }
    };

    loadPapers();
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-slate-200 pb-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
            <FileText className="h-4 w-4" /> Past Papers
          </div>
          <h1 className="text-3xl font-black text-slate-950">Uploaded past papers</h1>
          <p className="mt-2 text-sm text-slate-500">View and download morning or evening papers by year.</p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600">{error}</div>
        ) : papers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-900">No past papers uploaded yet</h2>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {papers.map((paper) => (
              <article key={paper._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{paper.title}</h2>
                    <div className="mt-2 flex gap-2 text-xs font-bold uppercase">
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">{paper.year}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{paper.session}</span>
                    </div>
                  </div>
                  <FileText className="h-6 w-6 text-slate-300" />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a href={paper.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                    <ExternalLink className="h-4 w-4" /> View
                  </a>
                  {isStudentLoggedIn ? (
                    <a href={paper.pdfUrl} download className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">
                      <Download className="h-4 w-4" /> Download
                    </a>
                  ) : (
                    <Link to="/login" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">
                      <Download className="h-4 w-4" /> Login
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default PastPapers;
