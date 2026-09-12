import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
  HiOutlineCollection,
  HiOutlineLightBulb,
  HiOutlineDocumentText,
  HiOutlineChevronRight,
  HiOutlineMenuAlt2,
  HiOutlineHome,
  HiOutlineChevronDown,
  HiX,
} from "react-icons/hi";

// Rest of the flat sidebar items (Dashboard and Academic Structure handled separately)
const standardSidebarItems = [
  { id: 3, label: "Subjects", icon: HiOutlineBookOpen, path:'academic-structure/manage-subject' },
  { id: 4, label: "Chapters", icon: HiOutlineCollection,path:'academic-structure/manage-chapters' },
  { id: 5, label: "Topics", icon: HiOutlineLightBulb, path:'academic-structure/manage-topics' },
  { id: 6, label: "Notes", icon: HiOutlineDocumentText, path:'academic-structure/manage-subject' },
  { id: 7, label: "Past Papers", icon: HiOutlineDocumentText, path:'academic-structure/manage-subject' },
  { id: 8, label: "MCQs", icon: HiOutlineBookOpen, path:'academic-structure/manage-subject' },
  { id: 9, label: "Quizzes", icon: HiOutlineCollection,path:'academic-structure/manage-subject' },
  { id: 10, label: "Videos", icon: HiOutlineLightBulb,path:'academic-structure/manage-subject' },
  { id: 11, label: "Assignments", icon: HiOutlineDocumentText, path:'academic-structure/manage-subject' },
  { id: 12, label: "Downloads", icon: HiOutlineBookOpen, path:'academic-structure/manage-subject' },
  { id: 13, label: "Settings", icon: HiOutlineAcademicCap,path:'academic-structure/manage-subject' },
];

