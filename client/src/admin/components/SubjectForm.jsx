import React, { useState, useEffect, useContext } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import axiosInstance from "../../api/axios";
import { AppContext } from "../../context/AppContext";

export const SubjectForm = ({ editingSubject, onSaveSuccess, onCancel }) => {
    const { 
        boards, 
        classes, 
        groups, 
        selectedBoard, 
        selectedClass, 
        selectedGroup 
    } = useContext(AppContext);

    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [formError, setFormError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pre-fill form if editing
    useEffect(() => {
        if (editingSubject) {
            setName(editingSubject.name || "");
            setCode(editingSubject.code || "");
        } else {
            setName("");
            setCode("");
        }
    }, [editingSubject]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        if (!name.trim()) {
            setFormError("Subject name is required.");
            return;
        }

        const boardObj = boards.find(b => b._id === selectedBoard);
        const classObj = classes.find(c => c._id === selectedClass);
        const groupObj = groups.find(g => g._id === selectedGroup);

        if (!boardObj || !classObj || !groupObj) {
            setFormError("Invalid academic context selected.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                code: code.trim(),
                board: boardObj.name,
                class: classObj.name,
                group: groupObj.name,
            };

            if (editingSubject) {
                // UPDATE API CALL
                const response = await axiosInstance.put(`/subjects/${editingSubject._id}`, payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.subject, "update");
                }
            } else {
                // CREATE API CALL
                const response = await axiosInstance.post("/subjects", payload);
                if (response.data.success) {
                    onSaveSuccess(response.data.subject, "create");
                }
            }
        } catch (error) {
            setFormError(error.response?.data?.message || "Error saving subject. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 bg-[#F8F9FE] border-b border-indigo-100">
            <div className="mb-3 text-xs font-bold text-[#443DD7] uppercase tracking-wider">
                {editingSubject ? `Editing: ${editingSubject.name}` : "Add New Subject"}
            </div>
            <form onSubmit={handleSubmit} className="max-w-4xl">
                <div className="flex flex-col md:flex-row gap-5 items-start">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Subject Name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            placeholder="e.g. Computer Science" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm focus:border-[#443DD7] focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                            autoFocus
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Subject Code <span className="text-gray-400 normal-case font-normal">(Optional)</span></label>
                        <input 
                            type="text" 
                            placeholder="e.g. CS-101" 
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm focus:border-[#443DD7] focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-3 pt-6 w-full md:w-auto">
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#443DD7] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#352EC0] transition-colors disabled:opacity-70 cursor-pointer"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingSubject ? "Update Changes" : "Save")}
                        </button>
                        <button 
                            type="button" 
                            onClick={onCancel} 
                            className="flex-1 md:flex-none px-6 py-3 rounded-lg text-sm font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
                {formError && (
                    <div className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                        <AlertCircle className="w-4 h-4" />
                        {formError}
                    </div>
                )}
            </form>
        </div>
    );
};