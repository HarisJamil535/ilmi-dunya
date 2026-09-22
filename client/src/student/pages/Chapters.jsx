import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Download, FileText, Layers, Loader2, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { IoLogoYoutube } from "react-icons/io5";
import axiosInstance from "../../api/axios";
import ChapterTopics from "../components/ChapterTopics";

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

const buildTopicLink = ({ chapter, subject, grade, board, group, type }) => {
  const params = new URLSearchParams({
    chapterId: chapter._id,
    chapterNumber: String(chapter.chapterNumber || 1),
  });

  if (subject) params.set("subject", subject);
  if (grade) params.set("class", grade);
  if (board) params.set("board", board);
  if (group) params.set("group", group);
  if (type) params.set("type", type);

  return `/topics?${params.toString()}`;
};

const buildResourceLink = ({ path, subject, grade, board, group, subjectId, boardId, classId, groupId }) => {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (grade) params.set("class", grade);
  if (board) params.set("board", board);
  if (group) params.set("group", group);
  if (subjectId) params.set("subjectId", subjectId);
  if (boardId) params.set("boardId", boardId);
  if (classId) params.set("classId", classId);
  if (groupId) params.set("groupId", groupId);
  return `${path}?${params.toString()}`;
};

const Chapters = () => {
  const [searchParams] = useSearchParams();

  const classParam = searchParams.get("class") || "";
  const boardParam = searchParams.get("board") || "";
  const subjectParam = searchParams.get("subject") || "";
  const subjectId = searchParams.get("subjectId") || "";
  const groupParam = searchParams.get("group") || "";
  const boardId = searchParams.get("boardId") || "";
  const classId = searchParams.get("classId") || "";
  const groupId = searchParams.get("groupId") || "";

  const [chapters, setChapters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedChapter, setExpandedChapter] = useState(null);


  const hasRequiredContext = Boolean(boardParam && classParam && (subjectParam || subjectId));
  const pageContext = useMemo(
    () => ({
      board: normalizeLabel(boardParam, "selected"),
      grade: normalizeLabel(classParam, "selected"),
      subject: normalizeLabel(subjectParam, "subject"),
      group: normalizeLabel(groupParam),
    }),
    [boardParam, classParam, subjectParam, groupParam]
  );

  useEffect(() => {
    document.title = hasRequiredContext
      ? `${pageContext.subject} Chapters | Class ${pageContext.grade} ${pageContext.board} Board`
      : "Subject Chapters | IlmiDunya";

    setMetaDescription(
      hasRequiredContext
        ? `Browse ${pageContext.subject} chapters for Class ${pageContext.grade} ${pageContext.board} Board with video lectures, notes and tests.`
        : "Browse subject chapters, notes, video lectures and practice resources on IlmiDunya."
    );
  }, [hasRequiredContext, pageContext]);

  useEffect(() => {
    const fetchChapters = async () => {
      if (!hasRequiredContext) {
        setChapters([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          board: boardParam,
          class: classParam,
        });

        if (subjectId) params.set("subjectId", subjectId);
        if (subjectParam) params.set("subject", subjectParam);
        if (groupParam) params.set("group", groupParam);
        if (boardId) params.set("boardId", boardId);
        if (classId) params.set("classId", classId);
        if (groupId) params.set("groupId", groupId);

        const response = await axiosInstance.get(`/chapters?${params.toString()}`);
        const data = response.data.chapters || response.data || [];
        const sortedChapters = Array.isArray(data)
          ? [...data].sort((a, b) => (a.chapterNumber || 1) - (b.chapterNumber || 1))
          : [];

        setChapters(sortedChapters);
      } catch {
        setError("Chapters could not be loaded right now. Please try again.");
        setChapters([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChapters();
  }, [boardParam, classParam, subjectParam, subjectId, groupParam, boardId, classId, groupId, hasRequiredContext]);

  const toggleChapter = (chapterId) => setExpandedChapter(current => current === chapterId ? null : chapterId);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 font-sans sm:px-6 lg:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Layers className="h-4 w-4" />
              <span>Subject Chapters</span>
            </div>

            <div className="space-y-2">
              <h1 className="max-w-4xl text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                {hasRequiredContext ? (
                  <>
                    <span className="capitalize text-primary">{pageContext.subject}</span> chapters for Class{" "}
                    <span className="text-primary">{pageContext.grade}</span>,{" "}
                    <span className="capitalize">{pageContext.board}</span> Board
                  </>
                ) : (
                  "Select a subject to view its chapters"
                )}
              </h1>
              <p className="max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:text-base">
                Follow the chapter sequence, watch topic videos, download notes and continue into practice when available.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <Link
              to={buildResourceLink({
                path: "/book",
                subject: subjectParam,
                grade: classParam,
                board: boardParam,
                group: groupParam,
                subjectId,
                boardId,
                classId,
                groupId,
              })}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-blue-50 hover:text-blue-600"
            >
              <BookOpen className="h-4 w-4" />
              Full Book
            </Link>
            <Link
              to={buildResourceLink({
                path: "/past-papers",
                subject: subjectParam,
                grade: classParam,
                board: boardParam,
                group: groupParam,
                subjectId,
                boardId,
                classId,
                groupId,
              })}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-500 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-amber-100 hover:text-amber-600"
            >
              <FileText className="h-4 w-4" />
              Past Papers
            </Link>
          </div>
        </header>

        {!hasRequiredContext ? (
          <div className="rounded-2xl border border-dashed border-primary-muted bg-white p-10 text-center shadow-sm">
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="text-lg font-bold text-slate-900">No subject selected</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Go back to subjects and select the subject you want to study. The chapter list will appear here.
            </p>
            <Link
              to="/subjects"
              className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Browse Subjects
            </Link>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="font-semibold">Loading chapters...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-600">
            {error}
          </div>
        ) : chapters.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-900">No chapters available</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              There are no chapters uploaded for this subject yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {chapters.map((chapter) => {
              const chapterNumStr = String(chapter.chapterNumber || 1).padStart(2, "0");
              const chapterTitle = chapter.name || chapter.title || `Chapter ${chapter.chapterNumber || 1}`;
              const videoLink = buildTopicLink({
                chapter,
                subject: subjectParam,
                grade: classParam,
                board: boardParam,
                group: groupParam,
              });
              const notesParams = new URLSearchParams({ chapterId: chapter._id });
              if (subjectParam) notesParams.set("subject", subjectParam);
              if (classParam) notesParams.set("class", classParam);
              if (boardParam) notesParams.set("board", boardParam);
              if (groupParam) notesParams.set("group", groupParam);

              return (
                <article
                  key={chapter._id || chapter.chapterNumber}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-muted hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <button type="button" aria-expanded={expandedChapter === chapter._id} aria-controls={`chapter-${chapter._id}`} onClick={() => toggleChapter(chapter._id)} className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-primary">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-sm font-black tracking-wider text-primary transition group-hover:bg-primary group-hover:text-white">
                        {chapterNumStr}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold leading-6 text-slate-900 transition group-hover:text-primary sm:text-lg">
                          {chapterTitle}
                        </h2>
                        {chapter.description && (
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                            {chapter.description}
                          </p>
                        )}
                      </div>
                      <ChevronDown aria-hidden="true" className={`ml-auto h-5 w-5 shrink-0 transition-transform ${expandedChapter === chapter._id ? "rotate-180" : ""}`} />
                    </button>

                    <div className="ml-auto grid shrink-0 grid-cols-3 gap-2">
                      <Link
                        to={videoLink}
                        title={`Watch ${chapterTitle} videos`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-500 transition hover:bg-red-500 hover:text-white"
                      >
                        <IoLogoYoutube className="h-4 w-4" />
                        Video
                      </Link>
                      <Link
                        to={`/notes?${notesParams.toString()}`}
                        title={`Open ${chapterTitle} notes`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
                      >
                        <Download className="h-4 w-4" />
                        Notes
                      </Link>
                      <Link
                        to={`/tests/start?chapter=${chapter._id}&type=chapter_test`}
                        title={`Take the complete ${chapterTitle} test`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-primary"
                      >
                        <FileText className="h-4 w-4" />
                        Test
                      </Link>
                    </div>
                  </div>
                  {expandedChapter === chapter._id && <div id={`chapter-${chapter._id}`} className="mt-4 border-t border-slate-200">
                    <ChapterTopics chapter={chapter} context={searchParams} />
                  </div>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

export default Chapters;
