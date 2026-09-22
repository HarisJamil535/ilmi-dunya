import { useEffect, useState } from "react";
import { BookOpen, Download, ExternalLink, Loader2, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";

const BookViewer = () => {
  const [searchParams] = useSearchParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const subject = searchParams.get("subject") || "Book";
  const isStudentLoggedIn = Boolean(localStorage.getItem("studentToken"));

  useEffect(() => {
    document.title = `${subject.replace(/-/g, " ")} Full Book | IlmiDunya`;
  }, [subject]);

  useEffect(() => {
    const loadBook = async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      ["boardId", "classId", "groupId", "subjectId"].forEach((key) => {
        const value = searchParams.get(key);
        if (value) params.set(key.replace("Id", ""), value);
      });

      try {
        const res = await axiosInstance.get(`/resources/books?${params.toString()}`);
        setBook(res.data.books?.[0] || null);
      } catch {
        setError("Book could not be loaded right now.");
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                <BookOpen className="h-4 w-4" /> Full Book PDF
              </div>
              <h1 className="text-2xl font-black capitalize text-slate-950">{book?.title || subject.replace(/-/g, " ")}</h1>
              <p className="mt-1 text-sm text-slate-500">View the complete book online or download it for offline study.</p>
            </div>
            {book?.pdfUrl && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <a href={book.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">
                  <ExternalLink className="h-4 w-4" /> Open
                </a>
                {isStudentLoggedIn ? (
                  <a href={book.pdfUrl} download className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">
                    <Download className="h-4 w-4" /> Download
                  </a>
                ) : (
                  <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">
                    <Download className="h-4 w-4" /> Login to Download
                  </Link>
                )}
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600">{error}</div>
        ) : !book ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-900">Book not uploaded yet</h2>
            <p className="mt-2 text-sm text-slate-500">Please check again later or explore chapters for this subject.</p>
            <Link to="/subjects" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Browse Subjects</Link>
          </div>
        ) : !book.pdfUrl ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6"><p>Sign in to view and download this book.</p><Link to="/login" state={{ from: `/book?${searchParams}` }} className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-white">Sign in to continue</Link></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <iframe title={book.title} src={book.pdfUrl} className="h-[70vh] min-h-[460px] w-full" />
          </div>
        )}
      </section>
    </main>
  );
};

export default BookViewer;
