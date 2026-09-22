import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import PublishingFields from "../components/PublishingFields";
import { BookOpen, ExternalLink, Filter, Loader2, Plus, Save, SearchX, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AppContext } from "@/context/AppContext";
import { CustomSelect } from "@/admin/components/CustomSelect";
import { getName, isValidUrl } from "@/admin/components/ResourceHelpers";
import { DeleteButton, EditButton } from "@/admin/components/AdminUI";

const blankForm = {
  id: "",
  board: "",
  class: "",
  group: "",
  subject: "",
  title: "",
  pdfUrl: "",
};

const Field = ({ label, helper, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
    {helper && <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-400">{helper}</span>}
  </label>
);

const getSelectOptions = (items) => items.map((item) => ({ _id: item._id, name: item.name }));
const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortBooks = (items) => [...items].sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" }));

const BookManagement = () => {
  const { boards, classes, groups, isLoadingContext, refreshContext } = useContext(AppContext);
  const [form, setForm] = useState(blankForm);
  const [subjects, setSubjects] = useState([]);
  const [filter, setFilter] = useState({ board: "", class: "", group: "", subject: "" });
  const [filterSubjects, setFilterSubjects] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { refreshContext(); }, [refreshContext]);

  useEffect(() => {
    const loadSubjects = async () => {
      setSubjects([]);
      if (!form.board || !form.class || !form.group) return;
      const res = await axiosInstance.get(`/subjects?boardId=${form.board}&classId=${form.class}&groupId=${form.group}`);
      setSubjects(sortByName(res.data.subjects || []));
    };
    loadSubjects().catch(() => setError("Failed to load subjects for the selected book context."));
  }, [form.board, form.class, form.group]);

  useEffect(() => {
    const loadFilterSubjects = async () => {
      setFilterSubjects([]);
      if (!filter.board || !filter.class || !filter.group) return;
      const res = await axiosInstance.get(`/subjects?boardId=${filter.board}&classId=${filter.class}&groupId=${filter.group}`);
      setFilterSubjects(sortByName(res.data.subjects || []));
    };
    loadFilterSubjects().catch(() => setError("Failed to load filter subjects."));
  }, [filter.board, filter.class, filter.group]);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([key, value]) => { if (value) params.set(key, value); });
      const response = await axiosInstance.get(`/resources/books?${params.toString()}`);
      setBooks(sortBooks(response.data.books || []));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load books.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const canSave = form.board && form.class && form.group && form.subject && form.title.trim() && form.pdfUrl.trim();
  const isEditing = Boolean(form.id);

  const selectedFilterCount = useMemo(() => Object.values(filter).filter(Boolean).length, [filter]);

  const resetForm = () => {
    setForm(blankForm);
    setMessage("");
    setError("");
  };

  const editBook = (book) => {
    setForm({
      ...book,
      id: book._id,
      board: book.board?._id || book.board || "",
      class: book.class?._id || book.class || "",
      group: book.group?._id || book.group || "",
      subject: book.subject?._id || book.subject || "",
      title: book.title || "",
      pdfUrl: book.pdfUrl || "",
    });
    setMessage("Editing selected book. Update the fields and save.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.board || !form.class || !form.group || !form.subject) return setError("Select board, class, group and subject.");
    if (!form.title.trim()) return setError("Book title is required.");
    if (!isValidUrl(form.pdfUrl.trim())) return setError("Enter a valid PDF URL.");

    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        pdfUrl: form.pdfUrl.trim(),
        board: form.board,
        class: form.class,
        group: form.group,
        subject: form.subject,
      };
      if (isEditing) {
        await axiosInstance.put(`/resources/books/${form.id}`, payload);
      } else {
        await axiosInstance.post("/resources/books", payload);
      }
      setMessage(isEditing ? "Book updated successfully." : "Book added successfully.");
      resetForm();
      await loadBooks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save book.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bookId) => {
    if (!bookId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await axiosInstance.delete(`/resources/books/${bookId}`);
      if (form.id === bookId) resetForm();
      setMessage("Book deleted successfully.");
      await loadBooks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete book.");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => setFilter({ board: "", class: "", group: "", subject: "" });

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-slate-950 p-7 text-white shadow-md">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em]">
                <BookOpen className="h-4 w-4" />
                Book Library
              </div>
              <h1 className="mt-4 text-3xl font-black">Full Book PDFs</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                Add, update and manage the complete PDF book attached to each board, class, group and subject.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-4 text-right">
              <p className="text-3xl font-black">{books.length}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">{selectedFilterCount ? "Filtered Books" : "Total Books"}</p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSave} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-black text-slate-950">{isEditing ? "Update Book" : "Add New Book"}</h2>
              <p className="mt-1 text-sm text-slate-500">One subject can have one full book. Use Edit below to update its existing book.</p>
            </div>
            {isEditing && (
              <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
                <X className="h-4 w-4" />
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <CustomSelect label="Board" value={form.board} onChange={(value) => setForm({ ...form, board: value, subject: "" })} options={getSelectOptions(boards)} placeholder="Select Board" isLoading={isLoadingContext} />
            <CustomSelect label="Class" value={form.class} onChange={(value) => setForm({ ...form, class: value, subject: "" })} options={getSelectOptions(classes)} placeholder="Select Class" isLoading={isLoadingContext} />
            <CustomSelect label="Group" value={form.group} onChange={(value) => setForm({ ...form, group: value, subject: "" })} options={getSelectOptions(groups)} placeholder="Select Group" isLoading={isLoadingContext} />
            <CustomSelect label="Subject" value={form.subject} onChange={(value) => setForm({ ...form, subject: value })} options={getSelectOptions(subjects)} placeholder="Select Subject" disabled={!form.board || !form.class || !form.group} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Book Title" helper="Example: FBISE Class 10 Physics Textbook - 2026 Edition">
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Book title" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" />
            </Field>
            <Field label="PDF Link" helper="Paste a public PDF URL students can view and download.">
              <input value={form.pdfUrl} onChange={(event) => setForm({ ...form, pdfUrl: event.target.value })} placeholder="https://example.com/book.pdf" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" />
            </Field>
          </div>

          <PublishingFields kind="book" value={form} title={form.title} onChange={(patch) => setForm(current => ({ ...current, ...patch }))} />
          {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">{error}</p>}
          {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}

          <div className="mt-5 flex justify-end">
            <button disabled={!canSave || saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isEditing ? "Update Book" : "Add Book"}
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-primary">
                <Filter className="h-4 w-4" />
                Books List
              </div>
              <p className="mt-1 text-sm text-slate-500">Choose no filters to show all books, or narrow the list by board, class, group and subject.</p>
            </div>
            {selectedFilterCount > 0 && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
                <X className="h-4 w-4" />
                Show All Books
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <CustomSelect label="Board" value={filter.board} onChange={(value) => setFilter({ board: value, class: "", group: "", subject: "" })} options={getSelectOptions(boards)} placeholder="All Boards" isLoading={isLoadingContext} />
            <CustomSelect label="Class" value={filter.class} onChange={(value) => setFilter({ ...filter, class: value, subject: "" })} options={getSelectOptions(classes)} placeholder="All Classes" isLoading={isLoadingContext} />
            <CustomSelect label="Group" value={filter.group} onChange={(value) => setFilter({ ...filter, group: value, subject: "" })} options={getSelectOptions(groups)} placeholder="All Groups" isLoading={isLoadingContext} />
            <CustomSelect label="Subject" value={filter.subject} onChange={(value) => setFilter({ ...filter, subject: value })} options={getSelectOptions(filterSubjects)} placeholder="All Subjects" disabled={!filter.board || !filter.class || !filter.group} />
          </div>

          {loading ? (
            <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : books.length ? (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {books.map((book) => (
                <article key={book._id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:border-primary/30 hover:bg-white hover:shadow-sm">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-primary">{getName(book.subject, "Subject")}</p>
                      <h3 className="mt-1 truncate text-lg font-black text-slate-950">{book.title}</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {getName(book.board)} / {getName(book.class)} / {getName(book.group)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a href={book.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary" title="Open PDF">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <EditButton onClick={() => editBook(book)} title="Edit book" />
                      <DeleteButton onClick={() => handleDelete(book._id)} disabled={saving} title="Delete book" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <SearchX className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-lg font-black text-slate-950">No books found</h3>
              <p className="mt-2 text-sm text-slate-500">Add a book above or clear filters to see the full library.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BookManagement;
