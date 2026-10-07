import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import axiosInstance from "../../api/axios";

const inputClass = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10";

export const AuthField = ({ label, error, className = "", ...props }) => (
  <label className={`block ${className}`}>
    <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
    <input {...props} aria-invalid={Boolean(error)} className={`${inputClass} ${error ? "border-rose-400 bg-rose-50/40 focus:border-rose-400 focus:ring-rose-100" : ""}`} />
    {error && <span className="mt-1.5 block text-xs font-bold text-rose-600">{error}</span>}
  </label>
);

export const PasswordField = ({ label = "Password", error, className = "", ...props }) => {
  const [visible, setVisible] = useState(false);
  return <label className={`block ${className}`}>
    <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
    <span className="relative block">
      <input {...props} type={visible ? "text" : "password"} aria-invalid={Boolean(error)} className={`${inputClass} pr-12 ${error ? "border-rose-400 bg-rose-50/40 focus:border-rose-400 focus:ring-rose-100" : ""}`} />
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-primary-soft hover:text-primary">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
    </span>
    {error && <span className="mt-1.5 block text-xs font-bold text-rose-600">{error}</span>}
  </label>;
};

export const OtpField = ({ value, onChange, error }) => <label className="block">
  <span className="mb-2 block text-sm font-bold text-slate-700">6-digit verification code</span>
  <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-invalid={Boolean(error)} className={`${inputClass} text-center text-xl font-black tracking-[0.45em] ${error ? "border-rose-400" : ""}`} />
  {error && <span className="mt-1.5 block text-xs font-bold text-rose-600">{error}</span>}
</label>;

const loadGoogleScript = () => new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve();
  let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (!script) {
    script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
  script.addEventListener("load", resolve, { once: true });
  script.addEventListener("error", reject, { once: true });
});

export const GoogleIdentityButton = ({ onCredential, disabled = false, intent = "continue_with" }) => {
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { callbackRef.current = onCredential; }, [onCredential]);

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      try {
        const { data: options } = await axiosInstance.get("/students/auth-options");
        if (!options.googleClientId) {
          if (active) setSetup({ unavailable: true });
          return;
        }
        const { data: nonce } = await axiosInstance.post("/students/google/nonce");
        if (active) setSetup({ clientId: options.googleClientId, ...nonce });
      } catch {
        if (active) setSetup({ unavailable: true });
      }
    };
    prepare();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!setup?.clientId || !containerRef.current) return undefined;
    loadGoogleScript().then(() => {
      if (!active || !containerRef.current) return;
      const element = containerRef.current;
      element.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: setup.clientId,
        nonce: setup.nonce,
        callback: (response) => callbackRef.current(response.credential, setup.challengeId, setup.nonce),
      });
      window.google.accounts.id.renderButton(element, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: intent,
        logo_alignment: "left",
        width: Math.max(220, Math.min(400, Math.floor(element.clientWidth || 360))),
      });
    }).catch(() => active && setError("Google sign-in could not be loaded. You can use email or WhatsApp instead."));
    return () => { active = false; };
  }, [intent, setup]);

  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
    <div className="mb-2.5 flex items-center gap-2 px-1">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
      <div className="min-w-0"><p className="text-xs font-black text-slate-800">Quick and secure with Google</p><p className="truncate text-[11px] text-slate-500">Google verifies your name and email.</p></div>
    </div>
    {setup?.clientId ? <div ref={containerRef} className={`flex min-h-11 justify-center overflow-hidden rounded-full bg-white ${disabled ? "pointer-events-none opacity-50" : ""}`} /> : setup?.unavailable ? <div className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-500"><ShieldCheck className="h-4 w-4" />Google sign-in unavailable</div> : <div className="h-11 animate-pulse rounded-full bg-slate-100" aria-label="Loading Google sign-in" />}
    {error && <p role="status" className="text-center text-xs font-semibold text-amber-700">{error}</p>}
  </div>;
};

export const AuthSubmit = ({ loading, children, className = "" }) => <button disabled={loading} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark hover:shadow-primary/30 disabled:cursor-wait disabled:opacity-60 ${className}`}>
  {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{children}
</button>;
