import { useEffect, useState } from "react";
import { Loader2, MessageSquareQuote, Plus, Save } from "lucide-react";
import axiosInstance from "@/api/axios";
import { DeleteButton, EditButton } from "../components/AdminUI";

const emptyForm = { name: "", role: "", comment: "", initials: "", displayOrder: 0, isActive: true };

const TestimonialsManagement = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchTestimonials = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/home-content/testimonials");
      setTestimonials([...(response.data.testimonials || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name)));
    } catch {
      setTestimonials([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim() || !form.role.trim() || !form.comment.trim()) {
      setError("Name, role and comment are required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await axiosInstance.put(`/home-content/testimonials/${editingId}`, form);
      } else {
        await axiosInstance.post("/home-content/testimonials", form);
      }
      resetForm();
      await fetchTestimonials();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save testimonial.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || "",
      role: item.role || "",
      comment: item.comment || "",
      initials: item.initials || "",
      displayOrder: item.displayOrder || 0,
      isActive: Boolean(item.isActive),
    });
  };

  const handleDelete = async (id) => {
    await axiosInstance.delete(`/home-content/testimonials/${id}`);
    setTestimonials((current) => current.filter((item) => item._id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-primary-dark to-slate-950 p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <MessageSquareQuote className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Home Testimonials</h1>
              <p className="mt-1 text-sm text-primary-muted">Add student feedback for the public home page carousel.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Student name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Role e.g. Class 10 Student" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Initials optional" value={form.initials} onChange={(e) => setForm({ ...form, initials: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" type="number" placeholder="Order" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
          </div>
          <textarea className="mt-4 min-h-28 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Student feedback" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Show on home page
            </label>
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>}
              <button disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Update Testimonial" : "Add Testimonial"}
              </button>
            </div>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? (
            <div className="col-span-full flex justify-center rounded-2xl bg-white p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : testimonials.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-white p-12 text-center text-sm font-bold text-slate-400">No testimonials added yet.</div>
          ) : testimonials.map((item) => (
            <article key={item._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{item.name}</h3>
                  <p className="text-sm font-bold text-primary">{item.role}</p>
                </div>
                <div className="rounded-2xl bg-primary-soft px-3 py-2 text-sm font-black text-primary-dark">{item.initials}</div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{item.comment}</p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-400">Order {item.displayOrder} · {item.isActive ? "Active" : "Hidden"}</p>
                <div className="flex gap-2">
                  <EditButton onClick={() => handleEdit(item)} />
                  <DeleteButton onClick={() => handleDelete(item._id)} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestimonialsManagement;