const AdminSidebar = () => {
  const [activeItem, setActiveItem] = useState("dashboard"); // Tracks active page id
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // State to handle the open/close dropdown for Academic Structure
  const [academicDropdownOpen, setAcademicDropdownOpen] = useState(false);

  // Helper function to handle item clicks
  const handleItemClick = (id) => {
    setActiveItem(id);
    setMobileOpen(false); // Close mobile drawer when an item is selected
  };

  // Toggle dropdown and auto-expand sidebar if it was mini-collapsed on desktop
  const handleAcademicToggle = () => {
    setAcademicDropdownOpen(!academicDropdownOpen);
    if (collapsed) {
      setCollapsed(false);
    }
  };

  return (
    <>
      {/* ================= 1. MOBILE TRIGGER BUTTON ================= */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-md text-slate-600 focus:outline-none"
        >
          {mobileOpen ? <HiX className="w-6 h-6" /> : <HiOutlineMenuAlt2 className="w-6 h-6" />}
        </button>
      </div>

      {/* ================= 2. MOBILE BACKDROP OVERLAY ================= */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ================= 3. SIDEBAR CONTAINER ================= */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 md:static
          w-72 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 ${collapsed ? "md:w-20" : "md:w-72"}
          h-screen bg-white border-r border-slate-200 flex flex-col select-none 
          transition-all duration-300 ease-in-out
        `}
      >
        {/* ================= Brand ================= */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
              <HiOutlineAcademicCap className="w-6 h-6 text-white" />
            </div>

            <div className={`ml-3 whitespace-nowrap transition-opacity duration-200 ${collapsed ? "md:opacity-0 md:w-0" : "opacity-100"}`}>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                IlmiDunya
              </h2>
              <p className="text-xs text-slate-500">
                Content Management System
              </p>
            </div>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:block p-2 rounded-lg hover:bg-slate-100 transition"
          >
            <HiOutlineMenuAlt2 className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* ================= Section Title ================= */}
        <div className={`px-6 pt-6 pb-3 shrink-0 ${collapsed ? "md:hidden" : "block"}`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
            CONTENT MANAGEMENT
          </p>
        </div>

        {/* ================= Navigation ================= */}
        <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
          
          {/* OPTION 1: HOME / DASHBOARD */}
          <button
            onClick={() => handleItemClick("dashboard")}
            className={`group relative w-full flex items-center ${
              collapsed ? "md:justify-center" : "justify-between"
            } rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer ${
              activeItem === "dashboard" ? "bg-indigo-50" : "hover:bg-slate-50"
            }`}
          >
            <span className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full transition-all ${
              activeItem === "dashboard" ? "bg-indigo-600" : "bg-transparent group-hover:bg-slate-200"
            }`} />

            <div className={`flex items-center ${collapsed ? "md:justify-center md:w-full" : "gap-3"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                activeItem === "dashboard" ? "bg-white shadow-sm" : "bg-slate-100 group-hover:bg-white"
              }`}>
                <HiOutlineHome className={`w-5 h-5 ${activeItem === "dashboard" ? "text-indigo-600" : "text-slate-500"}`} />
              </div>
              <span className={`text-sm ${activeItem === "dashboard" ? "font-semibold text-slate-900" : "font-medium text-slate-600"} ${collapsed ? "md:hidden" : "block"}`}>
                Dashboard
              </span>
            </div>
          </button>

          {/* OPTION 2: COLLAPSIBLE ACADEMIC STRUCTURE */}
          <div className="w-full">
            <button
              onClick={handleAcademicToggle}
              className={`group relative w-full flex items-center ${
                collapsed ? "md:justify-center" : "justify-between"
              } rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer ${
                ["classes", "boards", "groups"].includes(activeItem) ? "bg-indigo-50/50" : "hover:bg-slate-50"
              }`}
            >
              <div className={`flex items-center ${collapsed ? "md:justify-center md:w-full" : "gap-3"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                  ["classes", "boards", "groups"].includes(activeItem) ? "bg-white shadow-sm" : "bg-slate-100 group-hover:bg-white"
                }`}>
                  <HiOutlineAcademicCap className={`w-5 h-5 ${["classes", "boards", "groups"].includes(activeItem) ? "text-indigo-600" : "text-slate-500"}`} />
                </div>
                <span className={`text-sm font-medium text-slate-600 ${collapsed ? "md:hidden" : "block"}`}>
                  Academic Structure
                </span>
              </div>

              {/* Rotatable Arrow Indicator */}
              <div className={collapsed ? "md:hidden" : "block"}>
                <HiOutlineChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${academicDropdownOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {/* Sub-menu Dropdown List */}
            {academicDropdownOpen && !collapsed && (
              <div className="mt-1 ml-6 pl-5 border-l border-slate-200 space-y-1 transition-all">
                {[
                  { id: "classes", label: "Classes", path:'academic-structure/add-class'},
                  { id: "groups", label: "Groups",path:'academic-structure/add-group' },
                  { id: "boards", label: "Boards",path:'academic-structure/add-board' },
                ].map((subItem) => (
                  <Link to={subItem.path}>
                  <button
                    key={subItem.id}
                    onClick={() => handleItemClick(subItem.id)}
                   
                    className={`w-full cursor-pointer text-left px-3 py-1.5 text-sm rounded-md transition-all ${
                      activeItem === subItem.id
                        ? "text-indigo-600 font-semibold bg-indigo-50"
                        : "text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {subItem.label}
                  </button>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* REMAINING STANDARD SIDEBAR ITEMS */}
          {standardSidebarItems.map((item) => {
            const Icon = item.icon;
            const active = activeItem === item.id;

            return (
              <Link to={item.path} >
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`group relative w-full flex items-center ${
                  collapsed ? "md:justify-center" : "justify-between"
                } rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer ${
                  active ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                
                <span className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full transition-all ${
                  active ? "bg-indigo-600" : "bg-transparent group-hover:bg-slate-200"
                }`} />

                <div className={`flex items-center ${collapsed ? "md:justify-center md:w-full" : "gap-3"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                    active ? "bg-white shadow-sm" : "bg-slate-100 group-hover:bg-white"
                  }`}>
                    <Icon className={`w-5 h-5 ${active ? "text-indigo-600" : "text-slate-500"}`} />
                  </div>

                  <span className={`text-sm ${active ? "font-semibold text-slate-900" : "font-medium text-slate-600"} ${collapsed ? "md:hidden" : "block"}`}>
                    {item.label}
                  </span>
                </div>

                <HiOutlineChevronRight className={`w-4 h-4 transition-all ${collapsed ? "md:hidden" : "block"} ${
                  active ? "text-indigo-500" : "text-slate-300 opacity-0 group-hover:opacity-100"
                }`} />
                
              </button>
              </Link>
            );
          })}
        </nav>

        {/* ================= Footer ================= */}
        <div className={`p-5 border-t border-slate-100 shrink-0 ${collapsed ? "md:hidden" : "block"}`}>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold">
                A
              </div>

              <div className="ml-3 flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 truncate">
                  Admin Account
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  admin@ilmidunya.com
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;