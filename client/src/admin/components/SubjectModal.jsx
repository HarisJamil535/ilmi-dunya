import InlineEditor from "./InlineEditor";
import React, { useState, useEffect, useContext } from "react";
import { X, Loader2, AlertCircle, BookOpen } from "lucide-react";
import axiosInstance from "../../api/axios";
import { AppContext } from "../../context/AppContext";

const SubjectModal = ({ isOpen, onClose, editingSubject, onSaveSuccess }) => {
    const { selectedBoard, selectedClass, selectedGroup } = useContext(AppContext);

    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [cardImage, setCardImage] = useState("");
    const [uploadingImage, setUploadingImage] = useState(false);
    const [formError, setFormError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const maxNameLength = 80;
    const maxCodeLength = 24;

    useEffect(() => {
        if (editingSubject) {
            setName(editingSubject.name || "");
            setCode(editingSubject.code || "");
        } else {
            setName("");
            setCode("");
        }
        setFormError("");
        setCardImage(editingSubject?.cardImage || "");
    }, [editingSubject, isOpen]);

    const canSave = Boolean(name.trim() && name.trim().length <= maxNameLength && code.trim().length <= maxCodeLength && selectedBoard && selectedClass && selectedGroup);

    if (!isOpen) return null;

    const uploadImage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
            setFormError("Choose a JPG, PNG or WebP image under 1 MB.");
            return;
        }
        setUploadingImage(true);
        setFormError("");
        try {
            const data = new FormData();
            data.append("image", file);
            const response = await axiosInstance.post("/subjects/upload-image", data, { headers: { "Content-Type": "multipart/form-data" } });
            setCardImage(response.data.imageUrl);
        } catch (error) { setFormError(error.response?.data?.message || "Unable to upload image. Please try again."); }
        finally { setUploadingImage(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (uploadingImage || isSubmitting) return;
        setFormError("");

        const trimmedName = name.trim();
        const trimmedCode = code.trim();

        if (!trimmedName) {
            setFormError("Subject name is required.");
            return;
        }

        if (trimmedName.length > maxNameLength) {
            setFormError(`Subject name must be ${maxNameLength} characters or fewer.`);
            return;
        }

        if (trimmedCode.length > maxCodeLength) {
            setFormError(`Subject code must be ${maxCodeLength} characters or fewer.`);
            return;
        }

        if (!selectedBoard || !selectedClass || !selectedGroup) {
            setFormError("Invalid academic context selected.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: trimmedName,
                code: trimmedCode,
                cardImage,
                board: selectedBoard,
                class: selectedClass,
                group: selectedGroup,
            };

            if (editingSubject) {
                const response = await axiosInstance.put(`/subjects/${editingSubject._id}`, payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.subject, "update");
                    onClose();
                }
            } else {
                const response = await axiosInstance.post("/subjects", payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.subject, "create");
                    onClose();
                }
            }
        } catch (error) {
            setFormError(error.response?.data?.message || "Error saving subject. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <InlineEditor>
            <div className="admin-inline-editor relative w-full bg-white">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting || uploadingImage}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50 cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-full bg-primary-soft text-primary shrink-0">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {editingSubject ? "Edit Subject" : "Add New Subject"}
                        </h3>
                        <p className="text-xs text-slate-500">Configure subject name and code for this academic context.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm leading-6 text-slate-500">Enter the subject name as it appears in the syllabus. The code is optional.</p>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
                            Subject Name <span className="text-rose-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g. Computer Science" 
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
                            Subject Code <span className="text-slate-400 normal-case font-normal">(Optional)</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g. CS-101" 
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            maxLength={maxCodeLength}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary-soft outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label htmlFor="subject-card-image" className="mb-2 block text-sm font-semibold text-slate-600">Subject image <span className="font-normal">(optional)</span></label>
                        <p id="subject-image-help" className="mb-3 text-sm leading-6 text-slate-500">Use a square 256 × 256 px image or illustration. Keep it centered with some space around it. Transparent PNG or WebP works best; aim for under 100 KB (maximum 1 MB).</p>
                        <div className="flex flex-wrap items-center gap-4">
                            {cardImage && <img src={cardImage} alt="Subject image preview" width="80" height="80" className="h-20 w-20 rounded-md border border-slate-200 object-contain p-2" />}
                            <input id="subject-card-image" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="subject-image-help" onChange={uploadImage} disabled={uploadingImage || isSubmitting} className="min-w-0 max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-semibold file:text-primary" />
                            {uploadingImage && <span role="status" className="text-sm text-primary">Uploading image...</span>}
                            {cardImage && <button type="button" disabled={isSubmitting || uploadingImage} onClick={() => setCardImage("")} className="text-sm font-semibold text-primary">Remove image</button>}
                        </div>
                    </div>

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
                            disabled={isSubmitting || uploadingImage}
                            className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || uploadingImage || !canSave}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors disabled:opacity-70 cursor-pointer"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingSubject ? "Update Changes" : "Save Subject"}
                        </button>
                    </div>
                </form>
            </div>
        </InlineEditor>
    );
};

export default SubjectModal;
