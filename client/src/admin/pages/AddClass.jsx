// import React, { useState, useEffect, useCallback } from "react";
// import {
//   GraduationCap,
//   Save,
//   Trash2,
//   Layers,
//   Loader2,
// } from "lucide-react";
// import axiosInstance from "../../api/axios";

// const AddClass = () => {
//   const [classesList, setClassesList] = useState([]);
//   const [classInput, setClassInput] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [submitting, setSubmitting] = useState(false);

//   // Single, reusable fetch function
//   const fetchClasses = useCallback(async () => {
//     setLoading(true);
//     try {
//       const response = await axiosInstance.get("/classes");
  
//       const classes = response.data?.classes || response.data || [];
//       setClassesList(Array.isArray(classes) ? classes : []);
//     } catch (error) {
//       console.error("Fetch classes error:", error);
//       setError("Failed to load classes. Please refresh.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
    
//     fetchClasses();
//   }, [fetchClasses]);

//   // Add Class
//   const handleSaveClass = async (e) => {
//     e.preventDefault();
//     setError("");

//     const trimmedInput = classInput.trim();
//     if (!trimmedInput) {
//       setError("Please enter a valid class name.");
//       return;
//     }

//     setSubmitting(true);
//     try {
//       const response = await axiosInstance.post("/classes", {
//         name: trimmedInput,
//       });

//       alert(response.data.message || "Class added successfully!");
//       setClassInput("");
//       // Re‑fetch to sync with DB
//       await fetchClasses();
//     } catch (error) {
//       const msg = error.response?.data?.message || "Something went wrong.";
//       setError(msg);
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   // Delete Class
//   const handleDeleteClass = async (id) => {
//     if (!window.confirm("Are you sure you want to delete this class?")) return;

//     try {
//       const response = await axiosInstance.delete(`/classes/${id}`);
//       alert(response.data.message || "Class deleted.");
//       await fetchClasses();
//     } catch (error) {
//       alert(error.response?.data?.message || "Failed to delete class.");
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans antialiased text-slate-800">
//       <div className="max-w-4xl mx-auto space-y-6">

//         {/* Header */}
//         <div className="flex items-center gap-4 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] p-6 rounded-2xl border border-indigo-500/10 shadow-md shadow-indigo-900/10">
//           <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md text-white shadow-inner">
//             <GraduationCap className="w-6 h-6 stroke-[2]" />
//           </div>
//           <div>
//             <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
//               Manage Classes
//             </h1>
//             <p className="text-xs text-indigo-100/90 font-medium mt-1">
//               Configure and manage academic classes for all educational boards.
//             </p>
//           </div>
//         </div>

//         {/* Add Class Card */}
//         <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6">
//           <h2 className="text-md font-extrabold uppercase tracking-wider text-[#443dd7] mb-4">
//             Add New Academic Class
//           </h2>

//           <form onSubmit={handleSaveClass} className="space-y-4">
//             <div className="flex flex-col sm:flex-row items-start gap-4">
//               <div className="w-full sm:max-w-md">
//                 <input
//                   type="text"
//                   placeholder="Enter Class (e.g. 9th, 10th, 11th)"
//                   value={classInput}
//                   onChange={(e) => setClassInput(e.target.value)}
//                   disabled={submitting}
//                   className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#443dd7] focus:bg-white transition-all duration-200 disabled:opacity-60"
//                 />
//                 {error && (
//                   <p className="text-xs font-semibold text-rose-500 mt-1.5 pl-1">
//                     {error}
//                   </p>
//                 )}
//               </div>

//               <button
//                 type="submit"
//                 disabled={submitting}
//                 className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#443dd7] hover:bg-[#352ebd] text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
//               >
//                 {submitting ? (
//                   <Loader2 className="w-4 h-4 animate-spin" />
//                 ) : (
//                   <Save className="w-4 h-4" />
//                 )}
//                 {submitting ? "Saving..." : "Save Class"}
//               </button>
//             </div>
//           </form>
//         </div>

//         {/* Classes Table */}
//         <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
//           <div className="p-6 border-b border-slate-300 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Layers className="w-4 h-4 text-white" />
//               <h3 className="text-sm font-bold uppercase tracking-wider text-white">
//                 All Configured Classes
//               </h3>
//             </div>
//             <span className="text-xs font-bold text-gray-900 bg-yellow-500 px-2.5 py-1 rounded-full">
//               {loading ? "..." : classesList.length}
//             </span>
//           </div>

//           {loading ? (
//             <div className="p-12 text-center">
//               <Loader2 className="w-8 h-8 animate-spin text-[#443dd7] mx-auto" />
//               <p className="mt-2 text-sm text-slate-400">Loading classes…</p>
//             </div>
//           ) : classesList.length === 0 ? (
//             <div className="p-12 text-center">
//               <p className="text-sm font-medium text-slate-400">
//                 No classes added yet.
//               </p>
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-left border-collapse">
//                 <thead>
//                   <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
//                     <th className="py-3 px-6">Class Name</th>
//                     <th className="py-3 px-6">Date Created</th>
//                     <th className="py-3 px-6 text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100 text-sm">
//                   {classesList.map((item) => (
//                     <tr key={item._id} className="hover:bg-slate-50/40 transition-colors">
//                       <td className="py-3.5 px-6 font-semibold text-slate-800">
//                         {item.name}
//                       </td>
//                       <td className="py-3.5 px-6 text-slate-500">
//                         {item.createdAt
//                           ? new Date(item.createdAt).toLocaleDateString("en-US", {
//                               month: "short",
//                               day: "2-digit",
//                               year: "numeric",
//                             })
//                           : "—"}
//                       </td>
//                       <td className="py-3.5 px-6 text-right">
//                         <button
//                           onClick={() => handleDeleteClass(item._id)}
//                           className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer"
//                           title="Delete Class"
//                         >
//                           <Trash2 className="w-3.5 h-3.5" />
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default AddClass;

import React from "react";
import { GraduationCap } from "lucide-react";
import EntityManager from "../components/EntityManager";

const AddClass = () => (
  <EntityManager
    pageTitle="Manage Classes"
    pageDescription="Configure and manage academic classes for all educational boards."
    sectionTitle="Add New Academic Class"
    placeholder="Enter Class (e.g. 9th, 10th, 11th)"
    endpoint="/classes"
    entityName="classes"
    Icon={GraduationCap}
  />
);

export default AddClass;