import React, { useState, useEffect, useMemo } from "react";
import { GraduationCap, Building2, Users, Loader2, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios"; // Adjust path to your axios instance

const SideBar = ({ drawerMode = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Dynamic filter state from DB
  const [boards, setBoards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeFilterCount = ["class", "board", "group"].filter((key) => searchParams.get(key)).length;

  // 1. Fetch Boards, Classes, and Groups from backend database
  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoading(true);
      try {
        const [boardsRes, classesRes, groupsRes] = await Promise.all([
          axiosInstance.get("/boards"),
          axiosInstance.get("/classes"),
          axiosInstance.get("/groups"),
        ]);

        setBoards(boardsRes.data.boards || boardsRes.data || []);
        setClasses(classesRes.data.classes || classesRes.data || []);
        setGroups(groupsRes.data.groups || groupsRes.data || []);
      } catch {
        setBoards([]);
        setClasses([]);
        setGroups([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilters();
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isMobileOpen]);

  // 2. Format dynamic database records into UI filter structure
  const filterCategories = useMemo(() => [
    {
      id: "class",
      label: "CLASS",
      icon: GraduationCap,
      options: classes.map((c) => {
        const val = c.classNumber ? String(c.classNumber) : c.name || String(c);
        return {
          id: c._id,
          label: val.replace(/class\s*/i, "").trim(),
        };
      }),
    },
    {
      id: "board",
      label: "BOARD",
      icon: Building2,
      options: boards.map((b) => {
        const name = b.name || String(b);
        return {
          id: b._id,
          label: name.replace(/\s*board/i, "").trim(),
        };
      }),
    },
    {
      id: "group",
      label: "GROUP",
      icon: Users,
      options: [
        { id: "", label: "All" },
        ...groups.map((g) => {
          const name = g.name || String(g);
          return {
            id: g._id,
            label: name.replace(/\s*group/i, "").trim(),
          };
        }),
      ],
    },
  ], [boards, classes, groups]);

  // Helper function to update search params
  const updateParams = (key, option) => {
    const newParams = new URLSearchParams(searchParams);
    const value = option.label;
    const idKey = `${key}Id`;

    if (key === "group") {
      if (value === "All") {
        newParams.delete(key);
        newParams.delete(idKey);
      } else {
        newParams.set(key, value.toLowerCase());
        if (option.id) newParams.set(idKey, option.id);
      }
    } else {
      newParams.set(key, value.toLowerCase());
      if (option.id) newParams.set(idKey, option.id);
    }
    setSearchParams(newParams);
  };

  // Helper to determine if a chip is selected
  const isChipSelected = (category, option) => {
    const currentValue = searchParams.get(category);
    const currentId = searchParams.get(`${category}Id`);
    const value = option.label;

    if (currentId && option.id) {
      return currentId === option.id;
    }

    if (category === "group") {
      if (currentValue) {
        return currentValue.toLowerCase() === value.toLowerCase();
      }
      return value === "All";
    }

    if (!currentValue) return false;
    return currentValue.toLowerCase() === value.toLowerCase();
  };

  return (
    <aside className={drawerMode ? "flex w-full justify-end px-4 font-sans sm:px-6" : "flex w-full flex-shrink-0 justify-end px-4 font-sans sm:px-6 lg:sticky lg:top-20 lg:block lg:w-72 lg:self-start lg:px-0"}>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-expanded={isMobileOpen}
        aria-controls="study-filter-options"
        className={`my-3 inline-flex min-h-11 w-auto items-center gap-2 rounded-xl border border-primary-muted bg-white px-3.5 py-2.5 text-left text-sm font-black text-slate-800 shadow-sm shadow-primary/5 hover:border-primary hover:bg-primary-soft ${drawerMode ? "" : "lg:hidden"}`}
      >
        <SlidersHorizontal className="h-4.5 w-4.5 text-primary" />
        <span>{activeFilterCount ? "Change filters" : "Choose filters"}</span>
        {activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-white">{activeFilterCount}</span>}
      </button>

      <button
        type="button"
        aria-label="Close study filters"
        onClick={() => setIsMobileOpen(false)}
        className={`fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-300 ${drawerMode ? "" : "lg:hidden"} ${isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <div className={`fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[60] flex max-h-[min(82dvh,680px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${drawerMode ? "sm:inset-x-auto sm:left-1/2 sm:w-[560px] sm:-translate-x-1/2" : "lg:static lg:z-auto lg:max-h-[calc(100vh-96px)] lg:translate-x-0 lg:translate-y-0 lg:p-5 lg:opacity-100 lg:shadow-xl lg:shadow-slate-200/60"} ${isMobileOpen ? `${drawerMode ? "sm:-translate-x-1/2" : ""} translate-y-0 opacity-100` : `pointer-events-none translate-y-[110%] opacity-0 ${drawerMode ? "sm:-translate-x-1/2" : "lg:pointer-events-auto"}`}`}>
      {/* Title */}
      <button
        type="button"
        className="mb-4 flex w-full shrink-0 items-center justify-between gap-3 rounded-xl p-1 text-left lg:pointer-events-none lg:mb-7"
        aria-expanded={isMobileOpen}
        aria-controls="study-filter-options"
        onClick={() => setIsMobileOpen((open) => !open)}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Study Filters</p>
          <h2 className="mt-0.5 text-base font-black text-slate-950 sm:text-lg lg:mt-1 lg:text-2xl" style={{ fontFamily: "var(--font-heading)" }}>
            Find content
          </h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary lg:h-11 lg:w-11 lg:rounded-2xl">
          <X className={`h-5 w-5 ${drawerMode ? "" : "lg:hidden"}`} />
          {!drawerMode && <SlidersHorizontal className="hidden h-5 w-5 lg:block" />}
        </div>
      </button>

      {/* Main Filter Sections */}
      <div
        id="study-filter-options"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
      >
      {isLoading ? (
        <div className="flex min-h-40 flex-grow flex-col items-center justify-center gap-3 rounded-2xl border border-primary-soft bg-primary-soft/40 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-bold text-slate-500">Loading filters...</span>
        </div>
      ) : (
        <div className="space-y-3 pb-2 lg:space-y-4">
          {filterCategories.map((category) => (
            <div key={category.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              {/* Category Header (Icon + Label) */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-soft bg-white text-primary shadow-sm">
                  <category.icon size={20} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-black tracking-wider text-slate-500">
                  {category.label}
                </h3>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2">
                {category.options.map((option) => {
                  const isActive = isChipSelected(category.id, option);
                  return (
                    <button
                      key={option.id || option.label}
                      onClick={() => updateParams(category.id, option)}
                      className="cursor-pointer rounded-full border px-4 py-2 text-sm font-bold capitalize transition duration-150 ease-in-out hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
                      style={{
                        backgroundColor: isActive ? "var(--brand-primary)" : "white",
                        color: isActive
                          ? "white"
                          : "rgb(55, 65, 81)",
                        borderColor: isActive
                          ? "var(--brand-primary)"
                          : "rgb(235, 238, 241)",
                      }}
                    >
                      {category.id === "class" ? `Class ${option.label}` : option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      <button type="button" onClick={() => setIsMobileOpen(false)} className={`mt-3 w-full shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white ${drawerMode ? "" : "lg:hidden"}`}>Show results</button>
      </div>
    </aside>
  );
};

export default SideBar;
