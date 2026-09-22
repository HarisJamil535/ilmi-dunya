import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, SearchX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import axiosInstance from "../../api/axios";

const labels = {
  short_questions: "Short Question Notes",
  long_questions: "Long Question Notes",
  mcqs: "MCQs Notes",
};

const ChapterNotes = () => {
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get("chapterId") || "";
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(Boolean(chapterId));
  const [error, setError] = useState("");
  const isStudentLoggedIn = Boolean(localStorage.getItem("studentToken"));

  useEffect(() => {
    document.title = "Chapter Notes | IlmiDunya";
  }, []);

  useEffect(() => {
    const loadNotes = async () => {
      if (!chapterId) return;
      setLoading(true);
      setError("");
      try {
        const res = await axiosInstance.get(`/resources/chapter-notes?chapter=${chapterId}`);
        setNotes(res.data.notes || []);
      } catch {
        setError("Notes could not be loaded right now.");
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [chapterId]);

  const notesByType = Object.keys(labels).map((type) => ({
    type,
    label: labels[type],
    note: notes.find((item) => item.noteType === type),
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-slate-200 pb-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
            <FileText className="h-4 w-4" /> Chapter Notes
          </div>
          <h1 className="text-3xl font-black text-slate-950">Download chapter notes</h1>
          <p className="mt-2 text-sm text-slate-500">Choose short questions, long questions or MCQs notes.</p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600">{error}</div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-900">No notes uploaded yet</h2>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {notesByType.map(({ type, label, note }) => (
              <article key={type} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <FileText className="mb-4 h-8 w-8 text-primary" />
                <h2 className="text-lg font-black text-slate-900">{label}</h2>
                <p className="mt-1 text-sm text-slate-500">{note ? "Ready to view or download." : "Not uploaded yet."}</p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {note ? (
                    <>
                      {note.pdfUrl && <a href={note.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                        <ExternalLink className="h-4 w-4" /> View
                      </a>}
                      {isStudentLoggedIn && note.pdfUrl ? (
                        <a href={note.pdfUrl} download className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">
                          <Download className="h-4 w-4" /> Download
                        </a>
                      ) : (
                        <Link to="/login" state={{ from: `/notes?${searchParams}` }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">
                          <Download className="h-4 w-4" /> Login
                        </Link>
                      )}
                    </>
                  ) : (
                    <button disabled className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-400">Coming Soon</button>
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

export default ChapterNotes;
