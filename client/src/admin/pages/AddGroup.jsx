// import React, { useState, useEffect } from "react";
// import { BookOpen, Save, Trash2, Layers, Loader2, AlertTriangle, X } from "lucide-react";
// import axiosInstance from "@/api/axios";

// const AddGroup = () => {
//   // Academic groups state
//   const [groupsList, setGroupsList] = useState([]);

//   // Form & UI control states
//   const [groupInput, setGroupInput] = useState("");
//   const [error, setError] = useState("");
//   const [isLoading, setIsLoading] = useState(true);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [deletingId, setDeletingId] = useState(null);

//   // Custom Delete Modal state: stores group object { id, name } or null
//   const [deleteTarget, setDeleteTarget] = useState(null);

//   // Fetch groups on mount
//   const fetchGroup = async () => {
//     try {
//       setIsLoading(true);
//       const response = await axiosInstance.get("/groups");
//       setGroupsList(response.data.groups || response.data || []);
//     } catch (err) {
//       console.error(err.response?.data || err.message);
//       setError("Failed to load academic groups.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchGroup();
//   }, []);

//   // Handle Form Submission with API Post
//   const handleSaveGroup = async (e) => {
//     e.preventDefault();
//     setError("");

//     const trimmedInput = groupInput.trim();

//     if (!trimmedInput) {
//       setError("Please enter a valid group name.");
//       return;
//     }

//     if (
//       groupsList.some(
//         (item) =>
//           (item.groupName || item.name || "").toLowerCase() ===
//           trimmedInput.toLowerCase()
//       )
//     ) {
//       setError("This academic group has already been saved.");
//       return;
//     }

//     try {
//       setIsSubmitting(true);
//       await axiosInstance.post("/groups", {
//         groupName: trimmedInput,
//         name: trimmedInput,
//       });

//       await fetchGroup();
//       setGroupInput("");
//     } catch (err) {
//       console.error("Save Error:", err.response?.data || err.message);
//       setError(
//         err.response?.data?.message || "Failed to save group. Please try again."
//       );
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   // Triggered when user confirms deletion in the modal
//   const confirmDeleteGroup = async () => {
//     if (!deleteTarget) return;

//     const { id } = deleteTarget;

//     try {
//       setDeletingId(id);
//       await axiosInstance.delete(`/groups/${id}`);

//       setGroupsList((prev) =>
//         prev.filter((item) => (item._id || item.id) !== id)
//       );
//       setDeleteTarget(null); // Close modal on success
//     } catch (err) {
//       console.error("Delete Error details:", err.response?.data || err.message);
//       const backendError =
//         err.response?.data?.message ||
//         err.response?.data?.error ||
//         "Failed to delete academic group. Please try again.";
//       alert(backendError);
//     } finally {
//       setDeletingId(null);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans antialiased text-slate-800">
//       <div className="max-w-4xl mx-auto space-y-6">
        
//         {/* ================= PAGE TITLE HEADER ================= */}
//         <div className="flex items-center gap-4 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] p-6 rounded-2xl border border-indigo-500/10 shadow-md shadow-indigo-900/10">
//           <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md text-white shadow-inner">
//             <BookOpen className="w-6 h-6 stroke-[2]" />
//           </div>
//           <div>
//             <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
//               Manage Academic Groups
//             </h1>
//             <p className="text-xs text-indigo-100/90 font-medium mt-1">
//               Configure study disciplines and subject streams for matriculation and intermediate levels.
//             </p>
//           </div>
//         </div>

//         {/* ================= ADD NEW GROUP FORM CARD ================= */}
//         <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6">
//           <h2 className="text-md font-extrabold uppercase tracking-wider text-[#443dd7] mb-4">
//             Add New Academic Group
//           </h2>
          
//           <form onSubmit={handleSaveGroup} className="space-y-4">
//             <div className="flex flex-col sm:flex-row items-start gap-4">
//               <div className="w-full sm:max-w-md">
//                 <input
//                   type="text"
//                   placeholder="Enter Group Name (e.g. Science, Pre-Medical, Humanities)"
//                   value={groupInput}
//                   onChange={(e) => setGroupInput(e.target.value)}
//                   disabled={isSubmitting}
//                   className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#443dd7] focus:bg-white transition-all duration-200 disabled:opacity-50"
//                 />
//                 {error && (
//                   <p className="text-xs font-semibold text-rose-500 mt-1.5 pl-1">
//                     {error}
//                   </p>
//                 )}
//               </div>
              
//               <button
//                 type="submit"
//                 disabled={isSubmitting}
//                 className="w-full sm:w-auto flex items-center justify-center cursor-pointer gap-2 px-6 py-2.5 bg-[#443dd7] hover:bg-[#352ebd] text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
//               >
//                 {isSubmitting ? (
//                   <>
//                     <Loader2 className="w-4 h-4 animate-spin" />
//                     Saving...
//                   </>
//                 ) : (
//                   <>
//                     <Save className="w-4 h-4" />
//                     Save Group
//                   </>
//                 )}
//               </button>
//             </div>
//           </form>
//         </div>

