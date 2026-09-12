import React, { useState, useEffect, useContext } from "react";
import { BookOpen, Plus, ChevronRight, Loader2 } from "lucide-react";
import axiosInstance from "../../api/axios"; 
import { AppContext } from "../../context/AppContext";
import { CustomSelect } from "../../admin/components/CustomSelect";
import { SubjectTable } from "../../admin/components/SubjectTable";
import { SubjectEmptyState } from "../../admin/components/SubjectEmptyState";
import SubjectModal from "../../admin/components/SubjectModal";
import DeleteConfirmationModal from "../../admin/components/DeleteConfirmationModal";

const SubjectManagement = () => {
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
        refreshContext // Pulled to sync newly added boards, classes, or groups instantly
    } = useContext(AppContext);

    const [subjects, setSubjects] = useState([]);
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

    // Modal States
    const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [subjectToDelete, setSubjectToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Refresh global context data (boards, classes, groups) on component mount
    useEffect(() => {
        refreshContext();
    }, [refreshContext]);

    // Fetch Subjects when context changes
    useEffect(() => {
        const fetchSubjects = async () => {
            if (selectedBoard && selectedClass && selectedGroup) {
                setIsLoadingSubjects(true);
                try {
                    const response = await axiosInstance.get(
                        `/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`
                    );
                    setSubjects(response.data.subjects || []);
                } catch (error) {
                    console.error("Failed to load subjects", error);
                } finally {
                    setIsLoadingSubjects(false);
                }
            } else {
                setSubjects([]);
                setIsSubjectModalOpen(false);
                setEditingSubject(null);
            }
        };
        fetchSubjects();
    }, [selectedBoard, selectedClass, selectedGroup]);

    const isContextSelected = selectedBoard && selectedClass && selectedGroup;

    const handleSaveSuccess = (savedSubject, type) => {
        if (type === "update") {
            setSubjects(subjects.map(sub => sub._id === savedSubject._id ? savedSubject : sub));
        } else {
            setSubjects([savedSubject, ...subjects]);
        }
    };

    const handleOpenAddModal = () => {
        setEditingSubject(null);
        setIsSubjectModalOpen(true);
    };

    const handleOpenEditModal = (subject) => {
        setEditingSubject(subject);
        setIsSubjectModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!subjectToDelete) return;
        setIsDeleting(true);
        try {
            await axiosInstance.delete(`/subjects/${subjectToDelete._id}`);
            setSubjects(subjects.filter((sub) => sub._id !== subjectToDelete._id));
            setSubjectToDelete(null);
        } catch (error) {
            console.error("Failed to delete subject", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F4F5F9] p-6 md:p-8 font-sans text-gray-800">
            
            {/* Breadcrumbs */}
            <div className="flex items-center text-sm text-gray-500 mb-8">
                <span className="hover:text-[#443DD7] cursor-pointer transition-colors">Dashboard</span>
                <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                <span className="font-semibold text-gray-800">Manage Subjects</span>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white border border-indigo-100 shadow-sm rounded-xl text-[#443DD7]">
                        <BookOpen className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Subjects Overview</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure subjects to build out your academic chapters and topics.</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleOpenAddModal}
                    disabled={!isContextSelected}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                        isContextSelected 
                        ? "bg-[#443DD7] hover:bg-[#352EC0] text-white shadow-md hover:shadow-lg active:scale-95 cursor-pointer" 
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                    <Plus className="w-5 h-5" />
                    Add New Subject
                </button>
            </div>

            {/* Context Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-visible">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">1. Select Academic Context</h2>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <CustomSelect label="Board" value={selectedBoard} onChange={setSelectedBoard} options={boards} placeholder="Select a Board" isLoading={isLoadingContext} />
                    <CustomSelect label="Class" value={selectedClass} onChange={setSelectedClass} options={classes} placeholder="Select a Class" isLoading={isLoadingContext} />
                    <CustomSelect label="Group" value={selectedGroup} onChange={setSelectedGroup} options={groups} placeholder="Select a Group" isLoading={isLoadingContext} />
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">2. Manage Subjects</h2>
                    {isContextSelected && subjects.length > 0 && (
                        <span className="text-xs font-medium bg-indigo-100 text-[#443DD7] px-2.5 py-1 rounded-full">
                            {subjects.length} Subjects Found
                        </span>
                    )}
                </div>

                {!isContextSelected ? (
                    <SubjectEmptyState type="awaiting-context" />
                ) : (
                    <div className="flex-1 flex flex-col">
                        {isLoadingSubjects ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#443DD7]" />
                                <p className="text-sm">Fetching subjects...</p>
                            </div>
                        ) : subjects.length === 0 ? (
                            <SubjectEmptyState type="no-subjects" onAction={handleOpenAddModal} />
                        ) : (
                            <SubjectTable 
                                subjects={subjects} 
                                onEdit={handleOpenEditModal} 
                                onDelete={(subject) => setSubjectToDelete(subject)} 
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Add / Edit Subject Modal */}
            <SubjectModal
                isOpen={isSubjectModalOpen}
                onClose={() => setIsSubjectModalOpen(false)}
                editingSubject={editingSubject}
                onSaveSuccess={handleSaveSuccess}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={Boolean(subjectToDelete)}
                onClose={() => setSubjectToDelete(null)}
                onConfirm={handleConfirmDelete}
                itemName={subjectToDelete?.name}
                entityName="Subject"
                isDeleting={isDeleting}
                description="This action cannot be undone. All associated chapters and topics under this subject may be affected."
            />
        </div>
    );
};

export default SubjectManagement;