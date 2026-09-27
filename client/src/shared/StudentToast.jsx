import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const styles = {
  success: { icon: CheckCircle2, iconClass: "bg-emerald-50 text-emerald-600", border: "border-emerald-100", fallback: "Success" },
  error: { icon: AlertCircle, iconClass: "bg-rose-50 text-rose-600", border: "border-rose-100", fallback: "Please check this" },
  warning: { icon: AlertCircle, iconClass: "bg-amber-50 text-amber-600", border: "border-amber-100", fallback: "One more step" },
  info: { icon: Info, iconClass: "bg-primary-soft text-primary", border: "border-primary-muted", fallback: "IlmiDunya" },
};

const StudentToast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const addToast = (event) => {
      const id = crypto.randomUUID();
      const toast = { id, leaving: false, ...event.detail };
      setToasts((current) => [...current, toast].slice(-3));
      const duration = Number(event.detail.duration) || 4200;
      window.setTimeout(() => setToasts((current) => current.map((item) => item.id === id ? { ...item, leaving: true } : item)), duration - 280);
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), duration);
    };
    window.addEventListener("student-toast", addToast);
    return () => window.removeEventListener("student-toast", addToast);
  }, []);

  const dismiss = (id) => {
    setToasts((current) => current.map((item) => item.id === id ? { ...item, leaving: true } : item));
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 260);
  };

  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-center gap-3 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm">
      {toasts.map((toast) => {
        const appearance = styles[toast.type] || styles.info;
        const Icon = appearance.icon;
        return <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} className={`student-toast pointer-events-auto w-full rounded-2xl border bg-white/95 p-4 shadow-2xl shadow-slate-900/15 backdrop-blur-xl ${appearance.border} ${toast.leaving ? "student-toast-leaving" : ""}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${appearance.iconClass}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-950">{toast.title || appearance.fallback}</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">{toast.message}</p></div>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
          <span className="student-toast-progress mt-3 block h-0.5 origin-left rounded-full bg-primary" />
        </div>;
      })}
    </div>
  );
};

export default StudentToast;
