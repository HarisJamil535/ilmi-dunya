import PublishingFields from "./PublishingFields";
import React, { useState, useEffect, useContext } from "react";
import { X, Loader2, AlertCircle, Bookmark } from "lucide-react";
import axiosInstance from "../../api/axios";
import { AppContext } from "../../context/AppContext";

const ChapterModal = ({ isOpen, onClose, editingChapter, selectedSubjectObj, onSaveSuccess }) => {
    const { selectedBoard, selectedClass, selectedGroup } = useContext(AppContext);

    const [publishing, setPublishing] = useState({});
    const [name, setName] = useState("");
    const [chapterNumber, setChapterNumber] = useState(1);
    const [formError, setFormError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const maxNameLength = 120;

    useEffect(() => {
        setPublishing(editingChapter || {});
        if (editingChapter) {
            setName(editingChapter.name || "");
            setChapterNumber(editingChapter.chapterNumber || 1);
        } else {
            setName("");
            setChapterNumber(1);
        }
        setFormError("");
    }, [editingChapter, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        const trimmedName = name.trim();
        const parsedChapterNumber = Number(chapterNumber);

        if (!trimmedName) {
            setFormError("Chapter name is required.");
            return;
        }

        if (trimmedName.length > maxNameLength) {
            setFormError(`Chapter name must be ${maxNameLength} characters or fewer.`);
            return;
        }

        if (!Number.isInteger(parsedChapterNumber) || parsedChapterNumber < 1) {
            setFormError("Chapter number must be a whole number greater than 0.");
            return;
        }

        if (!selectedBoard || !selectedClass || !selectedGroup || !selectedSubjectObj?._id) {
            setFormError("Invalid academic context selected.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...publishing,
                name: trimmedName,
                chapterNumber: parsedChapterNumber,
                board: selectedBoard,
                class: selectedClass,
                group: selectedGroup,
                subject: selectedSubjectObj._id,
            };

            if (editingChapter) {
                const response = await axiosInstance.put(`/chapters/${editingChapter._id}`, payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.chapter, "update");
                    onClose();
                }
            } else {
                const response = await axiosInstance.post("/chapters", payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.chapter, "create");
                    onClose();
                }
            }
        } catch (error) {
            setFormError(error.response?.data?.message || "Error saving chapter. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-5">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50 cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-full bg-primary-soft text-primary shrink-0">
                        <Bookmark className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {editingChapter ? "Edit Chapter" : "Add New Chapter"}
                        </h3>
                        <p className="text-xs text-slate-500">Subject: <span className="font-semibold text-slate-700">{selectedSubjectObj?.name}</span></p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
                            Chapter Name <span className="text-rose-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g. Introduction to Programming" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={maxNameLength}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all"
                            required
                            autoFocus
                        />
                        <p className="mt-1 text-[11px] text-slate-400">{name.trim().length}/{maxNameLength}</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
                            Chapter Number <span className="text-slate-400 normal-case font-normal">(Optional)</span>
                        </label>
                        <input 
                            type="number" 
                            min="1"
                            placeholder="e.g. 1" 
                            value={chapterNumber}
                            onChange={(e) => setChapterNumber(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all"
                        />
                    </div>

                    <PublishingFields value={publishing} title={name} required={false} onChange={patch => setPublishing(current => ({ ...current, ...patch }))} />
                    {formError && (
                        <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-xl border border-rose-100">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{formError}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors disabled:opacity-70 cursor-pointer"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingChapter ? "Update Changes" : "Save Chapter"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChapterModal;
