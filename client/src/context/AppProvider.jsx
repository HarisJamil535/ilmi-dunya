import React, { useState, useEffect, useCallback } from "react";
import { AppContext } from "./AppContext";
import axiosInstance from "../api/axios";

const sortByName = (items = []) => [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" }));

const AppProvider = ({ children, initialData }) => {
    const [boards, setBoards] = useState(initialData?.boards || []);
    const [classes, setClasses] = useState(initialData?.classes || []);
    const [groups, setGroups] = useState(initialData?.groups || []);
    const [subjects, setSubjects] = useState([]);

    const [selectedBoard, setSelectedBoard] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedGroup, setSelectedGroup] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    const [isLoadingContext, setIsLoadingContext] = useState(!initialData);

    const fetchGlobalData = useCallback(async () => {
        try {
            const [boardsRes, classesRes, groupsRes] = await Promise.all([
                axiosInstance.get("/boards"),
                axiosInstance.get("/classes"),
                axiosInstance.get("/groups"),
            ]);
            setBoards(sortByName(boardsRes.data.boards || []));
            setClasses(sortByName(classesRes.data.classes || []));
            setGroups(sortByName(groupsRes.data.groups || []));
        } catch {
            setBoards([]);
            setClasses([]);
            setGroups([]);
        } finally {
            setIsLoadingContext(false);
        }
    }, []);

    useEffect(() => {
        if (!initialData) fetchGlobalData();
    }, [fetchGlobalData, initialData]);

    useEffect(() => {
        const fetchSubjectsForContext = async () => {
            if (selectedBoard && selectedClass && selectedGroup) {
                try {
                    const response = await axiosInstance.get(
                        `/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`
                    );
                    setSubjects(sortByName(response.data.subjects || []));
                } catch {
                    setSubjects([]);
                }
            } else {
                setSubjects([]);
                setSelectedSubject("");
            }
        };
        fetchSubjectsForContext();
    }, [selectedBoard, selectedClass, selectedGroup]);

    return (
        <AppContext.Provider
            value={{
                boards,
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
