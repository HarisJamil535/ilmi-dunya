import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

const DeleteConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    itemName = "this item",
    entityName = "Item",
    isDeleting = false,
    description,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-full bg-rose-50 text-rose-600 shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Delete {entityName}</h3>
                        <p className="text-xs text-slate-500">Confirm permanent deletion</p>
                    </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                    Are you sure you want to delete <strong className="text-slate-900">"{itemName}"</strong>?
                    {description && <span className="block mt-1 text-slate-500 text-xs">{description}</span>}
                </p>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-70 cursor-pointer shadow-md"
                    >
                        {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Delete Permanently
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;