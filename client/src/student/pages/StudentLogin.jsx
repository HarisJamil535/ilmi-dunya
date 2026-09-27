import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";
import { showStudentToast } from "../../shared/studentNotifications";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const StudentLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const requestedPath = location.state?.from || sessionStorage.getItem("studentReturnTo") || "/dashboard";
  const returnTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const email = form.email.trim().toLowerCase();
    const errors = {};
    if (!emailPattern.test(email)) errors.email = "Enter a valid email address.";
    if (!form.password) errors.password = "Enter your password.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showStudentToast({ type: "error", title: "Check your details", message: "Correct the highlighted fields and try again." });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const response = await axiosInstance.post("/students/login", { email, password: form.password });
      localStorage.setItem("studentToken", response.data.token);
      localStorage.setItem("studentName", response.data.student.name);
      localStorage.setItem("studentSchool", response.data.student.school || "");
      notifyStudentAuthChanged();
      sessionStorage.removeItem("studentReturnTo");
      showStudentToast({ type: "success", title: `Welcome back, ${response.data.student.name.split(" ")[0]}`, message: returnTo === "/dashboard" ? "Your learning dashboard is ready." : "Taking you back to where you left off." });
      navigate(returnTo, { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || "Login failed. Please try again.";
      setError(message);
      showStudentToast({ type: "error", title: "Login unsuccessful", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
        <div className="mb-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <LogIn className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-black text-slate-950">Student login</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Login to take tests, download resources and track progress.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="student-login-email" className="mb-2 block text-sm font-black text-slate-800">Email address</label><input id="student-login-email" type="email" autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary ${fieldErrors.email ? "border-rose-400 bg-rose-50/50" : "border-slate-200"}`} placeholder="you@example.com" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((current) => ({ ...current, email: "" })); }} />{fieldErrors.email && <p className="mt-1.5 text-xs font-bold text-rose-600">{fieldErrors.email}</p>}</div>
          <div><label htmlFor="student-login-password" className="mb-2 block text-sm font-black text-slate-800">Password</label><div className="relative"><input id="student-login-password" autoComplete="current-password" aria-invalid={Boolean(fieldErrors.password)} className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm outline-none focus:border-primary ${fieldErrors.password ? "border-rose-400 bg-rose-50/50" : "border-slate-200"}`} type={showPassword ? "text" : "password"} placeholder="Enter your password" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setFieldErrors((current) => ({ ...current, password: "" })); }} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{fieldErrors.password && <p className="mt-1.5 text-xs font-bold text-rose-600">{fieldErrors.password}</p>}</div>
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">{error}</p>}
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Login
          </button>
        </form>
        <Link to="/forgot-password" className="mt-4 block text-center text-sm font-bold text-primary hover:text-primary-dark">Forgot password?</Link>
        <p className="mt-5 text-center text-sm text-slate-500">
          New student? <Link to="/register" state={{ from: returnTo }} className="font-black text-primary">Create account</Link>
        </p>
      </section>
    </main>
  );
};

export default StudentLogin;
