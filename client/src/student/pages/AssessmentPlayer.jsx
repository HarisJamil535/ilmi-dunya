import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../urdu-font.css";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock3, CloudOff, Flag, ListChecks, Loader2, Send, SkipForward, Trophy, Volume2, VolumeX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import ConfirmModal from "../../shared/ConfirmModal";
import MathText from "../../shared/MathText";
import "./learning-experience.css";
import "./test-introduction.css";

// Answers not yet confirmed by the server survive a reload or a dropped connection.
const unsavedKey = (attemptId) => `ilmi-unsaved-answers-${attemptId}`;
const readUnsaved = (attemptId) => { try { return new Map(JSON.parse(localStorage.getItem(unsavedKey(attemptId)) || "[]")); } catch { return new Map(); } };
const writeUnsaved = (attemptId, queue) => { try { if (queue.size) localStorage.setItem(unsavedKey(attemptId), JSON.stringify([...queue])); else localStorage.removeItem(unsavedKey(attemptId)); } catch { /* storage full or blocked */ } };
const pendingList = (queue) => [...queue].map(([question, patch]) => ({ question, ...patch }));
// A refused answer (time up, already submitted, invalid) will never succeed, so it is not retried.
const isFinalFailure = (err) => { const status = err.response?.status; return Boolean(status) && status < 500 && ![408, 429].includes(status); };

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const AssessmentPlayer = ({ chapter, topic }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [countMode, setCountMode] = useState("all");
  const [customCount, setCustomCount] = useState("5");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [sync, setSync] = useState({ unsaved: 0, sending: false, offline: false });
  const [loading, setLoading] = useState(true);
  usePageLoading(loading);
  const [error, setError] = useState("");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const submittingRef = useRef(false);
  const attemptRef = useRef(null);
  const exitSubmittedRef = useRef(false);
  const exitRequestedRef = useRef(false);
  const startRequest = useRef(null);
  const unsaved = useRef(new Map());
  const inFlight = useRef(new Set());
  const retryTimer = useRef(null);
  const retryDelay = useRef(1000);
  const serverOffset = useRef(0);
  const audioContext = useRef(null);
  const retryAfter = useRef(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { attemptRef.current = attempt; }, [attempt]);

  const submitWhenLeaving = useCallback(() => {
    const activeAttempt = attemptRef.current;
    if (!activeAttempt || activeAttempt.status !== "in_progress" || submittingRef.current) return;
    exitRequestedRef.current = true;
    submittingRef.current = true;
    const token = localStorage.getItem("studentToken");
    const apiBase = import.meta.env.VITE_API_URL || "/api";
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    // One request carries any answers not yet sent, because the page may close before a second one could start.
    const submitNow = () => fetch(`${apiBase}/attempts/${activeAttempt._id}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ autoSubmitted: true, reason: "left_test_page", ...(unsaved.current.size ? { answers: pendingList(unsaved.current) } : {}) }),
      keepalive: true,
    });
    submitNow().then(async (response) => {
      if (response.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return submitNow();
      }
      return response;
    }).then((response) => {
      if (!response.ok) throw new Error("Automatic submission failed");
      writeUnsaved(activeAttempt._id, new Map());
      exitSubmittedRef.current = true;
      if (document.visibilityState === "visible") navigate(`/tests/result/${activeAttempt._id}`, { replace: true });
    }).catch(() => {
      submittingRef.current = false;
    });
  }, [navigate]);

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

  const updateSync = useCallback((extra = {}) => {
    setSync((current) => ({ ...current, unsaved: unsaved.current.size, sending: inFlight.current.size > 0, ...extra }));
  }, []);

  // Sends every answer still waiting, newest choice per question, and retries until the server has them.
  const flushAnswers = useCallback(async () => {
    const active = attemptRef.current;
    if (!active) return true;
    clearTimeout(retryTimer.current);
    const batch = [...unsaved.current].filter(([questionId]) => !inFlight.current.has(questionId));
    let temporaryFailure = false;
    batch.forEach(([questionId]) => inFlight.current.add(questionId));
    updateSync();
    await Promise.all(batch.map(async ([questionId, patch]) => {
      try {
        await axiosInstance.patch(`/attempts/${active._id}/questions/${questionId}`, patch, { quietNetwork: true, timeout: 15000 });
        if (unsaved.current.get(questionId) === patch) unsaved.current.delete(questionId);
      } catch (err) {
        if (isFinalFailure(err)) {
          if (unsaved.current.get(questionId) === patch) unsaved.current.delete(questionId);
          setActionError(err.response?.data?.message || "That answer could not be saved.");
        } else temporaryFailure = true;
      } finally {
        inFlight.current.delete(questionId);
      }
    }));
    writeUnsaved(active._id, unsaved.current);
    if (temporaryFailure) {
      updateSync({ offline: true });
      retryTimer.current = setTimeout(() => { flushAnswers(); }, retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, 10000);
      return false;
    }
    retryDelay.current = 1000;
    // Choices made while this batch was sending go out next.
    if ([...unsaved.current.keys()].some((questionId) => !inFlight.current.has(questionId))) return flushAnswers();
    updateSync({ offline: false });
    return unsaved.current.size === 0;
  }, [updateSync]);

  // Waits for queued answers, for up to the given time, before a submit.
  const answersSettled = useCallback(async (waitMs) => {
    const end = Date.now() + waitMs;
    while (Date.now() < end) {
      if (!unsaved.current.size) return true;
      if (!inFlight.current.size) await flushAnswers();
      if (!unsaved.current.size) return true;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return !unsaved.current.size;
  }, [flushAnswers]);

  useEffect(() => {
    const online = () => { retryDelay.current = 1000; flushAnswers(); };
    window.addEventListener("online", online);
    return () => { window.removeEventListener("online", online); clearTimeout(retryTimer.current); };
  }, [flushAnswers]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return undefined;
    document.documentElement.dataset.testInProgress = "true";
    return () => { delete document.documentElement.dataset.testInProgress; };
  }, [attempt]);

  const submitAttempt = useCallback(async (autoSubmitted = false) => {
    if (!attempt || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setActionError("");
    try {
      // Give answers already on their way a moment; anything still waiting travels with the submit.
      await answersSettled(3000);
      const response = await axiosInstance.post(`/attempts/${attempt._id}/submit`, { autoSubmitted, ...(unsaved.current.size ? { answers: pendingList(unsaved.current) } : {}) }, { quietNetwork: true, timeout: 30000 });
      unsaved.current.clear();
      writeUnsaved(attempt._id, new Map());
      navigate(`/tests/result/${response.data.attempt._id}`, { replace: true });
    } catch (err) {
      setActionError(err.response?.data?.message || (err.request && !err.response ? `You seem to be offline, so the test was not submitted. Your answers are kept on this device. Check your connection and submit again.` : err.message) || "Unable to submit. Your saved answers are retained. Please try again.");
      retryAfter.current = Date.now() + 5000;
      submittingRef.current = false;
      setSubmitting(false);
      // Close the confirmation so the explanation is visible, and bring it into view.
      setShowSubmitConfirm(false);
      requestAnimationFrame(() => document.querySelector(".learning-alert")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }, [attempt, navigate, answersSettled]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(chapter || topic ? { ...(chapter ? { chapter } : {}), ...(topic ? { topic } : {}) } : { assessmentId: id });
    axiosInstance.get(`/attempts/preview?${params}`, { signal: controller.signal })
      .then(({ data }) => { setPreview(data.test); setCustomCount(String(Math.min(25, data.test.availableQuestions || data.test.questionCount))); setLoading(false); })
      .catch((err) => { if (!controller.signal.aborted) { setError(err.response?.data?.message || "Unable to load test details. Please try again."); setLoading(false); } });
    return () => controller.abort();
  }, [id, chapter, topic]);

  useEffect(() => {
    if (!confirmed) return;
    const start = async () => {
      setLoading(true);
      if (!startRequest.current) startRequest.current = axiosInstance.post("/attempts/start", {
        ...(chapter || topic ? { chapter, topic } : { assessmentId: id }),
        questionCount: countMode === "all" ? "all" : Number(customCount),
      });
      const response = await startRequest.current;
      let nextAttempt = response.data.attempt;
      // Answers chosen before a reload or crash that never reached the server are restored and sent.
      unsaved.current = readUnsaved(nextAttempt._id);
      if (unsaved.current.size) nextAttempt = { ...nextAttempt, answers: nextAttempt.answers.map((answer) => unsaved.current.has(String(answer.question._id)) ? { ...answer, ...unsaved.current.get(String(answer.question._id)) } : answer) };
      serverOffset.current = response.data.serverNow ? new Date(response.data.serverNow).getTime() - Date.now() : 0;
      setAttempt(nextAttempt);
      attemptRef.current = nextAttempt;
      if (document.visibilityState === "hidden") submitWhenLeaving();
      setRemaining(Math.max(Math.ceil((new Date(nextAttempt.expiresAt).getTime() - Date.now() - serverOffset.current) / 1000), 0));
      setLoading(false);
      if (unsaved.current.size) flushAnswers();
    };
    start().catch((err) => {
      setError(err.response?.data?.message || "Unable to start the test. Please try again.");
      setLoading(false);
    });
  }, [id, chapter, topic, confirmed, countMode, customCount, submitWhenLeaving, flushAnswers]);

  useEffect(() => {
    const onPageHide = () => submitWhenLeaving();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") submitWhenLeaving();
      if (document.visibilityState === "visible" && exitSubmittedRef.current) {
        navigate(`/tests/result/${attemptRef.current?._id}`, { replace: true });
      } else if (document.visibilityState === "visible" && exitRequestedRef.current) {
        submitWhenLeaving();
      }
    };
    const onPopState = () => submitWhenLeaving();
    const onLinkClick = (event) => {
      const link = event.target.closest?.("a[href]");
      if (link && link.href && new URL(link.href, window.location.href).href !== window.location.href) submitWhenLeaving();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("click", onLinkClick, true);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("click", onLinkClick, true);
      // Router navigation can unmount this page before its popstate listener runs.
      submitWhenLeaving();
    };
  }, [navigate, submitWhenLeaving]);

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

  // The choice shows at once and is sent in the background; a slow or dropped connection never blocks the student.
  const saveAnswer = (patch) => {
    if (!attempt || !current || submittingRef.current || remaining <= 0) return;
    setActionError("");
    const questionId = String(current.question._id);
    setAttempt((previous) => ({ ...previous, answers: previous.answers.map((answer) => String(answer.question._id) === questionId ? { ...answer, ...patch } : answer) }));
    unsaved.current.set(questionId, { ...unsaved.current.get(questionId), ...patch });
    writeUnsaved(attempt._id, unsaved.current);
    updateSync();
    if (!inFlight.current.has(questionId)) flushAnswers();
  };

  const question = current?.question;
  const scenario = question?.type === "scenario_mcq" ? question.scenario : null;
  const scenarioIndices = scenario ? answers.flatMap((answer, index) => answer.question?.type === "scenario_mcq" && answer.question.scenario?._id === scenario._id ? [index] : []) : [];
  const scenarioPosition = scenarioIndices.indexOf(currentIndex) + 1;
  const unanswered = useMemo(() => answers.filter((answer) => !answer.selectedOption).length, [answers]);
  const chosenCount = countMode === "all" ? preview?.questionCount : Number(customCount);
  const countValid = countMode === "all" || (Number.isInteger(chosenCount) && chosenCount >= 5 && chosenCount <= preview?.availableQuestions);
  const partial = preview?.canChooseCount && countMode !== "all" && chosenCount < preview.availableQuestions;
  const ranked = preview?.ranked && !partial;

  if (error) return <main className="mx-auto max-w-2xl p-8 text-center"><p role="alert">{error}</p><button className="mt-4 rounded-lg bg-primary px-4 py-2 text-white" onClick={() => navigate(-1)}>Back to study</button></main>;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  }

  if (!confirmed) return (
    <main className="test-introduction">
      <section className="test-introduction-panel" aria-labelledby="test-introduction-title">
        <header className="test-introduction-header">
          <p className="test-introduction-eyebrow">Before you begin</p>
          <h1 id="test-introduction-title">{preview?.title}</h1>
          <dl className="test-introduction-stats" aria-label="Test overview">
            <div><ListChecks size={20} aria-hidden="true" /><dt>Questions</dt><dd>{countValid ? chosenCount : "—"}</dd></div>
            <div><Clock3 size={20} aria-hidden="true" /><dt>Minutes</dt><dd>{preview?.canChooseCount ? (countValid ? chosenCount : "—") : preview?.durationMinutes}</dd></div>
            {!partial && <div><Trophy size={20} aria-hidden="true" /><dt>Marks</dt><dd>{preview?.totalMarks}</dd></div>}
          </dl>
        </header>
        <div className="test-introduction-body">
          {preview?.canChooseCount && <fieldset className="test-question-count">
            <legend>How many MCQs?</legend>
            <label><input type="radio" name="question-count-mode" value="all" checked={countMode === "all"} onChange={() => setCountMode("all")} /> All {preview.availableQuestions} questions</label>
            {preview.availableQuestions > 5 && <>
              <label><input type="radio" name="question-count-mode" value="custom" checked={countMode === "custom"} onChange={() => setCountMode("custom")} /> Choose a number</label>
              {countMode === "custom" && <label className="test-count-input">Number of MCQs
                <input type="number" min="5" max={preview.availableQuestions} step="1" value={customCount} onChange={event => setCustomCount(event.target.value)} aria-describedby="test-count-help" aria-invalid={!countValid} />
              </label>}
            </>}
            <p id="test-count-help">One minute per MCQ.{countMode === "custom" ? ` Choose 5–${preview.availableQuestions}. A fresh random set is selected for each attempt.` : preview.availableQuestions < 5 ? " This topic has fewer than five MCQs, so all are included." : " All questions are selected by default."}</p>
            {!countValid && <p role="alert">Enter a whole number between 5 and {preview.availableQuestions}.</p>}
          </fieldset>}
          <h2>Test rules</h2>
          <ol className="test-introduction-rules">
            <li><span aria-hidden="true">1</span><div><h3>{preview?.resume ? "Your timer is already running" : "Start when you are ready"}</h3><p>{preview?.resume ? "Your earlier attempt is still in progress." : "The timer starts when you select Start test."} Your answers save as you go.</p></div></li>
            <li><span aria-hidden="true">2</span><div><h3>Answer at your own pace</h3><p>You can skip questions and return to them before submitting.</p></div></li>
            <li className="test-introduction-exit-rule"><span aria-hidden="true">3</span><div><h3>Stay on the test page</h3><p>Leaving or switching away submits your saved answers automatically.</p></div></li>
            {preview?.resultsWithheld
              ? <li><span aria-hidden="true">4</span><div><h3>Results are released later</h3><p>Your score and answers will appear once your teacher releases the results. Released results count on the leaderboard.</p></div></li>
              : <li><span aria-hidden="true">4</span><div><h3>{ranked ? "Your first attempt counts most" : "Practise without ranking"}</h3><p>{ranked ? "For the leaderboard, your first attempt counts 60% and your best retake 40%. Retakes count 12 hours apart, up to 3 times. Take your time: answering too quickly scores 0." : "Shorter practice sets do not affect the leaderboard. Select all questions to compete in a topic or chapter test."}</p></div></li>}
            {(preview?.closesAt || preview?.maxAttempts > 0) && !preview?.resume && <li><span aria-hidden="true">5</span><div><h3>Test limits</h3><p>{[
              preview.closesAt && `This test closes on ${new Date(preview.closesAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}; an attempt in progress ends then.`,
              preview.maxAttempts > 0 && `You can attempt it ${preview.maxAttempts === 1 ? "once" : `${preview.maxAttempts} times`}.`,
            ].filter(Boolean).join(" ")}</p></div></li>}
          </ol>
          {preview?.instructions?.length > 0 && <aside className="test-introduction-extra"><h2>Teacher instructions</h2><ul>{preview.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ul></aside>}
        </div>
        <footer className="test-introduction-actions">
          <Link to="/tests" className="test-introduction-back"><ArrowLeft size={18} aria-hidden="true" /> Back to tests</Link>
          <button type="button" disabled={!countValid} onClick={() => { setConfirmed(true); setLoading(true); }} className="test-introduction-start">{preview?.resume ? "Continue test" : "Start test"}<ArrowRight size={18} aria-hidden="true" /></button>
        </footer>
      </section>
    </main>
  );

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
          <p role="note" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-5 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Leaving or switching away from this test page will submit your saved answers automatically.
          </p>
          {remaining <= 30 && <p role="status" className="mb-4 text-sm font-bold text-rose-700">{remaining === 0 ? "Time is up. Submitting your saved answers." : "30 seconds or less remaining. Check any unanswered questions."}</p>}
          <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>

          {scenario && (
            <div dir={question?.contentLanguage === "ur" ? "rtl" : "ltr"} lang={question?.contentLanguage === "ur" ? "ur" : "en"} className={`mb-6 rounded-2xl border border-primary-soft bg-primary-soft p-4 ${question?.contentLanguage === "ur" ? "urdu-content" : ""}`}>
              <p className="mb-2 text-sm font-bold text-primary-dark">Read this scenario and answer {scenarioIndices.length === 1 ? "the following question" : `the following ${scenarioIndices.length} questions`}.</p>
              <h2 className="font-black text-primary-dark">{scenario.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary-dark"><MathText text={scenario.scenarioText} /></p>
              <p className="mt-3 text-xs font-semibold text-primary-dark">Scenario question {scenarioPosition} of {scenarioIndices.length}</p>
            </div>
          )}

          <p className="text-sm font-black text-primary">Question {currentIndex + 1} of {answers.length}</p>
          <h2 dir={question?.contentLanguage === "ur" ? "rtl" : "ltr"} lang={question?.contentLanguage === "ur" ? "ur" : "en"} className={`mt-3 whitespace-pre-wrap text-xl font-black leading-8 text-slate-950 ${question?.contentLanguage === "ur" ? "urdu-content text-2xl" : ""}`}><MathText text={question?.questionText} /></h2>
          {question?.imageUrls?.[0] && <img src={question.imageUrls[0]} alt={question.imageAlt || "Question diagram"} className="mt-4 max-h-80 max-w-full rounded-xl border border-slate-200 bg-white object-contain" loading="lazy" />}

          <div className="mt-6 grid gap-3">
            {question?.options?.map((option) => {
              const active = selectedOption === option.key;
              return (
                <button
                  key={option.key}
                  disabled={submitting || remaining <= 0}
                  aria-pressed={active}
                  onClick={() => saveAnswer({ selectedOption: option.key, skipped: false })}
                  dir={question?.contentLanguage === "ur" ? "rtl" : "ltr"}
                  lang={question?.contentLanguage === "ur" ? "ur" : "en"}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition ${question?.contentLanguage === "ur" ? "urdu-content text-right" : "text-left"} ${
                    active ? "border-primary-muted bg-primary-soft text-primary-dark" : "border-slate-200 bg-white hover:border-primary-muted hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>{option.label || option.key}</span>
                  <span className="min-w-0 whitespace-pre-wrap text-sm font-bold leading-6"><MathText text={option.text} /></span>
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
          <p role="status" aria-live="polite" className={`mt-4 inline-flex items-center gap-1.5 text-xs font-bold ${sync.offline ? "text-amber-700" : "text-slate-400"}`}>
            {sync.offline
              ? <><CloudOff className="h-3.5 w-3.5" />Connection lost. Keep answering: {sync.unsaved} {sync.unsaved === 1 ? "answer is" : "answers are"} kept on this device and will be sent automatically.</>
              : sync.unsaved || sync.sending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</>
                : answeredCount > 0 && <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />All answers saved</>}
          </p>
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
