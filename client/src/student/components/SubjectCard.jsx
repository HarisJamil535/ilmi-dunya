import React from 'react';
import { Link } from 'react-router-dom';
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

const SubjectCard = ({ subj = "English", onClick, to }) => {
  // Get subject data or use default
  const subjectName = typeof subj === 'string' ? subj.trim() : subj;
  const subject = SUBJECT_DATA[subjectName.toLowerCase()] || DEFAULT_SUBJECT;
  const Icon = subject.icon;
  const Element = to ? Link : 'button';

  return (
    <Element
      to={to}
      type={to ? undefined : "button"}
      onClick={onClick}
      className="group relative flex min-h-44 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary-muted hover:shadow-xl hover:shadow-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-sky-400 to-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
      <div
        className="mb-5 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/60"
        style={{ backgroundColor: subject.color.bg }}
      >
        <Icon size={22} style={{ color: subject.color.icon }} strokeWidth={1.9} />
      </div>

      <h3 className="text-lg font-black leading-tight text-slate-950 capitalize">
        {subjectName}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Chapters, lectures, notes and papers organized for this subject.
      </p>

      <div
        className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-black"
        style={{ color: subject.color.text }}
      >
        <span>Explore now</span>
        <ArrowRight
          size={13}
          strokeWidth={2.2}
          className="group-hover:translate-x-0.5 transition-transform duration-150"
        />
      </div>
    </Element>
  );
};

export default SubjectCard;
