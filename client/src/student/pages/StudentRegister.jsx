import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";

const StudentRegister = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", school: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await axiosInstance.post("/students/register", form);
      localStorage.setItem("studentToken", response.data.token);
      localStorage.setItem("studentName", response.data.student.name);
      localStorage.setItem("studentSchool", response.data.student.school);
      notifyStudentAuthChanged();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
        <div className="mb-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-black text-slate-950">Create student account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Create your profile once. It helps save progress, MCQ history and future leaderboard records.</p>
        </div>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary sm:col-span-2" placeholder='School name or write "Private Candidate"' value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
          <div className="relative"><input className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:border-primary" type={showPassword ? "text" : "password"} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600 sm:col-span-2">{error}</p>}
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60 sm:col-span-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered? <Link to="/login" className="font-black text-primary">Login</Link>
        </p>
      </section>
    </main>
  );
};

export default StudentRegister;
