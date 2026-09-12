import React, { useState, useEffect } from "react";
import { GraduationCap, Building2, Users, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios"; // Adjust path to your axios instance

const SideBar = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Dynamic filter state from DB
  const [boards, setBoards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      } catch (error) {
        console.error("Failed to load sidebar filters from database:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilters();
  }, []);

  // 2. Format dynamic database records into UI filter structure
  const filterCategories = [
    {
      id: "class",
      label: "CLASS",
      icon: GraduationCap,
      options: classes.map((c) => {
        const val = c.classNumber ? String(c.classNumber) : c.name || String(c);
        return val.replace(/class\s*/i, "").trim(); // Normalizes e.g. "Class 9" -> "9"
      }),
    },
    {
      id: "board",
      label: "BOARD",
      icon: Building2,
      options: boards.map((b) => {
        const name = b.name || String(b);
        return name.replace(/\s*board/i, "").trim(); // Normalizes e.g. "Federal Board" -> "Federal"
      }),
    },
    {
      id: "group",
      label: "GROUP",
      icon: Users,
      options: [
        "All",
        ...groups.map((g) => {
          const name = g.name || String(g);
          return name.replace(/\s*group/i, "").trim(); // Normalizes e.g. "Science Group" -> "Science"
        }),
      ],
    },
  ];

  // Helper function to update search params
  const updateParams = (key, value) => {
    const newParams = new URLSearchParams(searchParams);

    if (key === "group") {
      if (value === "All") {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    } else {
      newParams.set(key, value.toLowerCase());
    }
    setSearchParams(newParams);
  };

  // Helper to determine if a chip is selected
  const isChipSelected = (category, value) => {
    const currentValue = searchParams.get(category);

    if (category === "group") {
      if (currentValue) {
        return currentValue.toLowerCase() === value.toLowerCase();
      }
      return value === "All";
    }

    const categoryData = filterCategories.find((f) => f.id === category);

    if (!currentValue) {
      return (
        categoryData &&
        categoryData.options.length > 0 &&
        categoryData.options[0].toLowerCase() === value.toLowerCase()
      );
    }
    return currentValue.toLowerCase() === value.toLowerCase();
  };

  // Color schemes
  const ACTIVE_CHIP_BG_COLOR = "rgba(79, 70, 229, 0.9)";
  const ACTIVE_CHIP_TEXT_COLOR = "white";

  return (
    <aside
      className="sticky top-16 w-[260px] h-[calc(100vh-64px)] p-6 border-r flex flex-col font-sans overflow-y-auto select-none flex-shrink-0"
      style={{
        background: "white",
        borderColor: "rgb(235, 238, 241)",
      }}
    >
      {/* Title */}
      <h2
        className="text-2xl font-bold mb-10 flex-shrink-0"
        style={{
          color: "rgb(15, 23, 42)",
          fontFamily: "var(--font-heading)",
        }}
      >
        Filters
      </h2>

      {/* Main Filter Sections */}
      {isLoading ? (
        <div className="flex-grow flex flex-col items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#4F46E5]" />
          <span className="text-xs font-medium">Loading filters...</span>
        </div>
      ) : (
        <div className="flex-grow space-y-10 pb-6">
          {filterCategories.map((category) => (
            <div key={category.id}>
              {/* Category Header (Icon + Label) */}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-100"
                  style={{
                    color: "rgb(79, 70, 229)",
                  }}
                >
                  <category.icon size={20} strokeWidth={1.5} />
                </div>
                <h3
                  className="font-semibold text-sm tracking-wider"
                  style={{ color: "rgb(148, 163, 184)" }}
                >
                  {category.label}
                </h3>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2.5">
                {category.options.map((option) => {
                  const isActive = isChipSelected(category.id, option);
                  return (
                    <button
                      key={option}
                      onClick={() => updateParams(category.id, option)}
                      className="px-4 cursor-pointer py-2 text-sm font-medium rounded-full transition duration-150 ease-in-out border hover:bg-gray-50 active:scale-95 capitalize"
                      style={{
                        backgroundColor: isActive ? ACTIVE_CHIP_BG_COLOR : "white",
                        color: isActive
                          ? ACTIVE_CHIP_TEXT_COLOR
                          : "rgb(55, 65, 81)",
                        borderColor: isActive
                          ? ACTIVE_CHIP_BG_COLOR
                          : "rgb(235, 238, 241)",
                      }}
                    >
                      {category.id === "class" ? `Class ${option}` : option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default SideBar;