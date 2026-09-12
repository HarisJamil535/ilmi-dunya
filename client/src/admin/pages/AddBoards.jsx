// import React, { useState, useEffect, useCallback } from "react";
// import axiosInstance from "../../api/axios";
// import { Landmark, Save, Trash2, Layers, Loader2 } from "lucide-react";

// const AddBoards = () => {
//   const [boardsList, setBoardsList] = useState([]);
//   const [boardInput, setBoardInput] = useState("");
//   const [error, setError] = useState("");
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [isLoading, setIsLoading] = useState(true);

//   // Fetch all boards
//   const fetchBoards = useCallback(async () => {
//     try {
//       setIsLoading(true);
//       const response = await axiosInstance.get("/boards");
//       // Fallback to empty array if response shape differs
//       setBoardsList(response.data.boards || response.data || []);
//     } catch (err) {
//       console.error("Fetch error:", err.response?.data || err.message);
//     } finally {
//       setIsLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchBoards();
//   }, [fetchBoards]);

//   // Handle Save Board (POST)
//   const handleSaveBoard = async (e) => {
//     e.preventDefault();
//     setError("");

//     const trimmedInput = boardInput.trim();

//     if (!trimmedInput) {
//       setError("Please enter a valid board name.");
//       return;
//     }

//     try {
//       setIsSubmitting(true);
//       await axiosInstance.post("/boards", {
//   name: trimmedInput,
// });

//       setBoardInput("");
//       // Re-fetch list to sync state with backend immediately
//       await fetchBoards();
//     } catch (err) {
//       setError(err.response?.data?.message || "Failed to save board. Please try again.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//  // Handle Delete Board (DELETE)
// const handleDeleteBoard = async (id) => {
//   // Optional confirmation prompt
//   if (!window.confirm("Are you sure you want to delete this board?")) return;

//   try {
//     const response = await axiosInstance.delete(`/boards/${id}`);

//     // 1. Immediately remove the item from state so the table updates on screen
//     setBoardsList((prev) => prev.filter((item) => (item._id || item.id) !== id));

//     // 2. Defer the alert so React finishes repainting the DOM first
//     setTimeout(() => {
//       alert(response.data.message || "Board deleted successfully!");
//     }, 50);

//   } catch (error) {
//     alert(error.response?.data?.message || "Something went wrong.");
//     // Re-fetch to restore state in case of an error
//     fetchBoards();
//   }
// };

//   // Helper to safely format ISO strings or standard date strings
//   const formatDate = (dateStr) => {
//     if (!dateStr) return "N/A";
//     const parsedDate = new Date(dateStr);
//     return isNaN(parsedDate.getTime())
//       ? dateStr
//       : parsedDate.toLocaleDateString("en-US", {
//           month: "short",
//           day: "2-digit",
//           year: "numeric",
//         });
//   };

//   return (
//     <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans antialiased text-slate-800">
//       <div className="max-w-4xl mx-auto space-y-6">

//         {/* ================= PAGE TITLE HEADER ================= */}
//         <div className="flex items-center gap-4 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] p-6 rounded-2xl border border-indigo-500/10 shadow-md shadow-indigo-900/10">
//           <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md text-white shadow-inner">
//             <Landmark className="w-6 h-6 stroke-[2]" />
//           </div>
//           <div>
//             <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
//               Manage Educational Boards
//             </h1>
//             <p className="text-xs text-indigo-100/90 font-medium mt-1">
//               Configure and map examination boards for Pakistani academic curriculum.
//             </p>
//           </div>
//         </div>

//         {/* ================= ADD NEW BOARD FORM CARD ================= */}
//         <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6">
//           <h2 className="text-md font-extrabold uppercase tracking-wider text-[#443dd7] mb-4">
//             Add New Educational Board
//           </h2>

//           <form onSubmit={handleSaveBoard} className="space-y-4">
//             <div className="flex flex-col sm:flex-row items-start gap-4">
//               <div className="w-full sm:max-w-md">
//                 <input
//                   type="text"
//                   placeholder="Enter Board Name (e.g. Federal Board, BISE Lahore)"
//                   value={boardInput}
//                   onChange={(e) => setBoardInput(e.target.value)}
//                   disabled={isSubmitting}
//                   className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#443dd7] focus:bg-white disabled:opacity-60 transition-all duration-200"
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
//                 className="w-full sm:w-auto flex items-center justify-center cursor-pointer gap-2 px-6 py-2.5 bg-[#443dd7] hover:bg-[#352ebd] disabled:bg-indigo-300 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all duration-200 shrink-0"
//               >
//                 {isSubmitting ? (
//                   <Loader2 className="w-4 h-4 animate-spin" />
//                 ) : (
//                   <Save className="w-4 h-4" />
//                 )}
//                 {isSubmitting ? "Saving..." : "Save Board"}
//               </button>
//             </div>
//           </form>
//         </div>

//         {/* ================= SAVED BOARDS DATATABLE ================= */}
//         <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
//           <div className="p-6 border-b border-slate-300 bg-gradient-to-br from-[#352ec0] via-[#443dd7] to-[#7771e7] flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Layers className="w-4 h-4 text-white" />
//               <h3 className="text-sm font-bold uppercase tracking-wider text-white">
//                 All Configured Boards
//               </h3>
//             </div>
//             <span className="text-xs font-bold text-gray-900 bg-yellow-500 px-2.5 py-1 rounded-full">
//               {boardsList.length} Total
//             </span>
//           </div>

//           {isLoading ? (
//             <div className="p-12 text-center flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
//               <Loader2 className="w-5 h-5 animate-spin text-[#443dd7]" /> Loading boards...
//             </div>
//           ) : boardsList.length === 0 ? (
//             <div className="p-12 text-center">
//               <p className="text-sm font-medium text-slate-400">No educational boards configured yet.</p>
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-left border-collapse">
//                 <thead>
//                   <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
//                     <th className="py-3 px-6">Board Name</th>
//                     <th className="py-3 px-6">Date Created</th>
//                     <th className="py-3 px-6 text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100 text-sm">
//                   {boardsList.map((item) => {
//                     const boardId = item._id || item.id;
//                     const name = item.name || item.boardName;

//                     return (
//                       <tr key={boardId} className="hover:bg-slate-50/40 transition-colors group">
//                         <td className="py-3.5 px-6 font-semibold text-slate-800">
//                           {name}
//                         </td>
//                         <td className="py-3.5 px-6 text-slate-400 font-medium">
//                           {formatDate(item.createdAt)}
//                         </td>
//                         <td className="py-3.5 px-6 text-right">
//                           <button
//                             onClick={() => handleDeleteBoard(boardId)}
//                             className="p-1.5 rounded-lg cursor-pointer text-white bg-rose-600 hover:bg-rose-700 transition-all duration-150"
//                             title="Delete board"
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
//     </div>
//   );
// };

// export default AddBoards;

import React from "react";
import { Landmark } from "lucide-react";
import EntityManager from "../components/EntityManager";

const AddBoards = () => (
  <EntityManager
    pageTitle="Manage Educational Boards"
    pageDescription="Configure and map examination boards for academic curriculum."
    sectionTitle="Add New Educational Board"
    placeholder="Enter Board Name (e.g. Federal Board, BISE Lahore)"
    endpoint="/boards"
    entityName="boards"
    Icon={Landmark}
  />
);

export default AddBoards;