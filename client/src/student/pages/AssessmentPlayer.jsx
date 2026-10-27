import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../urdu-font.css";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CloudOff, Flag, Keyboard, ListChecks, Loader2, Send, SkipForward, Trophy, Volume2, VolumeX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import ConfirmModal from "../../shared/ConfirmModal";
import MathText from "../../shared/MathText";
import "./learning-experience.css";
import "./test-introduction.css";
import "./test-player.css";

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
  // The ticking clock is on by default; a student who mutes it keeps that choice on this device.
  const [soundEnabled, setSoundEnabled] = useState(() => { try { return localStorage.getItem("ilmi-test-sound") !== "off"; } catch { return true; } });
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

  const toggleSound = () => {
    setSoundEnabled((value) => {
      const next = !value;
      try { localStorage.setItem("ilmi-test-sound", next ? "on" : "off"); } catch { /* storage blocked */ }
      return next;
    });
  };

  // A soft tick-tock every second, like a wall clock; the last 10 seconds switch to a clear, brighter beep.
  useEffect(() => {
    const context = audioContext.current;
    if (!soundEnabled || remaining <= 0 || submitting || context?.state !== "running") return;
    const now = context.currentTime;
    const urgent = remaining <= 10;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = urgent ? "sine" : "triangle";
    const pitch = urgent ? 988 : remaining % 2 ? 1560 : 1180;
    oscillator.frequency.setValueAtTime(pitch, now);
    if (!urgent) oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.55, now + 0.035);
    filter.type = "highpass";
    filter.frequency.value = urgent ? 300 : 700;
    const peak = urgent ? 0.11 : remaining <= 30 ? 0.075 : 0.05;
    const length = urgent ? 0.14 : 0.06;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + length + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
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

  // The Start button sits at the foot of a long page; the test opens at its first question.
  const attemptId = attempt?._id;
  useEffect(() => { if (attemptId) window.scrollTo({ top: 0 }); }, [attemptId]);

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
  // Mirrors the server (services/testTiming.js): the time for the number of MCQs chosen.
  const timing = preview?.timing;
  const timeFor = (count) => {
    if (!timing || !count) return 0;
    const seconds = timing.mode === "per_question" ? count * timing.secondsPerQuestion : count >= preview.availableQuestions ? timing.minutes * 60 : Math.ceil(timing.minutes * 60 * count / Math.max(preview.availableQuestions, 1));
    return Math.max(30, seconds);
  };
  const minutesLabel = (seconds) => (seconds % 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : String(seconds / 60));
  const timingNote = !timing ? "" : timing.mode === "per_question"
    ? (timing.secondsPerQuestion % 60 === 0 ? `${timing.secondsPerQuestion / 60 === 1 ? "One minute" : `${timing.secondsPerQuestion / 60} minutes`} per MCQ.` : `${timing.secondsPerQuestion} seconds per MCQ.`)
    : `${timing.minutes} minutes for all ${preview.availableQuestions} MCQs; a shorter set gets a matching share.`;
  // Mirrors the server: a shorter chosen set counts for ranking from 10 questions.
  const ranked = preview?.ranked && (!partial || chosenCount >= 10);

  const answerCount = answers.length;
  // Keyboard: A-D or 1-4 choose an option, the arrow keys move between questions.
  const keyHandler = useRef(null);
  keyHandler.current = (event) => {
    if (!attempt || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.("input, textarea, select, [role=dialog]")) return;
    const key = event.key.toLowerCase();
    if (key === "arrowright" && currentIndex < answerCount - 1) setCurrentIndex(currentIndex + 1);
    else if (key === "arrowleft" && currentIndex > 0) setCurrentIndex(currentIndex - 1);
    else {
      const options = question?.options || [];
      const index = /^[1-9]$/.test(key) ? Number(key) - 1 : /^[a-h]$/.test(key) ? key.charCodeAt(0) - 97 : -1;
      if (options[index]) saveAnswer({ selectedOption: options[index].key, skipped: false });
      else return;
    }
    event.preventDefault();
  };
  useEffect(() => {
    if (!attempt) return undefined;
    const onKey = (event) => keyHandler.current?.(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attempt]);

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
            <div><Clock3 size={20} aria-hidden="true" /><dt>Minutes</dt><dd>{preview?.canChooseCount ? (countValid ? minutesLabel(timeFor(chosenCount)) : "—") : preview?.durationMinutes}</dd></div>
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
            <p id="test-count-help">{timingNote}{countMode === "custom" ? ` Choose 5–${preview.availableQuestions}. A fresh random set is selected for each attempt.` : preview.availableQuestions < 5 ? " This topic has fewer than five MCQs, so all are included." : " All questions are selected by default."}</p>
            {!countValid && <p role="alert">Enter a whole number between 5 and {preview.availableQuestions}.</p>}
          </fieldset>}
          <h2>Test rules</h2>
          <ol className="test-introduction-rules">
            <li><span aria-hidden="true">1</span><div><h3>{preview?.resume ? "Your timer is already running" : "Start when you are ready"}</h3><p>{preview?.resume ? "Your earlier attempt is still in progress." : "The timer starts when you select Start test."} Your answers save as you go.</p></div></li>
            <li><span aria-hidden="true">2</span><div><h3>Answer at your own pace</h3><p>You can skip questions and return to them before submitting.</p></div></li>
            <li className="test-introduction-exit-rule"><span aria-hidden="true">3</span><div><h3>Stay on the test page</h3><p>Leaving or switching away submits your saved answers automatically.</p></div></li>
            {preview?.resultsWithheld
              ? <li><span aria-hidden="true">4</span><div><h3>Results are released later</h3><p>Your score and answers will appear once your teacher releases the results. Released results count on the leaderboard.</p></div></li>
              : <li><span aria-hidden="true">4</span><div><h3>{ranked ? "Your first attempt counts most" : "Practise without ranking"}</h3><p>{ranked ? "For the leaderboard, your first attempt counts 60% and your best retake 40%. Retakes count 12 hours apart, up to 3 times. Answering too quickly scores 0, and a test left without submitting is marked when its time runs out." : "Sets of fewer than 10 questions are practice and do not affect the leaderboard. Choose 10 or more questions to compete."}</p></div></li>}
            {(preview?.closesAt || preview?.maxAttempts > 0) && !preview?.resume && <li><span aria-hidden="true">5</span><div><h3>Test limits</h3><p>{[
              preview.closesAt && `This test closes on ${new Date(preview.closesAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}; an attempt in progress ends then.`,
              preview.maxAttempts > 0 && `You can attempt it ${preview.maxAttempts === 1 ? "once" : `${preview.maxAttempts} times`}.`,
            ].filter(Boolean).join(" ")}</p></div></li>}
          </ol>
          {preview?.instructions?.length > 0 && <aside className="test-introduction-extra"><h2>Teacher instructions</h2><ul>{preview.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ul></aside>}
        </div>
        <footer className="test-introduction-actions">
          <Link to="/tests" className="test-introduction-back"><ArrowLeft size={18} aria-hidden="true" /> Back to tests</Link>
          <button type="button" disabled={!countValid} onClick={() => { enableAudio(); setConfirmed(true); setLoading(true); }} className="test-introduction-start">{preview?.resume ? "Continue test" : "Start test"}<ArrowRight size={18} aria-hidden="true" /></button>
        </footer>
      </section>
    </main>
  );

  const totalSeconds = Math.max(1, Math.round((new Date(attempt.expiresAt) - new Date(attempt.startedAt)) / 1000));
  const timeShare = Math.min(1, remaining / totalSeconds);
  const timeTone = remaining <= 30 ? "danger" : timeShare <= 0.25 ? "warn" : "ok";
  const flaggedCount = answers.filter((answer) => answer.flaggedForReview).length;
  const isUrdu = question?.contentLanguage === "ur";
  const lastQuestion = currentIndex === answers.length - 1;

  return (
    <main className="test-player" onPointerDown={enableAudio} onKeyDown={enableAudio}>
      <header className="test-player-bar">
        <div className="test-player-bar-inner">
          <div className="test-player-title">
            <span className="test-player-badge"><ListChecks size={20} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p>MCQ Test · {answers.length} questions</p>
              <h1 title={attempt.assessment.title}>{attempt.assessment.title}</h1>
            </div>
          </div>
          <div className="test-player-controls">
            <div className={`test-clock is-${timeTone}`} role="timer" aria-label={`Time remaining ${formatTime(remaining)}`}>
              <span className="test-clock-ring" aria-hidden="true">
                <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" className="track" /><circle cx="22" cy="22" r="19" className="value" style={{ strokeDashoffset: `${119.4 * (1 - timeShare)}` }} /></svg>
                <Clock3 size={17} className="test-clock-icon" />
              </span>
              <div><small>{remaining <= 30 ? "Hurry up" : "Time left"}</small><strong>{formatTime(remaining)}</strong></div>
            </div>
            <button type="button" className={`test-sound ${soundEnabled ? "is-on" : ""}`} title={soundEnabled ? "Turn the clock sound off" : "Turn the clock sound on"} aria-label={soundEnabled ? "Turn the clock sound off" : "Turn the clock sound on"} aria-pressed={soundEnabled} onClick={toggleSound}>
              {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <button type="button" disabled={submitting} onClick={() => setShowSubmitConfirm(true)} className="test-submit">
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}<span>{submitting ? "Submitting" : "Submit"}</span>
            </button>
          </div>
        </div>
        <div className="test-player-progress" aria-hidden="true"><div style={{ width: `${progress}%` }} /></div>
      </header>

      <section className="test-player-body">
        <div className="test-question-card">
          {actionError && <p role="alert" className="learning-alert">{actionError}</p>}
          <p role="note" className="test-leave-note"><AlertTriangle size={16} aria-hidden="true" />Stay on this page. Leaving or switching away submits your saved answers automatically.</p>
          {remaining <= 30 && <p role="status" className="test-urgent-note">{remaining === 0 ? "Time is up. Submitting your saved answers." : "30 seconds or less left. Check any unanswered questions."}</p>}

          <div key={currentIndex} className="test-question-enter">
            <div className="test-question-meta">
              <span className="test-question-number">Question <strong>{currentIndex + 1}</strong> of {answers.length}</span>
              {current?.flaggedForReview && <span className="test-chip is-flag"><Flag size={13} aria-hidden="true" />Flagged for review</span>}
              {selectedOption && <span className="test-chip is-done"><Check size={13} aria-hidden="true" />Answered</span>}
            </div>

            {scenario && (
              <div dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`test-scenario ${isUrdu ? "urdu-content" : ""}`}>
                <p className="test-scenario-lead">Read this scenario and answer {scenarioIndices.length === 1 ? "the following question" : `the following ${scenarioIndices.length} questions`}.</p>
                <h2>{scenario.title}</h2>
                <p className="test-scenario-text"><MathText text={scenario.scenarioText} /></p>
                <p className="test-scenario-count">Scenario question {scenarioPosition} of {scenarioIndices.length}</p>
              </div>
            )}

            <h2 dir={isUrdu ? "rtl" : "ltr"} lang={isUrdu ? "ur" : "en"} className={`test-question-text ${isUrdu ? "urdu-content is-urdu" : ""}`}><MathText text={question?.questionText} /></h2>
            {question?.imageUrls?.[0] && <img src={question.imageUrls[0]} alt={question.imageAlt || "Question diagram"} className="test-question-image" loading="lazy" />}

            <div className="test-options" role="group" aria-label="Answer options">
              {question?.options?.map((option, index) => {
                const active = selectedOption === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={submitting || remaining <= 0}
                    aria-pressed={active}
                    onClick={() => saveAnswer({ selectedOption: option.key, skipped: false })}
                    dir={isUrdu ? "rtl" : "ltr"}
                    lang={isUrdu ? "ur" : "en"}
                    style={{ animationDelay: `${index * 45}ms` }}
                    className={`test-option ${active ? "is-active" : ""} ${isUrdu ? "urdu-content is-urdu" : ""}`}
                  >
                    <span className="test-option-key">{option.label || option.key}</span>
                    <span className="test-option-text"><MathText text={option.text} /></span>
                    <span className="test-option-check" aria-hidden="true"><Check size={15} strokeWidth={3} /></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="test-actions">
            <div className="test-actions-group">
              <button type="button" onClick={() => saveAnswer({ skipped: true, selectedOption: "" })} className="test-ghost"><SkipForward size={16} /> Skip</button>
              <button type="button" onClick={() => saveAnswer({ flaggedForReview: !current.flaggedForReview })} className={`test-ghost is-flag ${current?.flaggedForReview ? "is-on" : ""}`}><Flag size={16} /> {current?.flaggedForReview ? "Unflag" : "Flag"}</button>
            </div>
            <div className="test-actions-group">
              <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => value - 1)} className="test-ghost"><ChevronLeft size={17} /> Previous</button>
              {lastQuestion
                ? <button type="button" onClick={() => setShowSubmitConfirm(true)} disabled={submitting} className="test-next is-finish">Review &amp; submit <Send size={16} /></button>
                : <button type="button" onClick={() => setCurrentIndex((value) => value + 1)} className="test-next">Next <ChevronRight size={17} /></button>}
            </div>
          </div>
          <div className="test-footnote">
            <p role="status" aria-live="polite" className={`test-sync ${sync.offline ? "is-offline" : ""}`}>
              {sync.offline
                ? <><CloudOff size={14} />Connection lost. Keep answering: {sync.unsaved} {sync.unsaved === 1 ? "answer is" : "answers are"} kept on this device and will be sent automatically.</>
                : sync.unsaved || sync.sending
                  ? <><Loader2 size={14} className="animate-spin" />Saving...</>
                  : answeredCount > 0 && <><CheckCircle2 size={14} className="text-emerald-600" />All answers saved</>}
            </p>
            <p className="test-keys"><Keyboard size={14} aria-hidden="true" />Press A–D to answer, ← → to move</p>
          </div>
        </div>

        <aside className="test-navigator" aria-label="Question navigator">
          <div className="test-navigator-head">
            <div className="test-ring" style={{ "--value": `${progress * 3.6}deg` }}><strong>{progress}%</strong></div>
            <div>
              <h2>Your progress</h2>
              <p>{answeredCount} of {answers.length} answered</p>
            </div>
          </div>
          <dl className="test-counts">
            <div className="is-done"><dt>Answered</dt><dd>{answeredCount}</dd></div>
            <div className="is-flag"><dt>Flagged</dt><dd>{flaggedCount}</dd></div>
            <div className="is-left"><dt>Left</dt><dd>{unanswered}</dd></div>
          </dl>
          <div className="test-bubbles">
            {answers.map((answer, index) => {
              const state = index === currentIndex ? "is-current" : answer.flaggedForReview ? "is-flag" : answer.selectedOption ? "is-done" : answer.skipped ? "is-skipped" : "";
              return <button key={answer.question._id} type="button" onClick={() => setCurrentIndex(index)} aria-label={`Question ${index + 1}${answer.selectedOption ? ", answered" : ""}${answer.flaggedForReview ? ", flagged" : ""}`} aria-current={index === currentIndex ? "step" : undefined} className={`test-bubble ${state}`}>{index + 1}</button>;
            })}
          </div>
          <ul className="test-legend">
            <li><i className="is-done" />Answered</li><li><i className="is-flag" />Flagged</li><li><i className="is-skipped" />Skipped</li><li><i />Not visited</li>
          </ul>
          <button type="button" onClick={() => setShowSubmitConfirm(true)} disabled={submitting} className="test-submit is-wide"><Send size={17} /> Submit test</button>
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
