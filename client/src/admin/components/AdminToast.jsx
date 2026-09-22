import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

const AdminToast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const addToast = (event) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, ...event.detail }].slice(-3));
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 3600);
    };
    window.addEventListener("admin-toast", addToast);
    return () => window.removeEventListener("admin-toast", addToast);
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const Icon = isError ? XCircle : CheckCircle2;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-in fade-in slide-in-from-top-2 rounded-2xl border bg-white p-4 shadow-2xl shadow-slate-900/12 ${isError ? "border-rose-100" : "border-emerald-100"}`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${isError ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-black text-slate-950">{isError ? "Action needed" : "Success"}</p>
                <p className="mt-0.5 text-sm font-semibold leading-5 text-slate-500">{toast.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminToast;
