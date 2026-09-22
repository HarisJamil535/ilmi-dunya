import { useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../api/axios";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [form, setForm] = useState({ email: "", otp: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitEmail = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const response = await axiosInstance.post("/students/forgot-password", { email: form.email }); setMessage(response.data.message); setStep("reset"); }
    catch (err) { setError(err.response?.data?.message || "Unable to send the code right now."); }
    finally { setBusy(false); }
  };
  const reset = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await axiosInstance.post("/students/reset-password", form); setStep("done"); }
    catch (err) { setError(err.response?.data?.message || "Unable to reset your password."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-12"><section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
    {step === "done" ? <div className="text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /><h1 className="mt-5 text-2xl font-black text-slate-950">Password updated</h1><p className="mt-2 text-sm leading-6 text-slate-500">Your password has been changed successfully.</p><button type="button" onClick={() => navigate("/login")} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-white">Continue to login</button></div> : <>
      <div className="mb-7"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><KeyRound className="h-5 w-5" /></div><h1 className="text-2xl font-black text-slate-950">Reset your password</h1><p className="mt-2 text-sm leading-6 text-slate-500">{step === "email" ? "Enter your email and we will send a secure verification code." : "Enter the six digit code from your email and choose a new password."}</p></div>
      {step === "email" ? <form onSubmit={submitEmail} className="space-y-4"><input required type="email" autoComplete="email" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><Submit busy={busy} label="Send verification code" /></form> : <form onSubmit={reset} className="space-y-4"><p className="rounded-xl bg-primary-soft p-3 text-xs font-semibold leading-5 text-primary-dark">{message}</p><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm tracking-[0.4em] outline-none focus:border-primary" placeholder="000000" value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value.replace(/\D/g, "") })} /><div className="relative"><input required minLength={6} type={showPassword ? "text" : "password"} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:border-primary" placeholder="New password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><Submit busy={busy} label="Update password" /></form>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">{error}</p>}<Link to="/login" className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={15} />Back to login</Link>
    </>}
  </section></main>;
}

function Submit({ busy, label }) { return <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white transition hover:bg-primary-dark disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{label}</button>; }
