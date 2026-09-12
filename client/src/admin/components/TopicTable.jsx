import React, { useState, useMemo } from "react";
import { Trash2, Edit3, Search, FileText, Filter, X, ChevronLeft, ChevronRight, Video, ExternalLink } from "lucide-react";

export const TopicTable = ({ topics, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const filteredTopics = useMemo(() => {
        return topics.filter((topic) =>
            topic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(topic.topicNumber).includes(searchTerm) ||
            (topic.description && topic.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [topics, searchTerm]);

    const totalPages = Math.ceil(filteredTopics.length / itemsPerPage) || 1;
    const effectivePage = currentPage > totalPages ? 1 : currentPage;

    const paginatedTopics = useMemo(() => {
        const start = (effectivePage - 1) * itemsPerPage;
        return filteredTopics.slice(start, start + itemsPerPage);
    }, [filteredTopics, effectivePage]);

    const startIndex = filteredTopics.length === 0 ? 0 : (effectivePage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(effectivePage * itemsPerPage, filteredTopics.length);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    return (
        <div className="flex flex-col flex-1 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200/80">
            {/* Search Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search topics by name or number..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#443DD7] focus:ring-4 focus:ring-indigo-50 outline-none transition-all shadow-2xs"
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
                    Showing <strong className="text-slate-800">{filteredTopics.length}</strong> of {topics.length} Topics
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase text-xs tracking-wider">
                            <th className="px-6 py-4 font-bold w-24">Topic #</th>
                            <th className="px-6 py-4 font-bold">Topic Name & Description</th>
                            <th className="px-6 py-4 font-bold w-36">Video Lesson</th>
                            <th className="px-6 py-4 font-bold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                        {paginatedTopics.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-16 text-center text-slate-400 text-sm bg-white">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <Filter className="w-8 h-8 text-slate-300 mb-1" />
                                        <p className="font-semibold text-slate-600">No topics match search criteria</p>
                                        <p className="text-xs text-slate-400">Try clearing the search query or adding a new topic.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedTopics.map((topic, index) => (
                                <tr 
                                    key={topic._id} 
                                    className={`transition-colors group ${
                                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                                    } hover:bg-indigo-50/40`}
                                >
                                    <td className="px-6 py-4 align-middle">
                                        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 text-[#443DD7] font-bold font-mono text-sm border border-indigo-100 shadow-2xs">
                                            #{topic.topicNumber || 1}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 align-middle">
                                        <div className="space-y-1.5">
                                            <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-[#443DD7] shrink-0" />
                                                <span className="truncate">{topic.name}</span>
                                            </div>
                                            {topic.description && (
                                                <p className="text-xs text-slate-500 line-clamp-1 max-w-xl">
                                                    {topic.description}
                                                </p>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 align-middle">
                                        {topic.videoUrl ? (
                                            <a
                                                href={topic.videoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200/60 transition-all shadow-2xs"
                                                title="Watch YouTube Video"
                                            >
                                                <Video className="w-3.5 h-3.5 shrink-0" /> Watch Video <ExternalLink className="w-3 h-3 shrink-0" />
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">No link</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 align-middle text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => onEdit(topic)}
                                                className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-xl transition-all cursor-pointer border border-amber-200/60 shadow-2xs"
                                                title="Edit Topic"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>

                                            <button 
                                                onClick={() => onDelete(topic)}
                                                className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all cursor-pointer border border-rose-200/60 shadow-2xs"
                                                title="Delete Topic"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {filteredTopics.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-slate-500 font-medium">
                        Showing <span className="font-bold text-slate-800">{startIndex}</span> to <span className="font-bold text-slate-800">{endIndex}</span> of <span className="font-bold text-slate-800">{filteredTopics.length}</span> results
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
                                            ? "bg-[#443DD7] text-white shadow-sm"
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