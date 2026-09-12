import React, { useState, useEffect, useCallback } from "react";
import { Save, Trash2, Layers, Loader2, CheckCircle2 } from "lucide-react";
import axiosInstance from "@/api/axios";
import DeleteConfirmationModal from "../../shared/DeleteConfirmationModal"; 

const EntityManager = ({
  pageTitle,
  pageDescription,
  sectionTitle,
  placeholder,
  endpoint,
  entityName,
  Icon = Layers,
}) => {
  const [items, setItems] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fetch Items
  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axiosInstance.get(endpoint);
      const data = res.data[entityName] || res.data.data || res.data || [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Fetch ${entityName} error:`, err);
      setError(`Failed to load ${entityName}.`);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, entityName]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const trimmed = inputVal.trim();

    if (!trimmed) {
      setError(`Please enter a valid ${entityName} name.`);
      return;
    }

    // Duplicate Check
    const exists = items.some(
      (item) =>
        (item.name || item.groupName || item.boardName || "").toLowerCase() ===
        trimmed.toLowerCase()
    );

    if (exists) {
      setError(`This ${entityName} has already been saved.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await axiosInstance.post(endpoint, { name: trimmed, groupName: trimmed });
      setInputVal("");
      setSuccessMsg(`${entityName} added successfully!`);
      await fetchItems();

      // Auto-hide success message after 4 seconds
      setTimeout(() => {
        setSuccessMsg("");
      }, 4000);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to save ${entityName}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingId(deleteTarget.id);
      await axiosInstance.delete(`${endpoint}/${deleteTarget.id}`);
      setItems((prev) => prev.filter((i) => (i._id || i.id) !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.message || `Failed to delete ${entityName}.`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex items-center gap-4 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] p-6 rounded-2xl shadow-md text-white">
          <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md">
            {React.createElement(Icon || Layers, { className: "w-6 h-6 stroke-[2]" })}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="text-xs text-indigo-100/90 mt-1">{pageDescription}</p>
          </div>
        </div>

        {/* Add Form Card */}
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6">
          <h2 className="text-md font-extrabold uppercase tracking-wider text-[#443dd7] mb-4">
            {sectionTitle}
          </h2>

          {/* Success Banner */}
          {successMsg && (
            <div className="flex items-center gap-2 p-3.5 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl transition-all">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder={placeholder}
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    if (error) setError("");
                    if (successMsg) setSuccessMsg("");
                  }}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#443dd7] focus:bg-white transition-all disabled:opacity-50"
                />
                {error && <p className="text-xs font-semibold text-rose-500 mt-1.5 pl-1">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#443dd7] hover:bg-[#352ebd] text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSubmitting ? "Saving..." : `Save ${entityName}`}
              </button>
            </div>
          </form>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider">All Configured {entityName}s</h3>
            </div>
            <span className="text-xs font-bold text-gray-900 bg-yellow-500 px-2.5 py-1 rounded-full">
              {items.length} Total
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#443dd7] mx-auto mb-2" />
              <p className="text-sm">Loading {entityName}s...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No {entityName}s configured yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400">
                    <th className="py-3 px-6">Name</th>
                    <th className="py-3 px-6">Date Created</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {items.map((item) => {
                    const id = item._id || item.id;
                    const name = item.groupName || item.name || item.boardName;
                    return (
                      <tr key={id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-slate-800">{name}</td>
                        <td className="py-3.5 px-6 text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "N/A"}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => setDeleteTarget({ id, name })}
                            className="p-1.5 rounded-lg text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reusable Delete Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        itemName={deleteTarget?.name}
        entityName={entityName}
        isDeleting={deletingId !== null}
      />
    </div>
  );
};

export default EntityManager;