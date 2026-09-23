import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, CalendarDays, FileQuestion, Loader2, Moon, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import Breadcrumbs from "../components/Breadcrumbs";

const questionTypes = [
  {
    value: "long_question",
    label: "Long Questions",
    shortLabel: "Long",
    description: "Detailed board-style questions for full answer practice.",
  },
  {
    value: "short_question",
    label: "Short Questions",
    shortLabel: "Short",
    description: "Quick questions for focused topic revision.",
  },
];

const typeText = {
  long_question: "long questions",
  short_question: "short questions",
};

function QuestionList({ topic, type, onTopicName }) {
  const [state, setState] = useState({ loading: true, questions: [], name: "", error: "" });

  useEffect(() => {
    const controller = new AbortController();

    axiosInstance
      .get("/questions/topic-questions", { params: { topic, contentType: type }, signal: controller.signal })
      .then(({ data }) => {
        const topicName = data.topic?.name || "Topic Questions";
        document.title = `${topicName} Questions | IlmiDunya`;
        onTopicName(topicName);
        setState({ loading: false, questions: data.questions || [], name: topicName, error: "" });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            questions: [],
            name: "",
            error: err.response?.data?.message || "Unable to load questions. Please try again.",
          });
        }
      })
    return () => controller.abort();
  }, [topic, type, onTopicName]);

  if (state.loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Loader2 className="animate-spin" size={24} />
          </span>
          <div>
            <p className="text-base font-black text-slate-900">Loading questions</p>
            <p className="mt-1 text-sm text-slate-500">Preparing this topic for revision.</p>
          </div>
        </div>
      </section>
    );
  }

  if (state.error) {
    return (
      <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
        <SearchX className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-4 text-lg font-black text-rose-950">Questions could not be loaded</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-rose-700">{state.error}</p>
      </section>
    );
  }

  if (!state.questions.length) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <FileQuestion className="mx-auto h-10 w-10 text-slate-400" />
        <h2 className="mt-4 text-lg font-black text-slate-950">No {typeText[type]} added yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          This topic is ready, but the admin has not published {typeText[type]} for it yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label={`${state.name} ${typeText[type]}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Practice Set</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{state.name}</h2>
        </div>
        <span className="rounded-full bg-primary-soft px-4 py-2 text-sm font-black text-primary-dark">
          {state.questions.length} {state.questions.length === 1 ? "Question" : "Questions"}
        </span>
      </div>

      <ol className="space-y-4">
        {state.questions.map((question, index) => (
          <li
            key={question._id}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-6"
          >
            <div className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-base font-semibold leading-8 text-slate-900">
                  {question.questionText}
                </p>
                {(question.examYear || question.examSession) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {question.examYear && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                        <CalendarDays size={14} />
                        {question.examYear}
                      </span>
                    )}
                    {question.examSession && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1.5 text-xs font-bold capitalize text-primary-dark">
                        <Moon size={14} />
                        {question.examSession}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function TopicQuestions() {
  const [params] = useSearchParams();
  const [type, setType] = useState("long_question");
  const [topicName, setTopicName] = useState("Topic Questions");
  const topic = params.get("topic");

  const back = useMemo(() => {
    const next = new URLSearchParams(params);
    next.delete("topic");
    next.delete("chapterId");
    return next.toString();
  }, [params]);

  const activeType = questionTypes.find((item) => item.value === type) || questionTypes[0];

  return (
    <main className="min-h-[70vh] bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
          <Breadcrumbs className="mb-4" items={[
            { label: "Chapters", to: `/chapters?${back}` },
            { label: topicName },
          ]} />
          <Link
            to={`/chapters?${back}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-primary/30 hover:text-primary"
          >
            <ArrowLeft size={16} />
            Back to chapters
          </Link>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-primary-dark">
                <BookOpenCheck size={15} />
                Topic Revision
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                {topicName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Review board-focused questions for this topic. Switch between long and short questions without losing your place in the study flow.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
              <nav aria-label="Question type" className="grid grid-cols-2 gap-2">
                {questionTypes.map((item) => {
                  const active = type === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setType(item.value)}
                      className={`rounded-xl px-4 py-3 text-left transition ${
                        active
                          ? "bg-white text-primary shadow-sm ring-1 ring-primary/20"
                          : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                      }`}
                    >
                      <span className="block text-sm font-black">{item.shortLabel}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold leading-4">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-900">{activeType.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{activeType.description}</p>
        </div>

        <QuestionList key={`${topic}-${type}`} topic={topic} type={type} onTopicName={setTopicName} />
      </section>
    </main>
  );
}
