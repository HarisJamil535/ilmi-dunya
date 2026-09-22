import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Plus, ChevronRight, Loader2, Bookmark, ArrowLeft } from "lucide-react";
import axiosInstance from "../../api/axios";
import { AppContext } from "../../context/AppContext";
import { CustomSelect } from "../../admin/components/CustomSelect";
import { TopicTable } from "../../admin/components/TopicTable";
import TopicModal from "../../admin/components/TopicModal";
import DeleteConfirmationModal from "../../admin/components/DeleteConfirmationModal";

const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortChapters = (items) => [...items].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortTopics = (items) => [...items].sort((a, b) => String(a.topicNumber || "").localeCompare(String(b.topicNumber || ""), undefined, { numeric: true, sensitivity: "base" }) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));

const TopicManagement = () => {
    const { chapterId: urlChapterId } = useParams();
    const navigate = useNavigate();
    const isDirectMode = Boolean(urlChapterId);

    const {
        boards = [], classes = [], groups = [],
        selectedBoard, setSelectedBoard,
        selectedClass, setSelectedClass,
        selectedGroup, setSelectedGroup,
        isLoadingContext, refreshContext
    } = useContext(AppContext);

    // Filter Dropdown States
    const [filteredSubjects, setFilteredSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

    const [chapters, setChapters] = useState([]);
    const [selectedChapter, setSelectedChapter] = useState(urlChapterId || "");
    const [isLoadingChapters, setIsLoadingChapters] = useState(false);

    // Topic Data & Workspace States
    const [topics, setTopics] = useState([]);
    const [loadedChapterInfo, setLoadedChapterInfo] = useState(null);
    const [isLoadingTopics, setIsLoadingTopics] = useState(false);

    // Modal Controls
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [topicToDelete, setTopicToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        refreshContext();
    }, [refreshContext]);

    useEffect(() => {
        if (urlChapterId) {
            setSelectedChapter(urlChapterId);
        }
    }, [urlChapterId]);

    // Filter Reset Handlers
    const handleBoardChange = (value) => {
        setSelectedBoard(value);
        setSelectedSubject("");
        setSelectedChapter("");
        setFilteredSubjects([]);
        setChapters([]);
    };

    const handleClassChange = (value) => {
        setSelectedClass(value);
        setSelectedSubject("");
        setSelectedChapter("");
        setFilteredSubjects([]);
        setChapters([]);
    };

    const handleGroupChange = (value) => {
        setSelectedGroup(value);
        setSelectedSubject("");
        setSelectedChapter("");
        setFilteredSubjects([]);
        setChapters([]);
    };

    const handleSubjectChange = (value) => {
        setSelectedSubject(value);
        setSelectedChapter("");
        setChapters([]);
    };

    // 1. Fetch Subjects when Board + Class + Group are set
    useEffect(() => {
        if (isDirectMode) return;

        const fetchSubjects = async () => {
            if (selectedBoard && selectedClass && selectedGroup) {
                setIsLoadingSubjects(true);
                try {
                    const response = await axiosInstance.get(
                        `/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`
                    );
                    setFilteredSubjects(sortByName(response.data.subjects || response.data || []));
                } catch {
                    setFilteredSubjects([]);
                } finally {
                    setIsLoadingSubjects(false);
                }
            } else {
                setFilteredSubjects([]);
            }
        };

        fetchSubjects();
    }, [selectedBoard, selectedClass, selectedGroup, isDirectMode]);

    // 2. Fetch Chapters when Subject is selected
    useEffect(() => {
        if (isDirectMode) return;

        const fetchChapters = async () => {
            if (selectedBoard && selectedClass && selectedGroup && selectedSubject) {
                setIsLoadingChapters(true);
                try {
                    const response = await axiosInstance.get(
                        `/chapters?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}&subjectId=${selectedSubject}`
                    );
                    setChapters(sortChapters(response.data.chapters || response.data || []));
                } catch {
                    setChapters([]);
                } finally {
                    setIsLoadingChapters(false);
                }
            } else {
                setChapters([]);
            }
        };

        fetchChapters();
    }, [selectedBoard, selectedClass, selectedGroup, selectedSubject, isDirectMode]);

    // 3. Fetch Topics via GET /api/topics/chapter/:chapterId
    useEffect(() => {
        const fetchTopicsAndChapterInfo = async () => {
            if (selectedChapter) {
                setIsLoadingTopics(true);
                try {
                    const response = await axiosInstance.get(`/topics/chapter/${selectedChapter}`);
                    setLoadedChapterInfo(response.data.chapter || null);
                    setTopics(sortTopics(response.data.topics || []));
                } catch {
                    setTopics([]);
                    setLoadedChapterInfo(null);
                } finally {
                    setIsLoadingTopics(false);
                }
            } else {
                setTopics([]);
                setLoadedChapterInfo(null);
            }
        };

        fetchTopicsAndChapterInfo();
    }, [selectedChapter]);

    const handleSaveSuccess = (savedTopic, actionType) => {
        let updatedTopics;
        if (actionType === "update") {
            updatedTopics = topics.map((t) => (t._id === savedTopic._id ? savedTopic : t));
        } else {
            updatedTopics = [...topics, savedTopic];
        }
        setTopics(sortTopics(updatedTopics));
    };

    const handleConfirmDelete = async () => {
        if (!topicToDelete) return;
        setIsDeleting(true);
        try {
            await axiosInstance.delete(`/topics/${topicToDelete._id}`);
            setTopics(topics.filter((t) => t._id !== topicToDelete._id));
            setTopicToDelete(null);
        } catch {
            return;
        } finally {
            setIsDeleting(false);
        }
    };

    const chapterOptions = chapters.map((ch) => ({
        _id: ch._id,
        name: `Ch #${ch.chapterNumber || 1}: ${ch.name}`,
    }));

    const isContextReady = Boolean(selectedChapter);

    return (
        <div className="min-h-screen bg-[#F4F5F9] p-6 md:p-8 font-sans text-gray-800">
            {/* Header & Breadcrumb */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center text-sm text-gray-500">
                    <span 
                        onClick={() => navigate(isDirectMode ? "/admin/academic-structure/manage-chapters" : "/admin/dashboard")} 
                        className="hover:text-primary cursor-pointer transition-colors"
                    >
                        {isDirectMode ? "Manage Chapters" : "Dashboard"}
                    </span>
                    <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                    <span className="font-semibold text-gray-800">Manage Topics</span>
                </div>

                {isDirectMode && (
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Chapters
                    </button>
                )}
            </div>

            {/* Overview Title Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white border border-primary-soft shadow-sm rounded-xl text-primary">
                        <FileText className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            {loadedChapterInfo ? `Topics: ${loadedChapterInfo.name}` : "Topics Overview"}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {loadedChapterInfo 
                                ? `${loadedChapterInfo.subject} (${loadedChapterInfo.class} - ${loadedChapterInfo.board})` 
                                : "Filter through the chain to view or configure topics."}
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={() => { setEditingTopic(null); setIsTopicModalOpen(true); }}
                    disabled={!isContextReady}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                        isContextReady 
                        ? "bg-primary hover:bg-primary-dark text-white shadow-md hover:shadow-lg active:scale-95 cursor-pointer" 
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                    <Plus className="w-5 h-5" />
                    Add New Topic
                </button>
            </div>

            {/* 5-Tier Dropdown Section */}
            {!isDirectMode && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-visible">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                            Curriculum Filter Chain (Board → Class → Group → Subject → Chapter)
                        </h2>
                    </div>
                    
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <CustomSelect 
                            label="1. Board" 
                            value={selectedBoard} 
                            onChange={handleBoardChange} 
                            options={boards} 
                            placeholder="Select Board" 
                            isLoading={isLoadingContext} 
                        />

                        <CustomSelect 
                            label="2. Class" 
                            value={selectedClass} 
                            onChange={handleClassChange} 
                            options={classes} 
                            placeholder="Select Class" 
                            isLoading={isLoadingContext} 
                        />

                        <CustomSelect 
                            label="3. Group" 
                            value={selectedGroup} 
                            onChange={handleGroupChange} 
                            options={groups} 
                            placeholder="Select Group" 
                            isLoading={isLoadingContext} 
                        />

                        <CustomSelect 
                            label="4. Subject" 
                            value={selectedSubject} 
                            onChange={handleSubjectChange} 
                            options={filteredSubjects} 
                            placeholder={
                                !selectedBoard || !selectedClass || !selectedGroup 
                                    ? "Select context first" 
                                    : isLoadingSubjects 
                                        ? "Loading..." 
                                        : "Select Subject"
                            } 
                            isLoading={isLoadingSubjects} 
                            disabled={!selectedBoard || !selectedClass || !selectedGroup}
                        />

                        <CustomSelect 
                            label="5. Chapter" 
                            value={selectedChapter} 
                            onChange={setSelectedChapter} 
                            options={chapterOptions} 
                            placeholder={
                                !selectedSubject 
                                    ? "Select subject first" 
                                    : isLoadingChapters 
                                        ? "Loading..." 
                                        : "Select Chapter"
                            } 
                            isLoading={isLoadingChapters} 
                            disabled={!selectedSubject}
                        />
                    </div>
                </div>
            )}

            {/* Topics Workspace Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[420px] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Topics List</h2>
                    {isContextReady && topics.length > 0 && (
                        <span className="text-xs font-medium bg-primary-soft text-primary px-2.5 py-1 rounded-full">
                            {topics.length} Topics
                        </span>
                    )}
                </div>

                {!isContextReady ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-full mb-5">
                            <Bookmark className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Select a Target Chapter</h3>
                        <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                            Complete the filter selection above to load and manage the chapter's topics.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col">
                        {isLoadingTopics ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                                <p className="text-sm font-medium">Fetching topics from API...</p>
                            </div>
                        ) : topics.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
                                <div className="w-16 h-16 bg-primary-soft rounded-full flex items-center justify-center mb-4">
                                    <FileText className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-1">No Topics Found</h3>
                                <p className="text-sm text-gray-500 mb-6">No topics have been added to this chapter yet.</p>
                                <button 
                                    onClick={() => { setEditingTopic(null); setIsTopicModalOpen(true); }}
                                    className="text-primary font-semibold text-sm hover:underline cursor-pointer"
                                >
                                    + Add the first topic
                                </button>
                            </div>
                        ) : (
                            <TopicTable 
                                topics={topics} 
                                onEdit={(topic) => { setEditingTopic(topic); setIsTopicModalOpen(true); }} 
                                onDelete={(topic) => setTopicToDelete(topic)} 
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <TopicModal
                isOpen={isTopicModalOpen}
                onClose={() => setIsTopicModalOpen(false)}
                editingTopic={editingTopic}
                chapterId={selectedChapter}
                onSaveSuccess={handleSaveSuccess}
            />

            <DeleteConfirmationModal
                isOpen={Boolean(topicToDelete)}
                onClose={() => setTopicToDelete(null)}
                onConfirm={handleConfirmDelete}
                itemName={topicToDelete?.name}
                entityName="Topic"
                isDeleting={isDeleting}
                description="This action cannot be undone. Questions associated with this topic may be affected."
            />
        </div>
    );
};

export default TopicManagement;
