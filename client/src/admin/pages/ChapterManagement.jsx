import React, { useState, useEffect, useContext } from "react";
import { Bookmark, Plus, ChevronRight, Loader2 } from "lucide-react";
import axiosInstance from "../../api/axios"; 
import { AppContext } from "../../context/AppContext";
import { CustomSelect } from "../../admin/components/CustomSelect";
import { ChapterTable } from "../../admin/components/ChapterTable";
import ChapterModal from "../../admin/components/ChapterModal";
import DeleteConfirmationModal from "../../admin/components/DeleteConfirmationModal";

const ChapterManagement = () => {
    const {
        boards,
        classes,
        groups,
        selectedBoard,
        setSelectedBoard,
        selectedClass,
        setSelectedClass,
        selectedGroup,
        setSelectedGroup,
        isLoadingContext,
        refreshContext
    } = useContext(AppContext);

    const [filteredSubjects, setFilteredSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

    const [chapters, setChapters] = useState([]);
    const [isLoadingChapters, setIsLoadingChapters] = useState(false);

    const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
    const [editingChapter, setEditingChapter] = useState(null);
    const [chapterToDelete, setChapterToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        refreshContext();
    }, [refreshContext]);

    useEffect(() => {
        const fetchFilteredSubjects = async () => {
            if (selectedBoard && selectedClass && selectedGroup) {
                setIsLoadingSubjects(true);
                setSelectedSubject("");
                try {
                    const response = await axiosInstance.get(
                        `/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`
                    );
                    setFilteredSubjects(response.data.subjects || []);
                } catch (error) {
                    console.error("Failed to load subjects for context", error);
                    setFilteredSubjects([]);
                } finally {
                    setIsLoadingSubjects(false);
                }
            } else {
                setFilteredSubjects([]);
                setSelectedSubject("");
            }
        };
        fetchFilteredSubjects();
    }, [selectedBoard, selectedClass, selectedGroup]);

    useEffect(() => {
        const fetchChapters = async () => {
            if (selectedBoard && selectedClass && selectedGroup && selectedSubject) {
                setIsLoadingChapters(true);
                try {
                    const response = await axiosInstance.get(
                        `/chapters?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}&subjectId=${selectedSubject}`
                    );
                    setChapters(response.data.chapters || []);
                } catch (error) {
                    console.error("Failed to load chapters", error);
                } finally {
                    setIsLoadingChapters(false);
                }
            } else {
                setChapters([]);
                setIsChapterModalOpen(false);
                setEditingChapter(null);
            }
        };
        fetchChapters();
    }, [selectedBoard, selectedClass, selectedGroup, selectedSubject]);

    const isFullContextSelected = selectedBoard && selectedClass && selectedGroup && selectedSubject;
    const selectedSubjectObj = filteredSubjects.find(s => s._id === selectedSubject);

    const handleSaveSuccess = (savedChapter, type) => {
        let updatedChapters;
        if (type === "update") {
            updatedChapters = chapters.map(ch => ch._id === savedChapter._id ? savedChapter : ch);
        } else {
            updatedChapters = [...chapters, savedChapter];
        }
        // Instantly sort numerically by chapterNumber ascending so new entries don't jump to the top
        updatedChapters.sort((a, b) => (a.chapterNumber || 1) - (b.chapterNumber || 1));
        setChapters(updatedChapters);
    };

    const handleOpenAddModal = () => {
        setEditingChapter(null);
        setIsChapterModalOpen(true);
    };

    const handleOpenEditModal = (chapter) => {
        setEditingChapter(chapter);
        setIsChapterModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!chapterToDelete) return;
        setIsDeleting(true);
        try {
            await axiosInstance.delete(`/chapters/${chapterToDelete._id}`);
            setChapters(chapters.filter((ch) => ch._id !== chapterToDelete._id));
            setChapterToDelete(null);
        } catch (error) {
            console.error("Failed to delete chapter", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F4F5F9] p-6 md:p-8 font-sans text-gray-800">
            <div className="flex items-center text-sm text-gray-500 mb-8">
                <span className="hover:text-[#443DD7] cursor-pointer transition-colors">Dashboard</span>
                <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                <span className="font-semibold text-gray-800">Manage Chapters</span>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white border border-indigo-100 shadow-sm rounded-xl text-[#443DD7]">
                        <Bookmark className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Chapters Overview</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure chapters for your selected subject and academic context.</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleOpenAddModal}
                    disabled={!isFullContextSelected}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                        isFullContextSelected 
                        ? "bg-[#443DD7] hover:bg-[#352EC0] text-white shadow-md hover:shadow-lg active:scale-95 cursor-pointer" 
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                    <Plus className="w-5 h-5" />
                    Add New Chapter
                </button>
            </div>

            {/* 4-Tier Top Dropdown Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-visible">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">1. Select Academic Context & Subject</h2>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <CustomSelect label="Board" value={selectedBoard} onChange={setSelectedBoard} options={boards} placeholder="Select Board" isLoading={isLoadingContext} />
                    <CustomSelect label="Class" value={selectedClass} onChange={setSelectedClass} options={classes} placeholder="Select Class" isLoading={isLoadingContext} />
                    <CustomSelect label="Group" value={selectedGroup} onChange={setSelectedGroup} options={groups} placeholder="Select Group" isLoading={isLoadingContext} />
                    <CustomSelect 
                        label="Subject" 
                        value={selectedSubject} 
                        onChange={setSelectedSubject} 
                        options={filteredSubjects} 
                        placeholder={!selectedBoard || !selectedClass || !selectedGroup ? "Select context first" : "Select Subject"} 
                        isLoading={isLoadingSubjects} 
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">2. Manage Chapters</h2>
                    {isFullContextSelected && chapters.length > 0 && (
                        <span className="text-xs font-medium bg-indigo-100 text-[#443DD7] px-2.5 py-1 rounded-full">
                            {chapters.length} Chapters Found
                        </span>
                    )}
                </div>

                {!isFullContextSelected ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-full mb-5">
                            <Bookmark className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Awaiting Full Context</h3>
                        <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                            Please select a Board, Class, Group, and Subject from the menus above to view or add chapters.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col">
                        {isLoadingChapters ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#443DD7]" />
                                <p className="text-sm">Fetching chapters...</p>
                            </div>
                        ) : chapters.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
                                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                                    <Bookmark className="w-8 h-8 text-[#443DD7]" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-1">No Chapters Found</h3>
                                <p className="text-sm text-gray-500 mb-6">There are no chapters configured for this subject yet.</p>
                                <button 
                                    onClick={handleOpenAddModal}
                                    className="text-[#443DD7] font-medium text-sm hover:underline cursor-pointer"
                                >
                                    + Add the first chapter
                                </button>
                            </div>
                        ) : (
                            <ChapterTable 
                                chapters={chapters} 
                                onEdit={handleOpenEditModal} 
                                onDelete={(chapter) => setChapterToDelete(chapter)} 
                            />
                        )}
                    </div>
                )}
            </div>

            <ChapterModal
                isOpen={isChapterModalOpen}
                onClose={() => setIsChapterModalOpen(false)}
                editingChapter={editingChapter}
                selectedSubjectObj={selectedSubjectObj}
                onSaveSuccess={handleSaveSuccess}
            />

            <DeleteConfirmationModal
                isOpen={Boolean(chapterToDelete)}
                onClose={() => setChapterToDelete(null)}
                onConfirm={handleConfirmDelete}
                itemName={chapterToDelete?.name}
                entityName="Chapter"
                isDeleting={isDeleting}
                description="This action cannot be undone. All associated topics under this chapter may be affected."
            />
        </div>
    );
};

export default ChapterManagement;