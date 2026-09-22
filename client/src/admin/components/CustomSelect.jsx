import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export const CustomSelect = ({ label, value, onChange, options = [], placeholder, isLoading, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt._id === value);
    const isDisabled = disabled || isLoading;

    return (
        <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</label>
            {isLoading ? (
                <div className="h-11 bg-gray-100 animate-pulse rounded-lg w-full"></div>
            ) : (
                <div>
                    <button
                        type="button"
                        onClick={() => {
                            if (!isDisabled) setIsOpen(!isOpen);
                        }}
                        disabled={isDisabled}
                        className={`w-full bg-white border ${
                            isOpen 
                            ? 'border-[var(--color-primary)] ring-4 ring-primary-soft shadow-sm' 
                            : 'border-gray-200 hover:border-gray-300 shadow-sm'
                        } text-left text-gray-800 rounded-lg p-3 text-sm flex justify-between items-center outline-none transition-all duration-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer`}
                    >
                        <span className={selectedOption ? "text-gray-900 font-medium truncate" : "text-gray-400"}>
                            {selectedOption ? selectedOption.name : placeholder}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ease-in-out shrink-0 ml-2 ${isOpen ? 'transform rotate-180 text-primary' : ''}`} />
                    </button>

                    {isOpen && (
                        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    )}

                    <div className={`absolute z-20 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1.5 transition-all duration-200 ease-out origin-top ${
                        isOpen 
                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                        : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                    }`}>
                        <div
                            onClick={() => { onChange(""); setIsOpen(false); }}
                            className="px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            {placeholder}
                        </div>
                        {options.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-400">No options available</div>
                        ) : options.map((opt) => {
                            const isSelected = value === opt._id;
                            return (
                                <div
                                    key={opt._id}
                                    onClick={() => { onChange(opt._id); setIsOpen(false); }}
                                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                                        isSelected 
                                        ? 'bg-primary-soft/80 text-primary font-semibold' 
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <span className="truncate">{opt.name}</span>
                                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
