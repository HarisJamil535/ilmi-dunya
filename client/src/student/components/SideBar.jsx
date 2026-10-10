import Spinner from "../../shared/Spinner";
import React, { useState, useEffect, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, Building2, Users, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AppContext } from "../../context/AppContext";

import CustomSelect from "../../shared/CustomSelect";

const SideBar = ({ drawerMode = false, subjectStyle = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [viewport, setViewport] = useState(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setIsDesktop(media.matches);
      const visible = window.visualViewport;
      setViewport({ height: visible?.height || window.innerHeight, top: visible?.offsetTop || 0 });
    };
    update();
    media.addEventListener("change", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const { boards, classes, groups, isLoadingContext: isLoading } = useContext(AppContext);
  const activeFilterCount = ["class", "board", "group"].filter((key) => searchParams.get(key)).length;

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => { if (event.key === "Escape") setIsMobileOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMobileOpen]);

  // 2. Format dynamic database records into UI filter structure
  const filterCategories = useMemo(() => [
    {
      id: "class",
      label: "CLASS",
      icon: GraduationCap,
      options: [...classes].sort((a,b) => String(a.classNumber || a.name).localeCompare(String(b.classNumber || b.name), undefined, { numeric: true })).map((c) => {
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

  const modalMode = drawerMode || !isDesktop;
  const panel = (
      <div role={modalMode ? "dialog" : undefined} aria-modal={modalMode ? true : undefined} aria-label="Study filters" className={`${subjectStyle ? "subject-filter-panel " : ""}flex min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl ${modalMode ? "max-w-[560px] h-full" : "max-h-[calc(100vh-96px)] p-5"}`}>
      {/* Title */}
      <button type="button" onClick={() => setIsMobileOpen(false)} className="mb-4 flex shrink-0 items-center justify-between text-left">
        <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Study Filters</p><h2 className="text-lg font-black text-slate-950">{subjectStyle ? "Find your content" : "Find content"}</h2></div>
        {modalMode && <X className="h-6 w-6 text-primary" />}
      </button>
      <div id="study-filter-options" className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="space-y-3 pb-4">
          {isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : filterCategories.map((category) => <section key={category.id} className={subjectStyle ? "subject-filter-section" : "rounded-xl bg-slate-50 p-3"}>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-black text-slate-500"><category.icon size={18} />{subjectStyle ? category.label.toLowerCase() : category.label}</h3>
            {subjectStyle && category.id !== "class" ? <CustomSelect label={category.id === "board" ? "Board" : "Group"} value={category.options.find(option => isChipSelected(category.id, option))?.id || ""} placeholder={`Choose ${category.id}`} options={category.options.map(option => ({value: option.id, label: option.label === "All" ? "All groups" : option.label}))} onChange={value => {const option = category.options.find(option => option.id === value); if(option) updateParams(category.id, option);}} className="subject-filter-select" /> : <div className={subjectStyle ? "subject-class-options" : "flex flex-wrap gap-2"}>{category.options.map((option) => <button type="button" key={option.id || option.label} aria-pressed={isChipSelected(category.id, option)} onClick={() => updateParams(category.id, option)} className={`rounded-full border px-3 py-2 text-sm font-bold ${isChipSelected(category.id, option) ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>{category.id === "class" ? `Class ${option.label}` : option.label}</button>)}</div>}
          </section>)}
          {subjectStyle && <p className="subject-filter-hint">Subjects update with your selection.</p>}
        </div>
      </div>
      {modalMode && <div className="shrink-0 border-t border-slate-100 pt-3"><button type="button" onClick={() => setIsMobileOpen(false)} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-white">Show results</button></div>}
      </div>
  );

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

      {!modalMode && panel}
      {modalMode && isMobileOpen && createPortal(
        <div className="fixed inset-x-0 z-[100] flex items-center justify-center px-3 py-4" style={{ top: viewport?.top || 0, height: viewport?.height || "100dvh" }}>
          <button type="button" aria-label="Close study filters" onClick={() => setIsMobileOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
          <div className="relative flex h-full max-h-[700px] w-full max-w-[560px] min-h-0 animate-in fade-in zoom-in-95 duration-200">{panel}</div>
        </div>, document.body
      )}

    </aside>
  );
};

export default SideBar;
