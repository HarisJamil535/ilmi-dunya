import PublishingFields from "./PublishingFields";
import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, FileText, Video } from "lucide-react";
import axiosInstance from "../../api/axios";

const TopicModal = ({ isOpen, onClose, editingTopic, chapterId, onSaveSuccess }) => {
    const [publishing, setPublishing] = useState({});
    const [name, setName] = useState("");
    const [topicNumber, setTopicNumber] = useState(1);
    const [description, setDescription] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [formError, setFormError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const maxNameLength = 120;
    const maxDescriptionLength = 500;

    const isValidYoutubeUrl = (url) => {
        if (!url) return true;

        try {
            const parsedUrl = new URL(url);
            return ["https:", "http:"].includes(parsedUrl.protocol) && ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(parsedUrl.hostname);
        } catch {
            return false;
        }
    };

    useEffect(() => {
        setPublishing(editingTopic || {});
        if (editingTopic) {
            setName(editingTopic.name || "");
            setTopicNumber(editingTopic.topicNumber || 1);
            setDescription(editingTopic.description || "");
            setVideoUrl(editingTopic.videoUrl || "");
        } else {
            setName("");
            setTopicNumber(1);
            setDescription("");
            setVideoUrl("");
        }
        setFormError("");
    }, [editingTopic, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        const trimmedVideoUrl = videoUrl.trim();
        const parsedTopicNumber = String(topicNumber).trim();

        if (!trimmedName) {
            setFormError("Topic name is required.");
            return;
        }

        if (trimmedName.length > maxNameLength) {
            setFormError(`Topic name must be ${maxNameLength} characters or fewer.`);
            return;
        }

        if (!/^\d+(\.\d+)*$/.test(parsedTopicNumber)) {
            setFormError("Use a topic number such as 2, 2.3 or 2.3.5.");
            return;
        }

        if (trimmedDescription.length > maxDescriptionLength) {
            setFormError(`Description must be ${maxDescriptionLength} characters or fewer.`);
            return;
        }

        if (!isValidYoutubeUrl(trimmedVideoUrl)) {
            setFormError("Please enter a valid YouTube URL or leave the video link empty.");
            return;
        }

        if (!chapterId) {
            setFormError("Target Chapter ID is missing.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...publishing,
                name: trimmedName,
                topicNumber: parsedTopicNumber,
                chapterId,
                description: trimmedDescription,
                videoUrl: trimmedVideoUrl,
            };

            if (editingTopic) {
                const response = await axiosInstance.put(`/topics/${editingTopic._id}`, payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.topic, "update");
                    onClose();
                }
            } else {
                const response = await axiosInstance.post("/topics", payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.topic, "create");
                    onClose();
                }
            }
        } catch (error) {
            const serverMsg = error.response?.data?.message || "Failed to save topic. Please check backend.";
            setFormError(serverMsg);
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
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {editingTopic ? "Edit Topic" : "Add New Topic"}
                        </h3>
                        <p className="text-xs text-slate-500">Configure topic details and video link.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
                            Topic Name <span className="text-rose-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g. Flowcharts and Pseudocode" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={maxNameLength}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all"
                            required
                            autoFocus
                        />
                        <p className="mt-1 text-[11px] text-slate-400">{name.trim().length}/{maxNameLength}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
                                Topic Number
                            </label>
                            <input 
                                type="text" 
                                min="1"
                                placeholder="e.g. 2.3.5" 
                                value={topicNumber}
                                onChange={(e) => setTopicNumber(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                                <Video className="w-3.5 h-3.5 text-red-500" />
                                Video Link <span className="text-slate-400 font-normal lowercase">(YouTube)</span>
                            </label>
                            <input 
                                type="url" 
                                placeholder="https://youtube.com/watch?v=..." 
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
                            Description <span className="text-slate-400 normal-case font-normal">(Optional)</span>
                        </label>
                        <textarea 
                            rows="3"
                            placeholder="Summary of concepts covered in this topic..." 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={maxDescriptionLength}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all resize-none"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">{description.trim().length}/{maxDescriptionLength}</p>
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
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors disabled:opacity-70 cursor-pointer shadow-md"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingTopic ? "Update Topic" : "Save Topic"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TopicModal;
