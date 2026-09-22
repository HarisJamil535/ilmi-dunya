import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, FileText, Loader2, PlayCircle, SearchX, Video } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";

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

const getYoutubeEmbedUrl = (url) => {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("youtu.be")) {
      const videoId = parsedUrl.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (parsedUrl.hostname.includes("youtube.com")) {
      const videoId = parsedUrl.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;

      const embedMatch = parsedUrl.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }
  } catch {
    return "";
  }

  return "";
};

const Videos = () => {
  const [searchParams] = useSearchParams();

  const chapterId = searchParams.get("chapterId") || "";
  const requestedTopic = searchParams.get("topic") || "";
  const chapterNumber = searchParams.get("chapterNumber") || "";
  const subject = searchParams.get("subject") || "";
  const classParam = searchParams.get("class") || "";
  const board = searchParams.get("board") || "";
  const mode = searchParams.get("type") === "notes" ? "notes" : "videos";

  const [topics, setTopics] = useState([]);
  const [chapter, setChapter] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(chapterId));
  const [error, setError] = useState(null);

  const pageContext = useMemo(
    () => ({
      subject: normalizeLabel(subject, "selected subject"),
      board: normalizeLabel(board),
      grade: normalizeLabel(classParam),
    }),
    [subject, board, classParam]
  );

  const selectedTopic = topics.find((topic) => topic._id === selectedTopicId) || topics[0] || null;
  const selectedEmbedUrl = getYoutubeEmbedUrl(selectedTopic?.videoUrl);

  useEffect(() => {
    const readableMode = mode === "notes" ? "Notes" : "Video Lectures";
    document.title = chapter
      ? `${chapter.name} ${readableMode} | IlmiDunya`
      : `${readableMode} | IlmiDunya`;

    setMetaDescription(
      chapter
        ? `Study ${chapter.name} with organized ${readableMode.toLowerCase()} for ${pageContext.subject}.`
        : "Watch topic-wise video lectures and browse study notes on IlmiDunya."
    );
  }, [chapter, mode, pageContext.subject]);

  useEffect(() => {
    const fetchTopics = async () => {
      if (!chapterId) {
        setTopics([]);
        setChapter(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await axiosInstance.get(`/topics/chapter/${chapterId}`);
        const topicData = response.data.topics || [];
        const sortedTopics = Array.isArray(topicData)
          ? [...topicData].sort((a, b) => String(a.topicNumber).localeCompare(String(b.topicNumber), undefined, { numeric: true }))
          : [];

        setChapter(response.data.chapter || null);
        setTopics(sortedTopics);
        if (requestedTopic && !sortedTopics.some(item => item._id === requestedTopic)) throw new Error("Topic not found");
        setSelectedTopicId(requestedTopic || sortedTopics[0]?._id || "");
      } catch {
        setError("Topics could not be loaded right now. Please try again.");
        setTopics([]);
        setChapter(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, [chapterId, requestedTopic]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 font-sans sm:px-6 lg:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            {mode === "notes" ? <FileText className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            <span>{mode === "notes" ? "Chapter Notes" : "Video Lectures"}</span>
          </div>

          <div className="space-y-2">
            <h1 className="max-w-4xl text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              {chapter ? (
                <>
                  {mode === "notes" ? "Notes" : "Video lessons"} for{" "}
                  <span className="text-primary">{chapter.name}</span>
                </>
              ) : (
                mode === "notes" ? "Select a chapter to view notes" : "Select a chapter to watch video lessons"
              )}
            </h1>
            <p className="max-w-3xl text-sm font-medium leading-6 text-slate-500 sm:text-base">
              {chapter ? (
                <>
                  Chapter {chapter.chapterNumber || chapterNumber || ""}{" "}
                  {pageContext.subject && `for ${pageContext.subject}`}
                  {pageContext.grade && `, Class ${pageContext.grade}`}
                  {pageContext.board && `, ${pageContext.board} Board`}.
                </>
              ) : (
                "Open a chapter from the chapters page to load its topic-wise learning material."
              )}
            </p>
          </div>
        </header>

        {!chapterId ? (
          <div className="rounded-2xl border border-dashed border-primary-muted bg-white p-10 text-center shadow-sm">
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="text-lg font-bold text-slate-900">No chapter selected</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Choose a subject and chapter first. Topic videos and notes will appear here.
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
            <p className="font-semibold">Loading topics...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-600">
            {error}
          </div>
        ) : topics.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-900">No topics available</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This chapter does not have topic material uploaded yet.
            </p>
          </div>
        ) : mode === "notes" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topics.map((topic) => (
              <article key={topic._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-600">
                    {String(topic.topicNumber || 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-900">{topic.name}</h2>
                    {topic.description && (
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500">{topic.description}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
                >
                  <Download className="h-4 w-4" />
                  Notes Coming Soon
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="aspect-video min-h-[220px] bg-slate-950">
                {selectedEmbedUrl ? (
                  <iframe
                    title={selectedTopic?.name || "Video lesson"}
                    src={selectedEmbedUrl}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
                    <PlayCircle className="h-12 w-12 text-white/70" />
                    <p className="text-sm font-semibold text-white/80">Video link is not available for this topic yet.</p>
                  </div>
                )}
              </div>

              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Topic {selectedTopic?.topicNumber || 1}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{selectedTopic?.name}</h2>
                {selectedTopic?.description && (
                  <p className="mt-2 text-sm leading-6 text-slate-500">{selectedTopic.description}</p>
                )}
                {selectedTopic?._id && (
                  <Link
                    to={`/tests/start?topic=${selectedTopic._id}`}
                    className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-black text-white"
                  >
                    Start Topic MCQ Test
                  </Link>
                )}
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto">
              <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-700">Chapter Topics</h2>
              <div className="flex flex-col gap-2">
                {topics.map((topic) => {
                  const isActive = topic._id === selectedTopic?._id;

                  return (
                    <button
                      key={topic._id}
                      type="button"
                      onClick={() => setSelectedTopicId(topic._id)}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-primary-muted bg-primary-soft text-primary-dark"
                          : "border-slate-100 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black">
                        {String(topic.topicNumber || 1).padStart(2, "0")}
                      </span>
                      <span className="line-clamp-2 text-sm font-bold">{topic.name}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
};

export default Videos;
