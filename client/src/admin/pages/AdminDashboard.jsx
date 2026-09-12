import React from "react";
import {
  Layers,
  GraduationCap,
  Users,
  BookOpen,
  Lightbulb,
  FileText,
  Video,
  History,
  PlusCircle,
  FileUp,
  HelpCircle,
  Bell,
  ArrowUpRight,
} from "lucide-react";

// ================= CODE CONSTANTS & ARRAYS =================

const primaryMetrics = [
  { id: 1, title: "Boards", count: "4", subtitle: "Total Pakistani Educational Boards", icon: Layers, bg: "bg-indigo-50", color: "text-indigo-600" },
  { id: 2, title: "Classes", count: "8", subtitle: "Configured Academic Classes", icon: GraduationCap, bg: "bg-blue-50", color: "text-blue-600" },
  { id: 3, title: "Groups", count: "12", subtitle: "Registered Study Groups/Disciplines", icon: Users, bg: "bg-emerald-50", color: "text-emerald-600" },
  { id: 4, title: "Subjects", count: "150", subtitle: "Active Curricular Subjects mapped", icon: BookOpen, bg: "bg-amber-50", color: "text-amber-600" },
];

const secondaryMetrics = [
  { id: 5, title: "Topics", count: "3,200", icon: Lightbulb },
  { id: 6, title: "Notes", count: "4,500", icon: FileText },
  { id: 7, title: "Videos", count: "1,100", icon: Video },
  { id: 8, title: "MCQs", count: "25,000", icon: HelpCircle },
  { id: 9, title: "Past Papers", count: "600", icon: History },
];

const recentActivities = [
  { id: 1, text: "New Computer Science notes uploaded", time: "10 mins ago" },
  { id: 2, text: "Physics Chapter updated", time: "1 hour ago" },
  { id: 3, text: "Biology MCQs added", time: "4 hours ago" },
  { id: 4, text: "New Admission published", time: "Yesterday" },
  { id: 5, text: "Merit List updated", time: "2 days ago" },
];

const quickActions = [
  { id: 1, label: "Add Subject", icon: PlusCircle },
  { id: 2, label: "Upload Notes", icon: FileUp },
  { id: 3, label: "Upload Video", icon: Video },
  { id: 4, label: "Add MCQs", icon: HelpCircle },
  { id: 5, label: "Publish Admission", icon: PlusCircle }, // Keeping button layout neat
  { id: 6, label: "Upload Past Paper", icon: History },
];

const recentSubjects = [
  { id: 1, name: "Computer Science", details: "Intermediate" },
  { id: 2, name: "Physics", details: "Matric" },
  { id: 3, name: "Chemistry", details: "Matric" },
  { id: 4, name: "Biology", details: "Intermediate" },
  { id: 5, name: "Mathematics", details: "Intermediate" },
];

// ================= RENDER COMPONENT =================

const AdminDashboard = () => {
  const todayDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ================= 1. THEMATIC WELCOME HEADER ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#443dd7] p-6 sm:p-8 rounded-2xl shadow-sm text-white">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, Admin
            </h1>
            <p className="text-white/80 text-sm mt-1">
              Manage your educational platform efficiently.
            </p>
          </div>
          <div className="text-xs sm:text-sm font-semibold tracking-wide uppercase bg-white/10 border border-white/20 px-4 py-2 rounded-xl self-start sm:self-center backdrop-blur-sm">
            {todayDate}
          </div>
        </div>

        {/* ================= 2. METRICS LANDSCAPE ================= */}
        <div className="space-y-4">
          
          {/* Top Layer: Important/Wide Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {primaryMetrics.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between group transition-all duration-200">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{card.title}</p>
                    <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{card.count}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{card.subtitle}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Layer: Standard Supporting Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {secondaryMetrics.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-50 text-slate-500">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 leading-tight">{card.count}</h4>
                    <p className="text-xs text-slate-400 font-medium tracking-wide">{card.title}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* ================= 3. UTILITY & DATA PANELS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Activity List */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
              <Bell className="w-4 h-4 text-[#443dd7]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Recent Activity</h3>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex justify-between items-start text-sm group">
                  <p className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{activity.text}</p>
                  <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Router Shortcut Links */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
              <PlusCircle className="w-4 h-4 text-[#443dd7]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.id}
                    className="flex items-center gap-2.5 p-3 text-left border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <ActionIcon className="w-4 h-4 text-slate-400" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recently Appended Content Feed */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
              <BookOpen className="w-4 h-4 text-[#443dd7]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Recent Subjects</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {recentSubjects.map((subject) => (
                <div key={subject.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between group">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-[#443dd7] transition-colors">{subject.name}</h4>
                    <p className="text-xs text-slate-400">{subject.details}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;