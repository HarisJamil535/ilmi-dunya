import React, { useState, useEffect } from 'react';
import { Download, FileText, BookOpen, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { IoLogoYoutube } from "react-icons/io5";
import axiosInstance from '../../api/axios'; // Adjust path to your axios instance

const Chapters = () => {
    const [searchParams] = useSearchParams();
    // 1. Extract Filter Parameters from URL
    const classParam = searchParams.get('class');
    const boardParam = searchParams.get('board');
    const subjectParam = searchParams.get('subject');
    const subjectId = searchParams.get('subjectId');
    const groupParam = searchParams.get('group');

    // 2. State for Database Integration
    const [chapters, setChapters] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 3. Fetch Chapters from MongoDB Backend
    useEffect(() => {
        const fetchChapters = async () => {
            if (!boardParam || !classParam || (!subjectParam && !subjectId)) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                let query = `/chapters?board=${boardParam}&class=${classParam}`;
                if (subjectId) query += `&subjectId=${subjectId}`;
                if (subjectParam) query += `&subject=${subjectParam}`;
                if (groupParam) query += `&group=${groupParam}`;

                const response = await axiosInstance.get(query);
                const data = response.data.chapters || response.data || [];

                // Sort chapters numerically by chapterNumber (1, 2, 3...)
                data.sort((a, b) => (a.chapterNumber || 1) - (b.chapterNumber || 1));
                setChapters(data);
            } catch (err) {
                console.error("Failed to load chapters from database:", err);
                setError("Failed to load chapters from server. Please try again.");
                setChapters([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChapters();
    }, [boardParam, classParam, subjectParam, subjectId, groupParam]);

    // Unified styling structure for buttons
    const btnBaseClass = "flex items-center justify-center cursor-pointer gap-1.5 px-3 py-2 text-xs font-bold tracking-wide uppercase rounded-lg shadow-sm transition-all duration-200 active:scale-[0.98] w-full sm:w-auto";

    return (
        <main className="min-h-screen bg-slate-50/50 pt-16 px-6 md:px-12 lg:px-20 pb-20 font-sans">
            {/* Header Section */}
            <div className="max-w-5xl mx-auto mb-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200/60">
                    <div>
                        <h1 className="text-slate-900 font-extrabold text-2xl md:text-3xl lg:text-[2.25rem] tracking-tight leading-none">
                            Chapters of{' '}
                            <span className="relative inline-block text-indigo-600 font-black capitalize">
                                {subjectParam ? subjectParam.replace(/-/g, ' ') : 'Subject'}
                                <span className="absolute left-0 bottom-0 w-full h-[3px] bg-indigo-600/20 rounded" />
                            </span>
                            <span className="text-indigo-600 font-extrabold text-xl md:text-3xl ml-3">
                                Class {classParam}<sup className="text-md font-extrabold">th</sup>,
                            </span>
                            <span className="capitalize"> {boardParam}</span>
                            <span> Board</span>
                        </h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium">
                            Select a chapter to watch video lectures, download specific notes, or evaluate your skills.
                        </p>
                    </div>

                    {/* Global Subject Resources */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <button
                            title="Download Complete Book"
                            className="flex items-center justify-center cursor-pointer gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-blue-600 hover:text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 text-white hover:shadow-md hover:shadow-blue-500/10 transition-all duration-200 w-full sm:w-auto"
                        >
                            <BookOpen className="w-4 h-4" />
                            Download Full Book
                        </button>
                        
                        <button
                            title="Download Past Papers"
                            className="flex items-center justify-center cursor-pointer gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-amber-500 hover:text-amber-500 border border-amber-300 rounded-xl hover:bg-amber-100 text-white hover:shadow-md hover:shadow-amber-500/10 transition-all duration-200 w-full sm:w-auto"
                        >
                            <FileText className="w-4 h-4" />
                            Past Papers
                        </button>
                    </div>
                </div>
            </div>

            {/* Dynamic Chapters List Container */}
            <div className="max-w-5xl mx-auto flex flex-col gap-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <p className="text-sm font-semibold">Loading chapters from database...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-center text-sm font-medium">
                        {error}
                    </div>
                ) : chapters.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-800 mb-1">No Chapters Available</h3>
                        <p className="text-sm">There are no chapters uploaded for this subject yet.</p>
                    </div>
                ) : (
                    chapters.map((chapter) => {
                        const chapterNumStr = String(chapter.chapterNumber || 1).padStart(2, '0');
                        const chapterTitle = chapter.name || chapter.title || `Chapter ${chapter.chapterNumber}`;

                        return (
                            <div
                                key={chapter._id || chapter.chapterNumber}
                                className="group flex flex-col md:flex-row items-start md:items-center justify-between bg-white border border-slate-200 rounded-xl p-4 md:p-5 transition-all duration-300 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/[0.02]"
                            >
                                {/* Left: Chapter Details */}
                                <div className="flex items-center gap-4 w-full md:w-auto mb-4 md:mb-0">
                                    <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm tracking-wider group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                        {chapterNumStr}
                                    </span>
                                    <div>
                                        <h3 className="text-slate-800 font-semibold text-base md:text-lg group-hover:text-indigo-600 transition-colors duration-200">
                                            {chapterTitle}
                                        </h3>
                                        {chapter.description && (
                                            <p className="text-xs text-slate-400 font-normal line-clamp-1 mt-0.5">
                                                {chapter.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Chapter-Specific Actions Row */}
                                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start sm:justify-end border-t border-slate-100 md:border-none pt-4 md:pt-0">
                                    
                                    {/* Watch Video Button -> Navigates to Topic Video Page */}
                                    <Link 
                                        to={`/topics?chapterId=${chapter._id}&chapterNumber=${chapter.chapterNumber}&subject=${subjectParam}&class=${classParam}&board=${boardParam}${groupParam ? `&group=${groupParam}` : ''}`} 
                                        className="w-full sm:w-auto"
                                    >
                                        <button
                                            title="Watch Video Lessons"
                                            className={`${btnBaseClass} bg-red-50 text-red-500 border border-red-200 hover:text-white hover:bg-red-500`}
                                        >
                                            <IoLogoYoutube className="w-3.5 h-3.5" />
                                            Video
                                        </button>
                                    </Link>

                                    {/* Download Notes Button */}
                                    <Link 
                                        to={`/topics?chapterId=${chapter._id}&type=notes`} 
                                        className="w-full sm:w-auto"
                                    >
                                        <button
                                            title="Download Notes"
                                            className={`${btnBaseClass} bg-green-50 text-green-500 border border-green-200 hover:text-white hover:bg-green-500`}
                                        >
                                            <Download className="w-4 h-4" />
                                            Notes
                                        </button>
                                    </Link>

                                    {/* Take Test Button */}
                                    <Link 
                                        to={`/test?chapterId=${chapter._id}`} 
                                        className="w-full sm:w-auto"
                                    >
                                        <button className={`${btnBaseClass} bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-900/10`}>
                                            <FileText className="w-3.5 h-3.5" />
                                            Take Test
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </main>
    );
};

export default Chapters;
