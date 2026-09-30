import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, MailCheck, MessageCircle } from "lucide-react";
import axiosInstance from "../../api/axios";
import { notifyStudentAuthChanged } from "../../auth/authEvents";
import { showStudentToast } from "../../shared/studentNotifications";
import StudentAuthShell from "../components/StudentAuthShell";
import { AuthChannelPicker, AuthField, AuthSubmit, GoogleIdentityButton, OtpField, PasswordField } from "../components/StudentAuthControls";
import useStudentAuthOptions from "../hooks/useStudentAuthOptions";

const StudentLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("password");
  const [step, setStep] = useState("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [channel, setChannel] = useState("email");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const { channels } = useStudentAuthOptions();
  const requestedPath = location.state?.from || sessionStorage.getItem("studentReturnTo") || "/dashboard";
  const returnTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  useEffect(() => { if (!channels.email && channels.whatsapp) setChannel("whatsapp"); }, [channels.email, channels.whatsapp]);

  const finishLogin = (response, welcome = true) => {
    localStorage.setItem("studentToken", response.data.token);
    localStorage.setItem("studentName", response.data.student.name);
    localStorage.setItem("studentSchool", response.data.student.school || "");
    notifyStudentAuthChanged();
    sessionStorage.removeItem("studentReturnTo");
    if (welcome) showStudentToast({ type: "success", title: `Welcome back, ${response.data.student.name.split(" ")[0]}`, message: returnTo === "/dashboard" ? "Your learning dashboard is ready." : "Taking you back to where you left off." });
    navigate(returnTo, { replace: true });
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setFieldError("Enter your email or WhatsApp number and password.");
      return;
    }
    setLoading(true);
    setError("");
    setFieldError("");
    try {
      const response = await axiosInstance.post("/students/login", { identifier: identifier.trim(), password });
      finishLogin(response);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check your details and try again.");
      showStudentToast({ type: "error", title: "Login unsuccessful", message: err.response?.data?.message || "Check your details and try again." });
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async (event) => {
    event.preventDefault();
    if (!identifier.trim()) return setFieldError("Enter your email or WhatsApp number.");
    setLoading(true);
    setError("");
    setFieldError("");
    try {
      const response = await axiosInstance.post("/students/login/request-code", { identifier: identifier.trim(), channel });
      setChallengeId(response.data.challengeId || "");
      setMessage(response.data.message);
      setOtp("");
      setStep("verify");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send a sign-in code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (!challengeId) return setError("If an active account matches these details, a code will arrive. Check the number or email and request a new code.");
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.post("/students/login/verify-code", { challengeId, otp });
      finishLogin(response);
    } catch (err) {
      setError(err.response?.data?.message || "That code could not be verified. Request a new code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential, googleChallengeId, nonce) => {
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.post("/students/google", { credential, challengeId: googleChallengeId, nonce });
      if (response.data.needsProfile) {
        navigate("/register", { replace: true, state: { from: returnTo, googleSignup: { profile: response.data.profile, googleRegistrationToken: response.data.googleRegistrationToken } } });
      } else finishLogin(response);
    } catch (err) {
      setError(err.response?.data?.message || "Google sign-in failed. Please try another method.");
    } finally {
      setLoading(false);
    }
  };

  return <StudentAuthShell eyebrow="Your study space" title={step === "verify" ? "Check your code" : "Welcome back"} description={step === "verify" ? "Enter the one-time code to securely access your student account." : "Sign in to continue your tests, resources and learning progress."}>
    {step === "verify" ? <form onSubmit={verifyCode} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7">
      <div className="flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm leading-6 text-primary-dark"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary">{channel === "email" ? <MailCheck className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}</span><span>{message}<br /><strong>Code expires in 10 minutes.</strong></span></div>
      <OtpField value={otp} onChange={setOtp} />
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <AuthSubmit loading={loading}>Verify and sign in</AuthSubmit>
      <button type="button" onClick={() => { setStep("credentials"); setError(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-slate-500 transition hover:text-primary"><ArrowLeft className="h-4 w-4" />Change sign-in details</button>
    </form> : <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/50 sm:space-y-4 sm:rounded-3xl sm:p-6">
      <GoogleIdentityButton onCredential={handleGoogleCredential} disabled={loading} />
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />or use email / WhatsApp<span className="h-px flex-1 bg-slate-200" /></div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => { setMode("password"); setError(""); }} aria-pressed={mode === "password"} className={`min-h-10 rounded-lg text-sm font-black transition ${mode === "password" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Password</button><button type="button" onClick={() => { setMode("code"); setError(""); }} aria-pressed={mode === "code"} className={`min-h-10 rounded-lg text-sm font-black transition ${mode === "code" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>One-time code</button></div>
      {mode === "password" ? <form onSubmit={submitPassword} className="space-y-3">
        <AuthField label="Email or WhatsApp number" autoComplete="username" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setFieldError(""); }} placeholder="you@example.com or 0300 1234567" error={fieldError} />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        <AuthSubmit loading={loading}>Log in</AuthSubmit>
      </form> : <form onSubmit={requestCode} className="space-y-3">
        <AuthField label="Email or WhatsApp number" autoComplete="username" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setFieldError(""); }} placeholder="you@example.com or 0300 1234567" error={fieldError} />
        <AuthChannelPicker value={channel} onChange={setChannel} channels={channels} />
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        <AuthSubmit loading={loading}>Send sign-in code</AuthSubmit>
      </form>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link to="/register" state={{ from: returnTo }} className="font-bold text-primary hover:text-primary-dark">Create account</Link>
        <Link to="/forgot-password" className="inline-flex items-center gap-1 font-bold text-slate-500 hover:text-primary"><KeyRound className="h-3 w-3" />Forgot password?</Link>
      </div>
    </div>}
  </StudentAuthShell>;
};

export default StudentLogin;
