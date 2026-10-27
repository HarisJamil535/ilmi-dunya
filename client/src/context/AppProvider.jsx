import React, { useState, useEffect, useCallback } from "react";
import { AppContext } from "./AppContext";
import axiosInstance from "../api/axios";

const sortByName = (items = []) => [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" }));

const AppProvider = ({ children, initialData }) => {
    const [boards, setBoards] = useState(initialData?.boards || []);
    const [classes, setClasses] = useState(initialData?.classes || []);
    const [groups, setGroups] = useState(initialData?.groups || []);
    const [hubs, setHubs] = useState(initialData?.hubs || []);
    const [subjects, setSubjects] = useState([]);

    const [selectedBoard, setSelectedBoard] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedGroup, setSelectedGroup] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    const [isLoadingContext, setIsLoadingContext] = useState(!initialData);

    const fetchGlobalData = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get("/study-options");
            setBoards(sortByName(data.boards || []));
            setClasses(sortByName(data.classes || []));
            setGroups(sortByName(data.groups || []));
            setHubs(data.hubs || []);
        } catch {
            // Keep the last usable choices during a temporary connection failure.
        } finally {
            setIsLoadingContext(false);
        }
    }, []);

    useEffect(() => {
        // Study pages arrive with boards and classes but not the class hubs, so those are fetched once.
        if (!initialData || !initialData.hubs) fetchGlobalData();
    }, [fetchGlobalData, initialData]);

    useEffect(() => {
        window.addEventListener('app-network-restored', fetchGlobalData);
        return () => window.removeEventListener('app-network-restored', fetchGlobalData);
    }, [fetchGlobalData]);

    useEffect(() => {
        const controller = new AbortController();
        setSelectedSubject("");
        const fetchSubjectsForContext = async () => {
            if (selectedBoard && selectedClass && selectedGroup) {
                try {
                    const response = await axiosInstance.get(
                        `/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`,
                        { signal: controller.signal }
                    );
                    setSubjects(sortByName(response.data.subjects || []));
                } catch {
                    if (!controller.signal.aborted) setSubjects([]);
                }
            } else {
                setSubjects([]);
                setSelectedSubject("");
            }
        };
        fetchSubjectsForContext();
        return () => controller.abort();
    }, [selectedBoard, selectedClass, selectedGroup]);

    return (
        <AppContext.Provider
            value={{
                boards,
                hubs,
                classes,
                groups,
                subjects,
                selectedBoard,
                setSelectedBoard,
                selectedClass,
                setSelectedClass,
                selectedGroup,
                setSelectedGroup,
                selectedSubject,
                setSelectedSubject,
                isLoadingContext,
                refreshContext: fetchGlobalData, // Expose refresh function
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export default AppProvider;
