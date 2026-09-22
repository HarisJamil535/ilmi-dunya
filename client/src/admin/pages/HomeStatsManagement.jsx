import { useEffect, useState } from "react";
import { BarChart3, Loader2, Plus, Save } from "lucide-react";
import axiosInstance from "@/api/axios";
import { DeleteButton, EditButton } from "../components/AdminUI";

const emptyForm = { label: "", value: "", description: "", displayOrder: 0, isActive: true };

const HomeStatsManagement = () => {
  const [stats, setStats] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/home-content/stats");
      setStats([...(response.data.stats || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.label.localeCompare(b.label)));
    } catch {
      setStats([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.label.trim() || !form.value.trim()) {
      setError("Label and value are required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await axiosInstance.put(`/home-content/stats/${editingId}`, form);
      } else {
        await axiosInstance.post("/home-content/stats", form);
      }
      resetForm();
      await fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save stat.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (stat) => {
    setEditingId(stat._id);
    setForm({
      label: stat.label || "",
      value: stat.value || "",
      description: stat.description || "",
      displayOrder: stat.displayOrder || 0,
      isActive: Boolean(stat.isActive),
    });
  };

  const handleDelete = async (id) => {
    await axiosInstance.delete(`/home-content/stats/${id}`);
    setStats((current) => current.filter((item) => item._id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-primary-dark to-slate-950 p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Home Page Stats</h1>
              <p className="mt-1 text-sm text-primary-muted">Manage the real stats shown on the public home hero.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Label e.g. Students" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Value e.g. 50,000+" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" type="number" placeholder="Order" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
          </div>

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
                {editingId ? "Update Stat" : "Add Stat"}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.map((stat) => (
                <div key={stat._id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-950">{stat.value} <span className="text-sm text-slate-500">{stat.label}</span></p>
                    <p className="text-sm text-slate-500">{stat.description || "No description"} · Order {stat.displayOrder} · {stat.isActive ? "Active" : "Hidden"}</p>
                  </div>
                  <div className="flex gap-2">
                    <EditButton onClick={() => handleEdit(stat)} />
                    <DeleteButton onClick={() => handleDelete(stat._id)} />
                  </div>
                </div>
              ))}
              {stats.length === 0 && <div className="p-12 text-center text-sm font-bold text-slate-400">No stats added yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeStatsManagement;
