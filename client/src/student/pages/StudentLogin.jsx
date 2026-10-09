import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";
import { showStudentToast } from "../../shared/studentNotifications";
import StudentAuthShell from "../components/StudentAuthShell";
import { AuthField, AuthSubmit, PasswordField } from "../components/StudentAuthControls";

const StudentLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const requestedPath = location.state?.from || sessionStorage.getItem("studentReturnTo") || "/dashboard";
  const returnTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  const finishLogin = (response, title = `Welcome back, ${response.data.student.name.split(" ")[0]}`) => {
    localStorage.setItem("studentToken", response.data.token);
    localStorage.setItem("studentName", response.data.student.name);
    localStorage.setItem("studentSchool", response.data.student.school || "");
    notifyStudentAuthChanged();
    sessionStorage.removeItem("studentReturnTo");
    showStudentToast({ type: "success", title, message: returnTo === "/dashboard" ? "Your learning dashboard is ready." : "Taking you back to where you left off." });
    navigate(returnTo, { replace: true });
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!identifier.trim()) errors.identifier = "Enter your email address or phone number.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.post("/students/login", { identifier: identifier.trim(), password });
      finishLogin(response);
    } catch (err) {
      const message = err.response?.data?.message || "Login failed. Check your details and try again.";
      setError(message);
      showStudentToast({ type: "error", title: "Login unsuccessful", message });
    } finally {
      setLoading(false);
    }
  };

  return <StudentAuthShell eyebrow="Your study space" title="Welcome back" description="Sign in with your email address or phone number to continue learning.">
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7">
      <form onSubmit={submitPassword} className="space-y-4" noValidate>
        <AuthField label="Email or phone number" autoComplete="username" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setFieldErrors((current) => ({ ...current, identifier: "" })); setError(""); }} placeholder="you@example.com or 0300 1234567" error={fieldErrors.identifier} />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: "" })); setError(""); }} placeholder="Enter your password" error={fieldErrors.password} />
        <div className="flex justify-end"><Link to="/forgot-password" state={{ email: identifier.includes("@") ? identifier : "" }} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary transition hover:text-primary-dark"><KeyRound className="h-4 w-4" />Forgot password?</Link></div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        <AuthSubmit loading={loading}>Log in</AuthSubmit>
      </form>
      <p className="text-center text-sm text-slate-500">New to IlmiDunya? <Link to="/register" state={{ from: returnTo }} className="font-black text-primary hover:text-primary-dark">Create an account</Link></p>
    </div>
  </StudentAuthShell>;
};

export default StudentLogin;
