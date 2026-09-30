import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";
import { showStudentToast } from "../../shared/studentNotifications";
import CustomSelect from "../../shared/CustomSelect";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s-]{8,16}$/;

const StudentRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", phone: "", gender: "prefer_not_to_say", city: "", school: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const requestedPath = location.state?.from || sessionStorage.getItem("studentReturnTo") || "/dashboard";
  const returnTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const clean = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
    clean.email = clean.email.toLowerCase();
    const errors = {};
    if (clean.name.length < 2) errors.name = "Enter your full name.";
    if (!emailPattern.test(clean.email)) errors.email = "Enter a valid email address.";
    if (!phonePattern.test(clean.phone)) errors.phone = "Enter a valid phone number, such as 0300 1234567.";
    if (clean.city.length < 2) errors.city = "Enter your city.";
    if (clean.school.length < 2) errors.school = 'Enter your school or write "Private Candidate".';
    if (clean.password.length < 8 || !/[A-Za-z]/.test(clean.password) || !/\d/.test(clean.password)) errors.password = "Use at least 8 characters with a letter and number.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showStudentToast({ type: "error", title: "Complete your profile", message: "Correct the highlighted fields before creating your account." });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const response = await axiosInstance.post("/students/register", clean);
      localStorage.setItem("studentToken", response.data.token);
      localStorage.setItem("studentName", response.data.student.name);
      localStorage.setItem("studentSchool", response.data.student.school);
      notifyStudentAuthChanged();
      sessionStorage.removeItem("studentReturnTo");
      showStudentToast({ type: "success", title: "Account created", message: `Welcome to IlmiDunya, ${response.data.student.name.split(" ")[0]}. Your learning journey starts now.` });
      navigate(returnTo, { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
      showStudentToast({ type: "error", title: "Account not created", message });
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
          {[{ key: "name", label: "Full name", placeholder: "Your full name", type: "text", autoComplete: "name" }, { key: "email", label: "Email address", placeholder: "you@example.com", type: "email", autoComplete: "email" }, { key: "phone", label: "WhatsApp / phone number", placeholder: "0300 1234567", type: "tel", autoComplete: "tel" }, { key: "city", label: "City", placeholder: "For example, Lahore", type: "text", autoComplete: "address-level2" }].map((field) => <div key={field.key}><label htmlFor={`register-${field.key}`} className="mb-2 block text-sm font-black text-slate-800">{field.label}</label><input id={`register-${field.key}`} type={field.type} autoComplete={field.autoComplete} aria-invalid={Boolean(fieldErrors[field.key])} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary ${fieldErrors[field.key] ? "border-rose-400 bg-rose-50/50" : "border-slate-200"}`} placeholder={field.placeholder} value={form[field.key]} onChange={(e) => { setForm({ ...form, [field.key]: e.target.value }); setFieldErrors((current) => ({ ...current, [field.key]: "" })); }} />{fieldErrors[field.key] && <p className="mt-1.5 text-xs font-bold text-rose-600">{fieldErrors[field.key]}</p>}</div>)}
          <CustomSelect label="Gender (optional)" id="register-gender" value={form.gender} onChange={(gender) => setForm({ ...form, gender })} placeholder="Prefer not to say" options={[{ value: "prefer_not_to_say", label: "Prefer not to say" }, { value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }]} />
          <div className="sm:col-span-2"><label htmlFor="register-school" className="mb-2 block text-sm font-black text-slate-800">School or candidate type</label><input id="register-school" autoComplete="organization" aria-invalid={Boolean(fieldErrors.school)} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary ${fieldErrors.school ? "border-rose-400 bg-rose-50/50" : "border-slate-200"}`} placeholder='School name or "Private Candidate"' value={form.school} onChange={(e) => { setForm({ ...form, school: e.target.value }); setFieldErrors((current) => ({ ...current, school: "" })); }} />{fieldErrors.school && <p className="mt-1.5 text-xs font-bold text-rose-600">{fieldErrors.school}</p>}</div>
          <div className="sm:col-span-2"><label htmlFor="register-password" className="mb-2 block text-sm font-black text-slate-800">Password</label><div className="relative"><input id="register-password" autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm outline-none focus:border-primary ${fieldErrors.password ? "border-rose-400 bg-rose-50/50" : "border-slate-200"}`} type={showPassword ? "text" : "password"} placeholder="At least 8 characters with a letter and number" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setFieldErrors((current) => ({ ...current, password: "" })); }} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{fieldErrors.password && <p className="mt-1.5 text-xs font-bold text-rose-600">{fieldErrors.password}</p>}</div>
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600 sm:col-span-2">{error}</p>}
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60 sm:col-span-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered? <Link to="/login" state={{ from: returnTo }} className="font-black text-primary">Login</Link>
        </p>
      </section>
    </main>
  );
};

export default StudentRegister;
