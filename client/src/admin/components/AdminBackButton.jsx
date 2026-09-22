import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const AdminBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === "/admin/dashboard" || location.pathname === "/admin";

  if (isDashboard) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-primary/30 hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
};

export default AdminBackButton;
