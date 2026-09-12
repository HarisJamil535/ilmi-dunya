import React from 'react';
import {
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  Monitor,
  BookOpen,
  PenLine,
  Map,
  Moon,
  Globe,
  ArrowRight,
} from "lucide-react";

// Simple subject data with icons and colors
const SUBJECT_DATA = {
  "english": {
    icon: BookOpen,
    color: { bg: "#EFF6FF", icon: "#2563EB", text: "#1D4ED8" },
  },
  "urdu": {
    icon: PenLine,
    color: { bg: "#F5F3FF", icon: "#7C3AED", text: "#6D28D9" },
  },
  "mathematics": {
    icon: Calculator,
    color: { bg: "#EFF6FF", icon: "#2563EB", text: "#1D4ED8" },
  },
  "math": {
    icon: Calculator,
    color: { bg: "#EFF6FF", icon: "#2563EB", text: "#1D4ED8" },
  },
  "physics": {
    icon: Atom,
    color: { bg: "#F0FDF4", icon: "#16A34A", text: "#15803D" },
  },
  "chemistry": {
    icon: FlaskConical,
    color: { bg: "#FFFBEB", icon: "#D97706", text: "#B45309" },
  },
  "biology": {
    icon: Dna,
    color: { bg: "#FFF1F2", icon: "#E11D48", text: "#BE123C" },
  },
  "computer science": {
    icon: Monitor,
    color: { bg: "#F5F3FF", icon: "#7C3AED", text: "#6D28D9" },
  },
  "pakistan studies": {
    icon: Map,
    color: { bg: "#F0FDF4", icon: "#16A34A", text: "#15803D" },
  },
  "islamic studies": {
    icon: Moon,
    color: { bg: "#FFFBEB", icon: "#D97706", text: "#B45309" },
  },
  "pst": {
    icon: Map,
    color: { bg: "#F0FDF4", icon: "#16A34A", text: "#15803D" },
  },
};

// Fallback for unknown subjects
const DEFAULT_SUBJECT = {
  icon: Globe,
  color: { bg: "#F1F5F9", icon: "#64748B", text: "#334155" },
};

const SubjectCard = ({ subj = "English",onClick }) => {
  // Get subject data or use default
  const subjectName = typeof subj === 'string' ? subj.trim() : subj;
  const subject = SUBJECT_DATA[subjectName.toLowerCase()] || DEFAULT_SUBJECT;
  const Icon = subject.icon;

  return (
    <div onClick={onClick}
      className="group flex flex-col gap-4 bg-white border border-gray-300 rounded-2xl p-5 cursor-pointer hover:border-gray-200 hover:shadow-sm transition-all duration-200"
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: subject.color.bg }}
      >
        <Icon size={20} style={{ color: subject.color.icon }} strokeWidth={1.8} />
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-gray-900 leading-tight capitalize">
        {subjectName}
      </h3>

      {/* CTA */}
      <div
        className="flex items-center gap-1.5 text-[13px] font-medium mt-auto"
        style={{ color: subject.color.text }}
      >
        <span>Explore now</span>
        <ArrowRight
          size={13}
          strokeWidth={2.2}
          className="group-hover:translate-x-0.5 transition-transform duration-150"
        />
      </div>
    </div>
  );
};

export default SubjectCard;