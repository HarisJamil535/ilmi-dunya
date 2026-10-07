import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import axiosInstance from "../../api/axios";
import StudentAuthShell from "../components/StudentAuthShell";
import { AuthField, AuthSubmit, OtpField, PasswordField } from "../components/StudentAuthControls";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState(location.state?.email || "");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const requestCode = async (event) => {
    event.preventDefault();
    if (!emailPattern.test(email.trim())) return setError("Enter the email address registered with your account.");
    setBusy(true);
    setError("");
    try {
      const response = await axiosInstance.post("/students/forgot-password", { email: email.trim(), channel: "email" });
      setChallengeId(response.data.challengeId || "");
      setMessage(response.data.message);
      setStep("verify");
    } catch (err) {
      setError(err.response?.data?.message || "We could not send a reset code right now.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (!challengeId) return setError("Request a new verification code to continue.");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the complete six-digit verification code.");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("Use at least 8 characters with a letter and a number.");
    if (password !== confirmPassword) return setError("The passwords do not match.");
    setBusy(true);
    setError("");
    try {
      await axiosInstance.post("/students/reset-password", { challengeId, otp, password });
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reset your password. Check the code and try again.");
    } finally {
      setBusy(false);
    }
  };

  return <StudentAuthShell eyebrow="Account recovery" title={step === "done" ? "Password updated" : "Reset your password"} description={step === "request" ? "We will email you a secure one-time code to create a new password." : step === "done" ? "Your new password is ready to use." : "Enter the code from your email and choose a new password."}>
    {step === "done" ? <section className="rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-xl shadow-slate-200/50 sm:p-9">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></span>
      <h2 className="mt-5 text-xl font-black text-slate-950">You’re back in control</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Your password has been changed and previous sessions have been signed out.</p>
      <button type="button" onClick={() => navigate("/login", { replace: true })} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:bg-primary-dark">Back to login</button>
    </section> : step === "request" ? <form onSubmit={requestCode} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7" noValidate>
      <AuthField label="Registered email address" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" required />
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />For privacy, the confirmation does not reveal whether an account exists for this email.</div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <AuthSubmit loading={busy}><MailCheck className="h-4 w-4" />Send email code</AuthSubmit>
      <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to login</Link>
    </form> : <form onSubmit={resetPassword} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7">
      <div className="flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm leading-6 text-primary-dark"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary"><MailCheck className="h-5 w-5" /></span><span>{message}<br /><strong>Code expires in 10 minutes.</strong></span></div>
      <OtpField value={otp} onChange={(value) => { setOtp(value); setError(""); }} />
      <PasswordField label="New password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="At least 8 characters, with a letter and number" />
      <PasswordField label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }} placeholder="Enter the new password again" />
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <AuthSubmit loading={busy}><KeyRound className="h-4 w-4" />Update password</AuthSubmit>
      <button type="button" onClick={() => { setStep("request"); setChallengeId(""); setOtp(""); setError(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-slate-500 hover:text-primary"><ArrowLeft className="h-4 w-4" />Use a different email</button>
    </form>}
  </StudentAuthShell>;
};

export default ForgotPassword;
