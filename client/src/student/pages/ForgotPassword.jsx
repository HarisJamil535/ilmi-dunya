import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, MailCheck, MessageCircle, ShieldCheck } from "lucide-react";
import axiosInstance from "../../api/axios";
import StudentAuthShell from "../components/StudentAuthShell";
import { AuthChannelPicker, AuthField, AuthSubmit, OtpField, PasswordField } from "../components/StudentAuthControls";
import useStudentAuthOptions from "../hooks/useStudentAuthOptions";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState("request");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState("email");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { channels } = useStudentAuthOptions();

  useEffect(() => { if (!channels.email && channels.whatsapp) setChannel("whatsapp"); }, [channels.email, channels.whatsapp]);

  const requestCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await axiosInstance.post("/students/forgot-password", { identifier: identifier.trim(), channel });
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
    if (!challengeId) return setError("If an active account matches these details, its code will arrive. Check the email or number and try again.");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("Use at least 8 characters with a letter and a number.");
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

  const footer = <>Remember your password? <Link to="/login" className="font-black text-primary hover:text-primary-dark">Back to login</Link></>;

  return <StudentAuthShell eyebrow="Account recovery" title={step === "done" ? "Password updated" : "Reset your password"} description={step === "request" ? "Choose where to receive a one-time code, then set a new password." : step === "done" ? "Your password has been changed. Sign in with your new password to continue." : "Enter the code we sent and choose a strong new password."} footer={footer}>
    {step === "done" ? <section className="rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-xl shadow-slate-200/50 sm:p-9">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></span>
      <h2 className="mt-5 text-xl font-black text-slate-950">You’re back in control</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Your password is updated and your existing sessions have been signed out.</p>
      <button type="button" onClick={() => navigate("/login", { replace: true })} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:bg-primary-dark">Continue to login</button>
    </section> : step === "request" ? <form onSubmit={requestCode} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7">
      <AuthField label={channel === "email" ? "Email address" : "WhatsApp number"} type={channel === "email" ? "email" : "tel"} autoComplete={channel === "email" ? "email" : "tel"} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={channel === "email" ? "you@example.com" : "0300 1234567"} required />
      <AuthChannelPicker value={channel} onChange={(value) => { setChannel(value); setError(""); }} channels={channels} />
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />For account privacy, we show the same confirmation whether or not those details match an account.</div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <AuthSubmit loading={busy}>Send reset code</AuthSubmit>
    </form> : <form onSubmit={resetPassword} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-7">
      <div className="flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm leading-6 text-primary-dark"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary">{channel === "email" ? <MailCheck className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}</span><span>{message}<br /><strong>Code expires in 10 minutes.</strong></span></div>
      <OtpField value={otp} onChange={setOtp} />
      <PasswordField label="New password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters, with a letter and number" />
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <AuthSubmit loading={busy}><KeyRound className="h-4 w-4" />Update password</AuthSubmit>
    </form>}
  </StudentAuthShell>;
};

export default ForgotPassword;
