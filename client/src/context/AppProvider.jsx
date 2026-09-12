import React, { useState, useEffect, useCallback } from "react";
import { AppContext } from "./AppContext";
import axiosInstance from "../api/axios";

const AppProvider = ({ children }) => {
    const [boards, setBoards] = useState([]);
    const [classes, setClasses] = useState([]);
    const [groups, setGroups] = useState([]);
    const [subjects, setSubjects] = useState([]);

    const [selectedBoard, setSelectedBoard] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedGroup, setSelectedGroup] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    const [isLoadingContext, setIsLoadingContext] = useState(true);

    const fetchGlobalData = useCallback(async () => {
        try {
            const [boardsRes, classesRes, groupsRes] = await Promise.all([
                axiosInstance.get("/boards"),
                axiosInstance.get("/classes"),
                axiosInstance.get("/groups"),
            ]);
            setBoards(boardsRes.data.boards || []);
            setClasses(classesRes.data.classes || []);
            setGroups(groupsRes.data.groups || []);
        } catch (error) {
            console.error("Failed to load global academic context", error);
        } finally {
            setIsLoadingContext(false);
        }
    }, []);

    useEffect(() => {
        fetchGlobalData();
    }, [fetchGlobalData]);

    useEffect(() => {
        const fetchSubjectsForContext = async () => {
            if (selectedBoard && selectedClass && selectedGroup) {
                try {
                    const response = await axiosInstance.get(
                        `/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`
                    );
                    setSubjects(response.data.subjects || []);
                } catch (error) {
                    console.error("Failed to load subjects for global context", error);
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