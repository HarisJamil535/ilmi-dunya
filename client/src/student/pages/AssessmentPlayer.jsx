import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Flag, Loader2, Send, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import ConfirmModal from "../../shared/ConfirmModal";
import "./learning-experience.css";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const AssessmentPlayer = ({ chapter, topic }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const submittingRef = useRef(false);
  const startRequest = useRef(null);
  const pendingSave = useRef(null);
  const serverOffset = useRef(0);
  const audioContext = useRef(null);
  const retryAfter = useRef(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enableAudio = () => {
    if (!soundEnabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!audioContext.current) audioContext.current = new Audio();
    audioContext.current.resume().catch(() => {});
  };

  useEffect(() => () => { audioContext.current?.close().catch(() => {}); audioContext.current = null; }, []);

  useEffect(() => {
    const context = audioContext.current;
    if (!soundEnabled || remaining > 30 || remaining <= 0 || submitting || context?.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 850;
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.065);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.07);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }, [remaining, soundEnabled, submitting]);

  const submitAttempt = useCallback(async (autoSubmitted = false) => {
    if (!attempt || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setActionError("");
    try {
      const saved = await pendingSave.current;
      if (saved === false && !autoSubmitted) throw new Error("Your last answer could not be saved. Select it again before submitting.");
      const response = await axiosInstance.post(`/attempts/${attempt._id}/submit`, { autoSubmitted });
      navigate(`/tests/result/${response.data.attempt._id}`, { replace: true });
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || "Unable to submit. Your saved answers are retained. Please try again.");
      retryAfter.current = Date.now() + 5000;
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attempt, navigate]);

  useEffect(() => {
    const start = async () => {
      setLoading(true);
      if (!startRequest.current) startRequest.current = axiosInstance.post("/attempts/start", chapter || topic ? { chapter, topic } : { assessmentId: id });
      const response = await startRequest.current;
      const nextAttempt = response.data.attempt;
      serverOffset.current = response.data.serverNow ? new Date(response.data.serverNow).getTime() - Date.now() : 0;
      setAttempt(nextAttempt);
      setRemaining(Math.max(Math.ceil((new Date(nextAttempt.expiresAt).getTime() - Date.now() - serverOffset.current) / 1000), 0));
      setLoading(false);
    };
    start().catch((err) => {
      setError(err.response?.data?.message || "Unable to start the test. Please try again.");
      setLoading(false);
    });
  }, [id, chapter, topic]);

  useEffect(() => {
    const warn = (event) => {
      if (attempt?.status === "in_progress" && !submittingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt, submitAttempt]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return undefined;
    const interval = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now() - serverOffset.current) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && Date.now() >= retryAfter.current) submitAttempt(true);
    }, 250);
    return () => clearInterval(interval);
  }, [attempt, submitAttempt]);

  const answers = useMemo(() => attempt?.answers || [], [attempt]);
  const current = answers[currentIndex];
  const answeredCount = answers.filter((answer) => answer.selectedOption).length;
  const progress = answers.length ? Math.round((answeredCount / answers.length) * 100) : 0;

  const selectedOption = current?.selectedOption || "";

  const saveAnswer = async (patch) => {
    if (!attempt || !current || saving || pendingSave.current || submittingRef.current || remaining <= 0) return;
    setSaving(true);
    setActionError("");
    const nextAnswer = { ...current, ...patch };
    setAttempt((previous) => ({ ...previous, answers: previous.answers.map((answer) => answer.question._id === current.question._id ? nextAnswer : answer) }));
    const request = axiosInstance.patch(`/attempts/${attempt._id}/questions/${current.question._id}`, patch)
      .then(() => true)
      .catch((err) => {
        setAttempt((previous) => ({ ...previous, answers: previous.answers.map((answer) => answer.question._id === current.question._id ? current : answer) }));
        setActionError(err.response?.data?.message || "Answer was not saved. Please select it again.");
        return false;
      }).finally(() => { setSaving(false); pendingSave.current = null; });
    pendingSave.current = request;
    await request;
  };

  const question = current?.question;
  const scenario = question?.type === "scenario_mcq" ? question.scenario : null;
  const scenarioIndices = scenario ? answers.flatMap((answer, index) => answer.question?.type === "scenario_mcq" && answer.question.scenario?._id === scenario._id ? [index] : []) : [];
  const scenarioPosition = scenarioIndices.indexOf(currentIndex) + 1;
  const unanswered = useMemo(() => answers.filter((answer) => !answer.selectedOption).length, [answers]);

  if (error) return <main className="mx-auto max-w-2xl p-8 text-center"><p role="alert">{error}</p><button className="mt-4 rounded-lg bg-primary px-4 py-2 text-white" onClick={() => navigate(-1)}>Back to study</button></main>;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <main className="min-h-screen bg-slate-100" onPointerDown={enableAudio} onKeyDown={enableAudio}>
      <header className="sticky top-16 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-primary">MCQ Test</p>
            <h1 className="text-lg font-black text-slate-950">{attempt.assessment.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className={`test-timer ${remaining <= 30 && remaining > 0 ? "urgent" : ""}`} role="timer" aria-label={`Time remaining ${formatTime(remaining)}`}>
              <Clock3 className="h-6 w-6" />
              <div><small>{remaining <= 30 ? "Finishing soon" : "Time remaining"}</small><strong>{formatTime(remaining)}</strong></div>
            </div>
            <button type="button" title={soundEnabled ? "Mute countdown sound" : "Enable countdown sound"} aria-label={soundEnabled ? "Mute countdown sound" : "Enable countdown sound"} aria-pressed={soundEnabled} onClick={() => setSoundEnabled((value) => !value)} className="rounded-lg border border-slate-200 p-3">
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button disabled={submitting} onClick={() => setShowSubmitConfirm(true)} className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {actionError && <p role="alert" className="learning-alert">{actionError}</p>}
          {remaining <= 30 && <p role="status" className="mb-4 text-sm font-bold text-rose-700">{remaining === 0 ? "Time is up. Submitting your saved answers." : "30 seconds or less remaining. Check any unanswered questions."}</p>}
          <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>

          {scenario && (
            <div className="mb-6 rounded-2xl border border-primary-soft bg-primary-soft p-4">
              <p className="mb-2 text-sm font-bold text-primary-dark">Read this scenario and answer {scenarioIndices.length === 1 ? "the following question" : `the following ${scenarioIndices.length} questions`}.</p>
              <h2 className="font-black text-primary-dark">{scenario.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary-dark">{scenario.scenarioText}</p>
              <p className="mt-3 text-xs font-semibold text-primary-dark">Scenario question {scenarioPosition} of {scenarioIndices.length}</p>
            </div>
          )}

          <p className="text-sm font-black text-primary">Question {currentIndex + 1} of {answers.length}</p>
          <h2 className="mt-3 text-xl font-black leading-8 text-slate-950">{question?.questionText}</h2>

          <div className="mt-6 grid gap-3">
            {question?.options?.map((option) => {
              const active = selectedOption === option.key;
              return (
                <button
                  key={option.key}
                  disabled={saving || submitting || remaining <= 0}
                  aria-pressed={active}
                  onClick={() => saveAnswer({ selectedOption: option.key, skipped: false })}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    active ? "border-primary-muted bg-primary-soft text-primary-dark" : "border-slate-200 bg-white hover:border-primary-muted hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>{option.key}</span>
                  <span className="text-sm font-bold leading-6">{option.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button onClick={() => saveAnswer({ skipped: true, selectedOption: "" })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                <SkipForward className="h-4 w-4" /> Skip
              </button>
              <button onClick={() => saveAnswer({ flaggedForReview: !current.flaggedForReview })} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2 text-sm font-bold text-amber-700">
                <Flag className="h-4 w-4" /> {current.flaggedForReview ? "Unflag" : "Flag"}
              </button>
            </div>
            <div className="flex gap-2">
              <button disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => value - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-40">Previous</button>
              <button disabled={currentIndex === answers.length - 1} onClick={() => setCurrentIndex((value) => value + 1)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next</button>
            </div>
          </div>
          {saving && <p className="mt-4 text-xs font-bold text-slate-400">Saving answer...</p>}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-36 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Navigator</h2>
            <span className="text-xs font-black text-primary">{progress}%</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {answers.map((answer, index) => (
              <button
                key={answer.question._id}
                onClick={() => setCurrentIndex(index)}
                className={`h-10 rounded-xl text-sm font-black ${
                  index === currentIndex
                    ? "bg-primary text-white"
                    : answer.flaggedForReview
                      ? "bg-amber-100 text-amber-700"
                      : answer.selectedOption
                        ? "bg-emerald-100 text-emerald-700"
                        : answer.skipped
                          ? "bg-slate-200 text-slate-500"
                          : "bg-slate-50 text-slate-500"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2 text-xs font-bold text-slate-500">
            <p><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" /> Answered: {answeredCount}</p>
            <p><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-600" /> Unanswered: {unanswered}</p>
          </div>
          <button onClick={() => setShowSubmitConfirm(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white">
            <Send className="h-4 w-4" />
            Submit Test
          </button>
        </aside>
      </section>
      <ConfirmModal
        isOpen={showSubmitConfirm}
        title="Submit MCQ test?"
        description={unanswered > 0
          ? `You still have ${unanswered} unanswered ${unanswered === 1 ? "question" : "questions"}. You can review them before submitting, or submit now.`
          : "All questions are answered. Submit now to calculate your result. You will not be able to change this attempt afterward."}
        confirmLabel="Submit Test"
        cancelLabel="Keep Solving"
        isLoading={submitting}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={() => submitAttempt(false)}
      />
    </main>
  );
};

export default AssessmentPlayer;
