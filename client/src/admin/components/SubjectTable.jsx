import React from "react";
import { Trash2, Edit3 } from "lucide-react";

export const SubjectTable = ({ subjects, onEdit, onDelete }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white border-b border-gray-100 text-gray-500">
                    <tr>
                        <th className="px-6 py-4 font-semibold">Subject Name</th>
                        <th className="px-6 py-4 font-semibold">Code</th>
                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {subjects.map((subject) => (
                        <tr key={subject._id} className="hover:bg-gray-50/80 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="font-semibold text-gray-900">{subject.name}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-gray-500 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {subject.code || "N/A"}
                                </span>
                            </td>
                            <td className="px-6 py-4 flex justify-end gap-2 items-center">
                                <button 
                                    onClick={() => onEdit(subject)}
                                    className="p-2 text-slate-400 hover:text-[#443DD7] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Subject"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onDelete(subject)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Subject"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};