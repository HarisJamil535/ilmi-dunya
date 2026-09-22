import { useEffect, useState } from "react";
import PublishingFields from "../components/PublishingFields";
import { ImagePlus, Loader2, Newspaper, Plus, Save, Upload } from "lucide-react";
import axiosInstance from "@/api/axios";
import SmartSelect from "../../shared/CustomSelect";
import { DeleteButton, EditButton } from "../components/AdminUI";

const blank = {
  title: "",
  excerpt: "",
  content: "",
  category: "Education News",
  author: "IlmiDunya Editorial",
  coverImage: "",
  isPublished: false,
  isFeatured: false,
};

const sortArticles = (items) => [...items].sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" }));

const Field = ({ label, children }) => (
  <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
    {label}
    {children}
  </label>
);

const NewsManagement = () => {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = async (requestedPage = 1) => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(`/news?page=${requestedPage}&limit=24`);
      setArticles(sortArticles(data.articles || []));
      setPage(data.page);
      setPages(data.pages || 1);
    } catch {
      setArticles([]);
      setError('Unable to load articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key, value) => setForm({ ...form, [key]: value });

  const uploadCoverImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setUploadingImage(true);
    try {
      const data = new FormData();
      data.append("image", file);
      const response = await axiosInstance.post("/news/upload-image", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      update("coverImage", response.data.imageUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to upload image. Please use JPG, PNG or WebP under 3MB.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing) await axiosInstance.put(`/news/${editing}`, form);
      else await axiosInstance.post("/news", form);
      setForm(blank);
      setEditing("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save article.");
    } finally {
      setSaving(false);
    }
  };

  const edit = async (item) => {
    setSaving(true);
    setError("");
    try {
      const { data } = await axiosInstance.get(`/news/${item.slug}`);
      setEditing(item._id);
      setForm({ ...blank, ...data.article });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load article for editing.");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      await axiosInstance.delete(`/news/${id}`);
      await load(articles.length === 1 && page > 1 ? page - 1 : page);
    } catch {
      setError("Unable to delete article.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-primary-dark to-slate-950 p-7 text-white">
          <Newspaper className="h-7 w-7" />
          <h1 className="mt-3 text-2xl font-black">Education News</h1>
          <p className="mt-1 text-sm text-primary-muted">Publish articles, exam updates and student stories for the public news page.</p>
        </header>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Headline">
              <input required className="input" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Article headline" />
            </Field>
            <Field label="Category">
              <SmartSelect
                value={form.category}
                onChange={(value) => update("category", value)}
                options={["Education News", "Exam Updates", "Study Guide", "Student Stories"].map((value) => ({ value, label: value }))}
                placeholder="Choose category"
              />
            </Field>
          </div>

          <PublishingFields kind="news" value={form} title={form.title} summaryKey="excerpt" required={form.isPublished} lockSlug={Boolean(editing)} onChange={patch => setForm(current => ({ ...current, ...patch }))} />
          <Field label="Article content">
            <textarea required className="input mt-4 min-h-48" value={form.content} onChange={(event) => update("content", event.target.value)} placeholder="Write each paragraph on a new line" />
          </Field>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Author">
              <input className="input" value={form.author} onChange={(event) => update("author", event.target.value)} />
            </Field>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Cover Image</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Upload from computer or paste an image URL.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-primary">
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadCoverImage} className="hidden" disabled={uploadingImage} />
                </label>
              </div>
              <input className="input mt-3" value={form.coverImage} onChange={(event) => update("coverImage", event.target.value)} placeholder="Optional image URL" />
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {form.coverImage ? (
                  <img src={form.coverImage} alt="News cover preview" className="h-44 w-full object-cover transition duration-500 hover:scale-105" />
                ) : (
                  <div className="flex h-44 flex-col items-center justify-center text-slate-400">
                    <ImagePlus className="h-8 w-8" />
                    <span className="mt-2 text-xs font-bold">No cover selected</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={form.isPublished} onChange={(event) => update("isPublished", event.target.checked)} />
                Publish now
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} />
                Show in highlights
              </label>
            </div>
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
            <div className="flex gap-2">
              {editing && (
                <button type="button" onClick={() => { setEditing(""); setForm(blank); }} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold">
                  Cancel
                </button>
              )}
              <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editing ? "Update article" : "Save article"}
              </button>
            </div>
          </div>
        </form>

        <nav aria-label="Article list pages" className="flex items-center justify-between gap-3">
          <button type="button" disabled={loading || page <= 1} onClick={() => load(page - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Previous</button>
          <span className="text-sm">Page {page} of {pages}</span>
          <button type="button" disabled={loading || page >= pages} onClick={() => load(page + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Next</button>
        </nav>
        <section className="grid gap-4 md:grid-cols-2">
          {loading ? (
            <div className="col-span-full flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : articles.map((article) => (
            <article key={article._id} className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
              {article.coverImage && (
                <div className="mb-4 overflow-hidden rounded-2xl bg-slate-100">
                  <img src={article.coverImage} alt={article.title} className="h-44 w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-primary">{article.category}</p>
                  <h2 className="mt-2 text-lg font-black">{article.title}</h2>
                </div>
                <span className="text-xs font-bold text-slate-400">{article.isPublished ? "Published" : "Draft"}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{article.excerpt}</p>
              <div className="mt-4 flex justify-end gap-2">
                <EditButton onClick={() => edit(article)} />
                <DeleteButton onClick={() => remove(article._id)} />
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default NewsManagement;
