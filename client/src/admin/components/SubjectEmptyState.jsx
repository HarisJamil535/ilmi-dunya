import React from "react";
import { BookDashed, BookOpen } from "lucide-react";

export const SubjectEmptyState = ({ type, onAction }) => {
    if (type === "awaiting-context") {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-full mb-5">
                    <BookDashed className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Awaiting Context</h3>
                <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                    Please select a Board, Class, and Group from the menus above to view or add subjects for that specific academic combination.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-[#443DD7]" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No Subjects Found</h3>
            <p className="text-sm text-gray-500 mb-6">There are no subjects configured for this academic context yet.</p>
            <button 
                onClick={onAction}
                className="text-[#443DD7] font-medium text-sm hover:underline cursor-pointer"
            >
                + Add the first subject
            </button>
        </div>
    );
};