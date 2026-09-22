import { useEffect, useMemo, useState } from "react";
import { BookOpen, GraduationCap, Loader2, SearchX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import SubjectCard from "../components/SubjectCard";
import SideBar from "../components/SideBar";

const setMetaDescription = (content) => {
  let meta = document.querySelector('meta[name="description"]');

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
};

const normalizeLabel = (value, fallback = "") =>
  decodeURIComponent(value || fallback).replace(/-/g, " ").trim();

const Subjects = () => {
  const [searchParams] = useSearchParams();

  const grade = searchParams.get("class") || "";
  const board = searchParams.get("board") || "";
  const group = searchParams.get("group") || "";
  const classId = searchParams.get("classId") || "";
  const boardId = searchParams.get("boardId") || "";
  const groupId = searchParams.get("groupId") || "";

  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasRequiredContext = Boolean(board && grade);
  const pageContext = useMemo(
    () => ({
      board: normalizeLabel(board, "selected"),
      grade: normalizeLabel(grade, "selected"),
      group: normalizeLabel(group),
    }),
    [board, grade, group]
  );

  useEffect(() => {
    document.title = hasRequiredContext
      ? `${pageContext.board} Board Class ${pageContext.grade} Subjects | IlmiDunya`
      : "Find Subjects by Class and Board | IlmiDunya";

    setMetaDescription(
      hasRequiredContext
        ? `Browse Class ${pageContext.grade} subjects for ${pageContext.board} Board${pageContext.group ? ` ${pageContext.group} group` : ""} on IlmiDunya.`
        : "Choose your class and board to browse available subjects, chapters, notes and video lectures."
    );
  }, [hasRequiredContext, pageContext]);

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!hasRequiredContext) {
        setSubjects([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          board,
          class: grade,
        });

        if (group) params.set("group", group);
        if (boardId) params.set("boardId", boardId);
        if (classId) params.set("classId", classId);
        if (groupId) params.set("groupId", groupId);

        const response = await axiosInstance.get(`/subjects?${params.toString()}`);
        const data = response.data.subjects || response.data || [];
        setSubjects(Array.isArray(data) ? data : []);
      } catch {
        setError("Subjects could not be loaded right now. Please try again.");
        setSubjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubjects();
  }, [board, grade, group, boardId, classId, groupId, hasRequiredContext]);

  const subjectHref = (subject) => {
    const subjectName = typeof subject === "string" ? subject : subject.name;
    const subjectId = subject?._id;
    const slug = subjectName.toLowerCase().trim().replace(/\s+/g, "-");
    const params = new URLSearchParams({
      subject: slug,
      class: grade,
      board,
    });

    if (subjectId) params.set("subjectId", subjectId);
    if (group) params.set("group", group);
    if (boardId) params.set("boardId", boardId);
    if (classId) params.set("classId", classId);
    if (groupId) params.set("groupId", groupId);

    return `/chapters?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-0 lg:flex-row lg:items-start lg:px-6 lg:py-8">
        <SideBar />

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-0 lg:py-0">
          <section className="mx-auto flex max-w-6xl flex-col gap-8">
            <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <GraduationCap className="h-4 w-4" />
                <span>Academic Subjects</span>
              </div>

              <div className="space-y-2">
                <h1 className="max-w-3xl text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">
                  {hasRequiredContext ? (
                    <>
                      Subjects for{" "}
                      <span className="capitalize text-primary">{pageContext.board} Board</span>, Class{" "}
                      <span className="text-primary">{pageContext.grade}</span>
                      {pageContext.group && (
                        <span className="capitalize text-slate-500"> ({pageContext.group})</span>
                      )}
                    </>
                  ) : (
                    "Choose your class and board to explore subjects"
                  )}
                </h1>
                <p className="max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:text-base">
                  Select a subject to continue into chapters, video lectures, notes and practice resources.
                </p>
              </div>
            </header>

            {!hasRequiredContext ? (
              <div className="rounded-2xl border border-dashed border-primary-muted bg-white p-8 text-center shadow-sm">
                <BookOpen className="mx-auto mb-4 h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold text-slate-900">Start with the filters</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Pick a class and board from the filters. IlmiDunya will show only the subjects that match your selection.
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="font-semibold">Loading subjects...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
                {error}
              </div>
            ) : subjects.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
                <h2 className="text-lg font-bold text-slate-900">No subjects found</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  No subjects matched {pageContext.board} Board Class {pageContext.grade}
                  {pageContext.group ? ` (${pageContext.group} group)` : ""}.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {subjects.map((subject) => (
                  <SubjectCard
                    key={subject._id || subject.name}
                    subj={subject.name || subject}
                    to={subjectHref(subject)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Subjects;
