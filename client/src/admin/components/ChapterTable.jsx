import React, { useState, useMemo } from "react";
import { ArrowRight, Search, Bookmark, Layers, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DeleteButton, EditButton } from "./AdminUI";

export const ChapterTable = ({ chapters, onEdit, onDelete }) => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const filteredChapters = useMemo(() => {
        return chapters.filter((chapter) =>
            chapter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(chapter.chapterNumber).includes(searchTerm)
        );
    }, [chapters, searchTerm]);

    const totalPages = Math.ceil(filteredChapters.length / itemsPerPage) || 1;

    // Adjust current page if search term changes and current page exceeds new total pages
    const effectivePage = currentPage > totalPages ? 1 : currentPage;

    const paginatedChapters = useMemo(() => {
        const start = (effectivePage - 1) * itemsPerPage;
        return filteredChapters.slice(start, start + itemsPerPage);
    }, [filteredChapters, effectivePage]);

    const startIndex = filteredChapters.length === 0 ? 0 : (effectivePage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(effectivePage * itemsPerPage, filteredChapters.length);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const getDisplayName = (value) => {
        if (!value) return "";
        if (typeof value === "string") return value.length > 18 ? "Selected" : value;
        return value.name || value.title || "";
    };

    return (
        <div className="flex flex-col flex-1 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200/80">
            {/* Search Bar Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search chapters by name or number..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all shadow-2xs"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => { setSearchTerm(""); setCurrentPage(1); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-xs font-medium text-slate-500 self-end sm:self-center">
                    Showing <strong className="text-slate-800">{filteredChapters.length}</strong> of {chapters.length} Chapters
                </div>
            </div>

            {/* Striped Table */}
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase text-xs tracking-wider">
                            <th className="px-6 py-4 font-bold w-24">Ch #</th>
                            <th className="px-6 py-4 font-bold">Chapter Details & Academic Context</th>
                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                        {paginatedChapters.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-6 py-16 text-center text-slate-400 text-sm bg-white">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <Filter className="w-8 h-8 text-slate-300 mb-1" />
                                        <p className="font-semibold text-slate-600">No chapters found</p>
                                        <p className="text-xs text-slate-400">Add a new chapter to get started.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedChapters.map((chapter, index) => (
                                <tr 
                                    key={chapter._id} 
                                    className={`transition-colors group ${
                                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                                    } hover:bg-primary-soft/40`}
                                >
                                    <td className="px-6 py-4 align-middle">
                                        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-soft text-primary font-extrabold font-mono text-md border border-primary-soft shadow-2xs">
                                            {chapter.chapterNumber || 1}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 align-middle">
                                        <div className="space-y-2">
                                            <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                                <Bookmark className="w-4 h-4 text-primary shrink-0" />
                                                <span className="truncate">{chapter.name}</span>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-2">
                                                {chapter.board && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
                                                        Board: {getDisplayName(chapter.board)}
                                                    </span>
                                                )}
                                                {chapter.class && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs">
                                                        Class: {getDisplayName(chapter.class)}
                                                    </span>
                                                )}
                                                {chapter.group && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                                                        Group: {getDisplayName(chapter.group)}
                                                    </span>
                                                )}
                                                {chapter.subject && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60 shadow-2xs">
                                                        <Layers className="w-3 h-3" /> {getDisplayName(chapter.subject)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => navigate(`/admin/chapters/${chapter._id}/topics`)}
                                                className="inline-flex items-center gap-1.5 bg-primary-soft text-primary hover:bg-primary hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                            >
                                                Manage Topics <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                            
                                            <EditButton onClick={() => onEdit(chapter)} />
                                            <DeleteButton onClick={() => onDelete(chapter)} />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            {filteredChapters.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-slate-500 font-medium">
                        Showing <span className="font-bold text-slate-800">{startIndex}</span> to <span className="font-bold text-slate-800">{endIndex}</span> of <span className="font-bold text-slate-800">{filteredChapters.length}</span> results
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={effectivePage === 1}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>

                        <div className="flex items-center gap-1 px-2">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        effectivePage === page
                                            ? "bg-primary text-white shadow-sm"
                                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={effectivePage === totalPages}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
