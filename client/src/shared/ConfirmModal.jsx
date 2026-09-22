import { AlertTriangle, Loader2, X } from "lucide-react";

const ConfirmModal = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "indigo",
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const toneClass = tone === "danger"
    ? "bg-rose-600 hover:bg-rose-700"
    : "bg-primary hover:bg-primary-dark";
  const iconClass = tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-primary-soft text-primary";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="pr-8">
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white transition disabled:opacity-60 ${toneClass}`}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
