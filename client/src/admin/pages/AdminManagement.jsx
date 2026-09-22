import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck, UserPlus, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import SmartSelect from "../../shared/CustomSelect";
import { AdminActionButton, AdminAlert, AdminLoader, AdminPageHeader, DeleteButton, EditButton, SaveButton } from "../components/AdminUI";

const blankForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  status: "active",
  permissions: [],
};

const permissionLabels = {
  academic: "Academic Structure",
  resources: "Books, Notes & Papers",
  homeContent: "Home Content",
  assessments: "Questions & Tests",
  news: "Education News",
  analytics: "Analytics",
};
const sortAdmins = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortPermissions = (items) => [...items].sort((a, b) => (permissionLabels[a] || a).localeCompare(permissionLabels[b] || b, undefined, { numeric: true, sensitivity: "base" }));

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditing = Boolean(form.id);

  const selectedAdmin = useMemo(() => admins.find((admin) => admin.id === form.id), [admins, form.id]);

  const loadAdmins = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.get("/admin/admins");
      setAdmins(sortAdmins(response.data.admins || []));
      setPermissions(sortPermissions(response.data.permissions || []));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load admins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdmins(); }, []);

  const resetForm = () => {
    setForm(blankForm);
    setMessage("");
    setError("");
  };

  const togglePermission = (permission) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const editAdmin = (admin) => {
    setForm({
      id: admin.id,
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      status: admin.status || "active",
      permissions: admin.permissions || [],
    });
    setMessage("Editing admin access. Leave password empty to keep the current password.");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        status: form.status,
        permissions: form.permissions,
      };
      if (form.password) payload.password = form.password;
      if (isEditing) await axiosInstance.put(`/admin/admins/${form.id}`, payload);
      else await axiosInstance.post("/admin/admins", { ...payload, password: form.password });
      setMessage(isEditing ? "Admin updated successfully." : "Admin created successfully.");
      resetForm();
      await loadAdmins();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save admin.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAdmin = async (id) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await axiosInstance.delete(`/admin/admins/${id}`);
      setMessage("Admin deleted successfully.");
      if (form.id === id) resetForm();
      await loadAdmins();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete admin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminPageHeader icon={ShieldCheck} eyebrow="Security" title="Admin Access Control" description="Create admin accounts, assign access areas, disable accounts and keep super-admin control centralized." statLabel="Admins" statValue={admins.length} />

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-black text-slate-950">{isEditing ? "Update Admin" : "Add Admin"}</h2>
              <p className="mt-1 text-sm text-slate-500">Admins can login from one device at a time. A new login expires their older session.</p>
            </div>
            {isEditing && (
              <AdminActionButton variant="ghost" icon={X} onClick={resetForm}>
                Cancel Edit
              </AdminActionButton>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Name</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Admin name" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Email</span>
              <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="admin@example.com" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Password</span>
              <input required={!isEditing} type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder={isEditing ? "Leave unchanged" : "Minimum 8 characters"} />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Status</span>
              <SmartSelect value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }]} placeholder="Choose status" />
            </label>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">Access Permissions</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {permissions.map((permission) => (
                <button
                  key={permission}
                  type="button"
                  onClick={() => togglePermission(permission)}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${form.permissions.includes(permission) ? "border-primary bg-primary-soft text-primary-dark" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  <span className="font-bold">{permissionLabels[permission] || permission}</span>
                  {form.permissions.includes(permission) && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <AdminAlert type="error">{error}</AdminAlert>
          <AdminAlert>{message}</AdminAlert>

          <div className="mt-5 flex justify-end">
            <SaveButton type="submit" loading={saving} icon={isEditing ? undefined : UserPlus} disabled={saving || selectedAdmin?.role === "super_admin"}>
              {isEditing ? "Update Admin" : "Create Admin"}
            </SaveButton>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Admins</h2>
          {loading ? (
            <AdminLoader label="Loading admins..." />
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {admins.map((admin) => (
                <article key={admin.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-950">{admin.name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${admin.role === "super_admin" ? "bg-primary-soft text-primary-dark" : "bg-slate-100 text-slate-600"}`}>{admin.role === "super_admin" ? "Super Admin" : "Admin"}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${admin.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{admin.status}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{admin.email}</p>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">{(admin.permissions || []).map((item) => permissionLabels[item] || item).join(" / ") || "All access"}</p>
                    </div>
                    {admin.role !== "super_admin" && (
                      <div className="flex shrink-0 gap-2">
                        <EditButton onClick={() => editAdmin(admin)} />
                        <DeleteButton onClick={() => deleteAdmin(admin.id)} disabled={saving} />
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminManagement;
