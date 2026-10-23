import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, ClipboardCheck, FileCheck2, FileText, GraduationCap, Landmark, Layers, NotebookPen, PlayCircle, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import ChapterTopics from "../components/ChapterTopics";
import Breadcrumbs from "../components/Breadcrumbs";
import "./chapters.css";

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
  String(value || fallback).replace(/-/g, " ").trim();

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
  usePageLoading(isLoading);
  const [error, setError] = useState(null);
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [answerSheet, setAnswerSheet] = useState(null);
  const [retry, setRetry] = useState(0);

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
    const controller = new AbortController();
    setAnswerSheet(null);
    setExpandedChapter(null);
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

        const response = await axiosInstance.get(`/chapters?${params.toString()}`, { signal: controller.signal });
        const data = response.data.chapters || response.data || [];
        const sortedChapters = Array.isArray(data)
          ? [...data].sort((a, b) => (a.chapterNumber || 1) - (b.chapterNumber || 1))
          : [];

        setChapters(sortedChapters);
        setIsLoading(false);
        const resolvedBoardId = boardId || sortedChapters[0]?.board?._id;
        const resolvedClassId = classId || sortedChapters[0]?.class?._id;
        if (resolvedBoardId && resolvedClassId) {
          try {
            const answerResponse = await axiosInstance.get(`/resources/answer-sheets?board=${resolvedBoardId}&class=${resolvedClassId}`, { signal: controller.signal });
            setAnswerSheet(answerResponse.data.answerSheets?.[0] || null);
          } catch {
            if (!controller.signal.aborted) setAnswerSheet(null);
          }
        } else {
          setAnswerSheet(null);
        }
      } catch {
        if (controller.signal.aborted) return;
        setError("Chapters could not be loaded right now. Please try again.");
        setChapters([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchChapters();
    return () => controller.abort();
  }, [boardParam, classParam, subjectParam, subjectId, groupParam, boardId, classId, groupId, hasRequiredContext, retry]);

  const toggleChapter = (chapterId) => setExpandedChapter(current => current === chapterId ? null : chapterId);

  const resourceLinks = {
    subject: subjectParam, grade: classParam, board: boardParam, group: groupParam, subjectId, boardId, classId, groupId,
  };

  return (
    <main className="chapters-page">
      <section className="chapters-shell">
        <Breadcrumbs items={[
          { label: "Subjects", to: `/subjects?${searchParams.toString()}` },
          { label: pageContext.subject || "Chapters" },
        ]} />
        <header className="chapters-hero">
          <div className="hero-copy">
            <span className="hero-eyebrow"><Layers aria-hidden="true" size={14} />Subject chapters</span>
            <h1 className="capitalize">{hasRequiredContext ? pageContext.subject : "Select a subject to view its chapters"}</h1>
            {hasRequiredContext && <div className="chapter-context">
              <span><GraduationCap aria-hidden="true" size={14} />Class {pageContext.grade}</span>
              <span className="capitalize"><Landmark aria-hidden="true" size={14} />{pageContext.board}{/board/i.test(pageContext.board) ? "" : " Board"}</span>
              {pageContext.group && <span className="capitalize"><Layers aria-hidden="true" size={14} />{pageContext.group}</span>}
            </div>}
            <p>{chapters.length > 0 ? `${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"} with video lessons, notes and MCQ tests. Tap a chapter to see its topics.` : "Select a chapter to explore its topics, notes, videos and tests."}</p>
          </div>
          <nav className="resource-panel" aria-label="Subject resources">
            <p className="resource-kicker">Subject resources</p>
            <Link to={buildResourceLink({ path: "/book", ...resourceLinks })} className="resource-link is-primary">
              <span className="resource-icon"><BookOpen aria-hidden="true" size={20} /></span>
              <span className="resource-text"><strong>Download full book</strong><small>Complete textbook PDF</small></span>
              <ArrowUpRight className="resource-arrow" size={18} aria-hidden="true" />
            </Link>
            <Link to={buildResourceLink({ path: "/past-papers", ...resourceLinks })} className="resource-link">
              <span className="resource-icon"><FileText aria-hidden="true" size={20} /></span>
              <span className="resource-text"><strong>Past papers</strong><small>Previous board exams</small></span>
              <ArrowUpRight className="resource-arrow" size={18} aria-hidden="true" />
            </Link>
            {answerSheet && <Link to={buildResourceLink({ path: "/answer-sheet", ...resourceLinks, boardId: boardId || answerSheet.board?._id, classId: classId || answerSheet.class?._id })} className="resource-link answer-sheet-resource">
              <span className="resource-icon"><FileCheck2 aria-hidden="true" size={20} /></span>
              <span className="resource-text"><strong>Answer sheet</strong><small>Check your answers</small></span>
              <ArrowUpRight className="resource-arrow" size={18} aria-hidden="true" />
            </Link>}
          </nav>
        </header>

        {!hasRequiredContext ? (
          <div className="state-card is-dashed">
            <span className="state-icon"><BookOpen aria-hidden="true" size={26} /></span>
            <h2>No subject selected</h2>
            <p>Go back to subjects and select the subject you want to study. The chapter list will appear here.</p>
            <Link to="/subjects" className="state-button">Browse subjects</Link>
          </div>
        ) : isLoading ? (
          <div className="state-loading"><Spinner /></div>
        ) : error ? (
          <div className="state-card is-error">
            <p role="alert">{error}</p>
            <button type="button" onClick={() => setRetry(value => value + 1)} className="state-button">Try again</button>
          </div>
        ) : chapters.length === 0 ? (
          <div className="state-card">
            <span className="state-icon"><SearchX aria-hidden="true" size={26} /></span>
            <h2>No chapters available</h2>
            <p>There are no chapters uploaded for this subject yet.</p>
          </div>
        ) : (
          <div className="chapters-body">
            <div className="chapter-list-heading"><h2>Chapters</h2><span>Open a chapter to reach every topic and its important questions</span></div>
            <div className="chapter-list">
            {chapters.map((chapter) => {
              const chapterNumStr = String(chapter.chapterNumber || 1).padStart(2, "0");
              const chapterTitle = chapter.name || chapter.title || `Chapter ${chapter.chapterNumber || 1}`;
              const open = expandedChapter === chapter._id;
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
                <article key={chapter._id || chapter.chapterNumber} className={`chapter-item ${open ? "is-expanded" : ""}`}>
                  <div className="chapter-heading-row">
                    <button type="button" aria-expanded={open} aria-controls={`chapter-${chapter._id}`} onClick={() => toggleChapter(chapter._id)} className="chapter-toggle">
                      <span className="chapter-number">{chapterNumStr}</span>
                      <span className="chapter-title-block">
                        <span className="chapter-overline">Chapter {chapter.chapterNumber || 1}</span>
                        <h2>{chapterTitle}</h2>
                        {chapter.description && <span className="chapter-description">{chapter.description}</span>}
                      </span>
                      <span className="chapter-expand">
                        <span className="chapter-expand-label">{open ? "Hide topics" : "Topics"}</span>
                        <ChevronDown aria-hidden="true" size={18} />
                      </span>
                    </button>
                    <div className="chapter-actions">
                      <Link to={videoLink} title={`Watch videos for the complete ${chapterTitle}`} className="action-video"><PlayCircle aria-hidden="true" />Video</Link>
                      <Link to={`/notes?${notesParams.toString()}`} title={`Open notes for the complete ${chapterTitle}`} className="action-notes"><NotebookPen aria-hidden="true" />Notes</Link>
                      <Link to={`/notes?${notesParams.toString()}&type=exercise`} title={`View exercise notes for ${chapterTitle}`} className="action-exercise"><FileText aria-hidden="true" />Exercise notes</Link>
                      <Link to={`/tests/start?chapter=${chapter._id}&type=chapter_test`} title={`Take an MCQ test covering all topics in ${chapterTitle}`} className="action-test"><ClipboardCheck aria-hidden="true" />Test</Link>
                    </div>
                  </div>
                  {open && <div id={`chapter-${chapter._id}`} className="chapter-topics-content">
                    <ChapterTopics chapter={chapter} context={searchParams} />
                  </div>}
                </article>
              );
            })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default Chapters;
