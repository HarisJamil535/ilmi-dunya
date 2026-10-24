import { useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Send, XCircle } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AdminActionButton } from "./AdminUI";

// Lets a super admin see why verification codes might not arrive, and send a real test e-mail.
export default function EmailDeliveryCheck() {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const check = async () => {
    setChecking(true);
    try {
      const { data } = await axiosInstance.get("/admin/email-status");
      setStatus(data);
    } catch (err) {
      setStatus({ error: err.response?.data?.message || "Could not read the email settings." });
    } finally {
      setChecking(false);
    }
  };

  const sendTest = async (event) => {
    event.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const { data } = await axiosInstance.post("/admin/email-test", { to });
      setResult({ ok: true, text: data.message });
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.message || "The test email could not be sent." });
    } finally {
      setSending(false);
    }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Mail className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-black text-slate-900">Email delivery</h2><p className="mt-0.5 text-sm text-slate-500">Students need the email code to sign up and reset passwords. Check the setup here if codes are not arriving.</p></div>
      </div>
      <AdminActionButton variant="secondary" onClick={check} loading={checking}>Check email setup</AdminActionButton>
    </div>

    {status && (status.error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{status.error}</p> : <div className="mt-4 space-y-3 text-sm">
      <dl className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Service</dt><dd className="font-bold text-slate-800">{status.provider}</dd></div>
        <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Sent from</dt><dd className="break-all font-bold text-slate-800">{status.from || "—"}</dd></div>
        {status.smtp && <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">SMTP server</dt><dd className="font-bold text-slate-800">{status.smtp.host}:{status.smtp.port} · {status.smtp.secure ? "SSL" : "STARTTLS"}</dd></div>}
        {status.smtp && <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Mailbox</dt><dd className="break-all font-bold text-slate-800">{status.smtp.user || "not set"} · password {status.smtp.passwordSet ? "set" : "missing"}</dd></div>}
      </dl>
      {status.login && <p className={`flex items-start gap-2 rounded-xl p-3 font-bold ${status.login.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{status.login.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}{status.login.message}</p>}
      {status.warnings?.map((warning) => <p key={warning} className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 font-bold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}</p>)}
      {!status.warnings?.length && status.login?.ok !== false && <p className="text-slate-500">No setup problems found. Send a test email below to confirm delivery.</p>}
    </div>)}

    <form onSubmit={sendTest} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label className="min-w-0 flex-1"><span className="sr-only">Send a test email to</span><input type="email" required value={to} onChange={(event) => setTo(event.target.value)} placeholder="Send a test email to, e.g. you@gmail.com" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary" /></label>
      <AdminActionButton type="submit" icon={Send} loading={sending} disabled={sending}>Send test email</AdminActionButton>
    </form>
    {result && <p className={`mt-3 rounded-xl p-3 text-sm font-bold ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{result.text}</p>}
  </section>;
}