//         {/* ================= SAVED GROUPS DATATABLE ================= */}
//         <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
//           <div className="p-6 border-b border-slate-300 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Layers className="w-4 h-4 text-white" />
//               <h3 className="text-sm font-bold uppercase tracking-wider text-white">
//                 All Configured Groups
//               </h3>
//             </div>
//             <span className="text-xs font-bold text-gray-900 bg-yellow-500 px-2.5 py-1 rounded-full">
//               {groupsList.length} Total
//             </span>
//           </div>

//           {isLoading ? (
//             <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
//               <Loader2 className="w-6 h-6 animate-spin text-[#443dd7]" />
//               <p className="text-sm font-medium text-slate-400">Loading academic groups...</p>
//             </div>
//           ) : groupsList.length === 0 ? (
//             <div className="p-12 text-center">
//               <p className="text-sm font-medium text-slate-400">No academic groups configured yet.</p>
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-left border-collapse">
//                 <thead>
//                   <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
//                     <th className="py-3 px-6">Group Name</th>
//                     <th className="py-3 px-6">Date Created</th>
//                     <th className="py-3 px-6 text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100 text-sm">
//                   {groupsList.map((item) => {
//                     const itemId = item._id || item.id;
//                     const groupTitle = item.groupName || item.name || "Unnamed Group";

//                     return (
//                       <tr key={itemId} className="hover:bg-slate-50/40 transition-colors group">
//                         <td className="py-3.5 px-6 font-semibold text-slate-800">
//                           {groupTitle}
//                         </td>
//                         <td className="py-3.5 px-6 text-slate-400 font-medium">
//                           {item.createdAt
//                             ? new Date(item.createdAt).toLocaleDateString("en-US", {
//                                 month: "short",
//                                 day: "2-digit",
//                                 year: "numeric",
//                               })
//                             : "N/A"}
//                         </td>
//                         <td className="py-3.5 px-6 text-right">
//                           <button
//                             onClick={() =>
//                               setDeleteTarget({ id: itemId, name: groupTitle })
//                             }
//                             className="p-1.5 rounded-lg cursor-pointer text-white bg-rose-600 hover:bg-rose-700 transition-all duration-150"
//                             title="Delete group"
//                           >
//                             <Trash2 className="w-3.5 h-3.5" />
//                           </button>
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>

//       </div>

//       {/* ================= CUSTOM DELETE CONFIRMATION POPUP MODAL ================= */}
//       {deleteTarget && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
//           {/* Modal Container */}
//           <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-5">
//             {/* Close Cross Button */}
//             <button
//               onClick={() => setDeleteTarget(null)}
//               disabled={deletingId !== null}
//               className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
//             >
//               <X className="w-5 h-5" />
//             </button>

//             {/* Header Icon & Title */}
//             <div className="flex items-center gap-3.5">
//               <div className="p-3 rounded-full bg-rose-50 text-rose-600 shrink-0">
//                 <AlertTriangle className="w-6 h-6 stroke-[2]" />
//               </div>
//               <div>
//                 <h3 className="text-lg font-bold text-slate-900">
//                   Delete Academic Group
//                 </h3>
//                 <p className="text-xs text-slate-500 font-medium">
//                   This action cannot be undone.
//                 </p>
//               </div>
//             </div>

//             {/* Modal Body Context */}
//             <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-sm text-slate-600">
//               Are you sure you want to delete{" "}
//               <span className="font-bold text-slate-800">
//                 "{deleteTarget.name}"
//               </span>
//               ?
//             </div>

//             {/* Action Buttons */}
//             <div className="flex items-center justify-end gap-3 pt-1">
//               <button
//                 type="button"
//                 onClick={() => setDeleteTarget(null)}
//                 disabled={deletingId !== null}
//                 className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-50"
//               >
//                 No, Cancel
//               </button>

//               <button
//                 type="button"
//                 onClick={confirmDeleteGroup}
//                 disabled={deletingId !== null}
//                 className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
//               >
//                 {deletingId ? (
//                   <>
//                     <Loader2 className="w-4 h-4 animate-spin" />
//                     Deleting...
//                   </>
//                 ) : (
//                   <>
//                     <Trash2 className="w-4 h-4" />
//                     Yes, Delete
//                   </>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default AddGroup;

import React from "react";
import { BookOpen } from "lucide-react";
import EntityManager from "../components/EntityManager";

const AddGroup = () => (
  <EntityManager
    pageTitle="Manage Academic Groups"
    pageDescription="Configure study disciplines and subject streams for matriculation and intermediate levels."
    sectionTitle="Add New Academic Group"
    placeholder="Enter Group Name (e.g. Science, Pre-Medical)"
    endpoint="/groups"
    entityName="groups"
    Icon={BookOpen}
  />
);

export default AddGroup;