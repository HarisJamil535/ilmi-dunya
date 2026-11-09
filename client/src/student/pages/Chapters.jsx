import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ClipboardCheck, Download, FileCheck2, FileText, FlaskConical, GraduationCap, Landmark, Layers, NotebookPen, SearchX } from "lucide-react";
import YouTubeIcon from "../components/YouTubeIcon";
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
  const [openChapters, setOpenChapters] = useState(() => new Set());
  const [answerSheet, setAnswerSheet] = useState(null);
  const [pbaOn, setPbaOn] = useState(false);
  const [pbaSubjectId, setPbaSubjectId] = useState("");
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
    setPbaOn(false);
    setOpenChapters(new Set());
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
        // The PBA button only appears on subjects where the admin has switched it on.
        const pbaSubject = subjectId || sortedChapters[0]?.subject?._id || "";
        if (pbaSubject) {
          axiosInstance.get(`/pba/status?subjectId=${pbaSubject}`, { signal: controller.signal })
            .then((statusResponse) => { if (!controller.signal.aborted) { setPbaOn(Boolean(statusResponse.data.enabled)); setPbaSubjectId(pbaSubject); } })
            .catch(() => { if (!controller.signal.aborted) setPbaOn(false); });
        } else setPbaOn(false);
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

  const toggleChapter = (chapterId) => setOpenChapters(current => {
    const next = new Set(current);
    if (next.has(chapterId)) next.delete(chapterId); else next.add(chapterId);
    return next;
  });
  const allOpen = chapters.length > 0 && openChapters.size === chapters.length;
  const toggleAll = () => setOpenChapters(allOpen ? new Set() : new Set(chapters.map(chapter => chapter._id)));

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
            {hasRequiredContext && <ul className="chapter-context" aria-label="Course details">
              <li><GraduationCap aria-hidden="true" size={14} />Class {pageContext.grade}</li>
              <li className="capitalize"><Landmark aria-hidden="true" size={14} />{pageContext.board}{/board/i.test(pageContext.board) ? "" : " Board"}</li>
              {pageContext.group && <li className="capitalize"><Layers aria-hidden="true" size={14} />{pageContext.group}</li>}
            </ul>}
            <h1 className="capitalize">{hasRequiredContext ? pageContext.subject : "Select a subject to view its chapters"}</h1>
            <p>Lectures, notes and tests for every chapter.</p>
          </div>
          <nav className="resource-panel" aria-label="Subject resources">
            <Link to={buildResourceLink({ path: "/book", ...resourceLinks })} className="resource-link is-primary">
              <Download aria-hidden="true" size={18} /><span>Download book</span>
            </Link>
            <Link to={buildResourceLink({ path: "/past-papers", ...resourceLinks })} className="resource-link">
              <FileText aria-hidden="true" size={18} /><span>Past papers</span>
            </Link>
            {pbaOn && <Link to={buildResourceLink({ path: "/pba", ...resourceLinks, subjectId: pbaSubjectId })} className="resource-link is-pba" title="Practical Based Assessment: lectures, notes and practicals">
              <FlaskConical aria-hidden="true" size={18} /><span>Prepare PBA</span><em className="pba-new">New</em>
            </Link>}
            {answerSheet && <Link to={buildResourceLink({ path: "/answer-sheet", ...resourceLinks, boardId: boardId || answerSheet.board?._id, classId: classId || answerSheet.class?._id })} className="resource-link answer-sheet-resource">
              <FileCheck2 aria-hidden="true" size={18} /><span>Answer sheet</span>
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
            <section className="curriculum" aria-labelledby="curriculum-title">
              <div className="curriculum-head">
                <div><h2 id="curriculum-title">Chapters<span className="chapter-count">{chapters.length}</span></h2><p>Open a chapter to see its topics.</p></div>
                <button type="button" className="expand-all" onClick={toggleAll}>{allOpen ? "Collapse all" : "Expand all"}</button>
              </div>
              <div className="chapter-list">
              {chapters.map((chapter) => {
                const chapterTitle = chapter.name || chapter.title || `Chapter ${chapter.chapterNumber || 1}`;
                const open = openChapters.has(chapter._id);
                const videoLink = buildTopicLink({ chapter, subject: subjectParam, grade: classParam, board: boardParam, group: groupParam });
                const notesParams = new URLSearchParams({ chapterId: chapter._id });
                if (subjectParam) notesParams.set("subject", subjectParam);
                if (classParam) notesParams.set("class", classParam);
                if (boardParam) notesParams.set("board", boardParam);
                if (groupParam) notesParams.set("group", groupParam);

                return (
                  <article key={chapter._id || chapter.chapterNumber} className={`chapter-item ${open ? "is-expanded" : ""}`}>
                    <div className="chapter-heading-row">
                      <button type="button" aria-expanded={open} aria-controls={`chapter-${chapter._id}`} onClick={() => toggleChapter(chapter._id)} className="chapter-toggle">
                        <span className="chapter-number" aria-hidden="true">{String(chapter.chapterNumber || 1).padStart(2, "0")}</span>
                        <span className="chapter-title-block">
                          <h3><span className="sr-only">Chapter {chapter.chapterNumber || 1}: </span>{chapterTitle}</h3>
                          {chapter.description && <span className="chapter-description">{chapter.description}</span>}
                        </span>
                        <ChevronDown className="chapter-chevron" aria-hidden="true" size={18} />
                      </button>
                      <div className="chapter-actions">
                        <Link to={videoLink} title={`Watch videos for the complete ${chapterTitle}`} className="action-video"><YouTubeIcon size={20} />Video</Link>
                        <Link to={`/notes?${notesParams.toString()}`} title={`Open notes for the complete ${chapterTitle}`} className="action-notes"><NotebookPen aria-hidden="true" />Notes</Link>
                        <Link to={`/notes?${notesParams.toString()}&type=exercise`} title={`View exercise notes for ${chapterTitle}`} className="action-exercise"><FileText aria-hidden="true" />Exercise<span className="label-extra">notes</span></Link>
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
            </section>
          </div>
        )}
      </section>
    </main>
  );
};

export default Chapters;
