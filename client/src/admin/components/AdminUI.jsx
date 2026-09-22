import { CheckCircle2, Loader2, Pencil, Save, Trash2, XCircle } from "lucide-react";

export const AdminPageHeader = ({ icon: Icon, eyebrow, title, description, statLabel, statValue }) => (
  <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-slate-950 p-7 text-white shadow-lg shadow-primary/10">
    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
      <div>
        {eyebrow && (
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/90 ring-1 ring-white/15">
            {Icon && <Icon className="h-4 w-4" />}
            {eyebrow}
          </div>
        )}
        <h1 className="mt-4 text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">{description}</p>}
      </div>
      {statLabel && (
        <div className="rounded-2xl bg-white/10 px-5 py-4 text-right ring-1 ring-white/15">
          <p className="text-3xl font-black">{statValue}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">{statLabel}</p>
        </div>
      )}
    </div>
  </header>
);

export const AdminActionButton = ({ variant = "primary", icon: Icon, loading, children, className = "", ...props }) => {
  const styles = {
    primary: "bg-primary text-white shadow-sm shadow-primary/20 hover:bg-primary-dark",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:border-primary/30 hover:text-primary",
    ghost: "bg-slate-100 text-slate-600 hover:bg-slate-200",
    edit: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    delete: "bg-rose-50 text-rose-600 hover:bg-rose-100",
    dark: "bg-slate-950 text-white hover:bg-slate-800",
  };

  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition duration-200 disabled:cursor-not-allowed disabled:opacity-55 ${styles[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
};

export const AdminIconButton = ({ variant = "secondary", icon: Icon, label, className = "", ...props }) => (
  <AdminActionButton
    variant={variant}
    className={`h-11 w-11 shrink-0 rounded-2xl px-0 shadow-sm ring-1 ring-inset ring-black/5 ${className}`}
    title={label}
    aria-label={label}
    {...props}
  >
    {Icon ? <Icon className="h-5 w-5 stroke-[2.4]" /> : null}
  </AdminActionButton>
);

export const EditButton = (props) => <AdminIconButton variant="edit" icon={Pencil} label="Edit" {...props} />;
export const DeleteButton = (props) => <AdminIconButton variant="delete" icon={Trash2} label="Delete" {...props} />;
export const SaveButton = ({ children = "Save", ...props }) => <AdminActionButton variant="primary" icon={Save} {...props}>{children}</AdminActionButton>;

export const AdminAlert = ({ type = "success", children }) => {
  if (!children) return null;
  const isError = type === "error";
  const Icon = isError ? XCircle : CheckCircle2;
  return (
    <div className={`animate-in fade-in slide-in-from-top-1 mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${isError ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
};

export const AdminLoader = ({ label = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
      <Loader2 className="h-6 w-6 animate-spin" />
    </span>
    <p className="text-sm font-black text-slate-500">{label}</p>
  </div>
);
