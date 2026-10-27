import { usePageLoading } from "../../shared/pageLoading";
import Spinner from "../../shared/Spinner";
import { useEffect, useState } from "react";
import "../../urdu-font.css";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, CircleDashed, Clock3, Crosshair, Gauge, Lightbulb, ListChecks, PartyPopper, RotateCcw, Sparkles, Target, Timer, Trophy, X, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import { formatDuration, formatScore } from "../utils/resultFormat";
import Breadcrumbs from "../components/Breadcrumbs";
import MathText from "../../shared/MathText";
import "./test-result.css";

// The board grading scale used on IlmiDunya report cards.
const GRADES = [["A+", 80], ["A", 70], ["B", 60], ["C", 50], ["D", 40], ["E", 33], ["F", 0]];
const gradeOf = (percent) => (GRADES.find(([, min]) => percent >= min) || GRADES[GRADES.length - 1])[0];

// Several messages per score band; the attempt id picks one, so a result always reads the same.
const MESSAGES = {
  top: { tone: "top", icon: PartyPopper, title: ["Outstanding! You nailed it.", "Brilliant work, superstar!", "Top marks! You are on fire."], body: ["Your hard work shows. Keep this streak alive with a new topic today.", "This is what steady practice looks like. Challenge yourself with the next chapter.", "You clearly know this topic well. Try a full chapter test to stretch further."] },
  good: { tone: "good", icon: Sparkles, title: ["Great job! You are almost there.", "Strong result, well done!", "Very good! Keep climbing."], body: ["Check the few you missed below and you will be at the top next time.", "A quick look at the explanations will turn these mistakes into marks.", "You are close to excellent. One more practice round can do it."] },
  steady: { tone: "steady", icon: Target, title: ["Good effort! You are building up.", "Nice work, keep going!", "You are on the right track."], body: ["Every mistake below is a lesson. Read the explanations and try again.", "Focus on the questions you missed. Your next score will thank you.", "Progress is progress. Review, practise, and watch your score rise."] },
  start: { tone: "start", icon: BookOpenCheck, title: ["Every expert started here.", "Do not give up. You are learning!", "This is how learning begins."], body: ["Read each explanation below carefully, then take the test again. You will improve.", "Mistakes show you exactly what to study next. Go through them one by one.", "Revise this topic's notes, then come back. Your next attempt will be better."] },
};
const bandFor = (percent) => (percent >= 85 ? MESSAGES.top : percent >= 65 ? MESSAGES.good : percent >= 40 ? MESSAGES.steady : MESSAGES.start);
const pick = (list, seed) => list[[...String(seed)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % list.length];

const retakeLink = (assessment) => {
  if (!assessment) return "/tests";
  if (assessment.type === "topic_test" && assessment.topic) return `/tests/start?topic=${assessment.topic}`;
  if (assessment.type === "chapter_test" && assessment.chapter) return `/tests/start?chapter=${assessment.chapter}`;
  return assessment._id ? `/tests/${assessment._id}/take` : "/tests";
};

const ScoreRing = ({ percent, grade }) => (
  <div className="rs-ring" role="img" aria-label={`${percent.toFixed(1)} percent, grade ${grade}`}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="rs-ring-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd25e" /><stop offset="1" stopColor="#22d3a6" /></linearGradient></defs>
      <circle cx="60" cy="60" r="52" className="rs-ring-track" />
      <circle cx="60" cy="60" r="52" className="rs-ring-value" style={{ "--offset": 326.7 * (1 - percent / 100) }} />
    </svg>
    <div><strong>{Math.round(percent)}<small>%</small></strong><span>Grade {grade}</span></div>
  </div>
);

const AssessmentResult = () => {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  usePageLoading(loading);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axiosInstance.get("/attempts/" + attemptId + "/result", { signal: controller.signal });
        setAttempt(response.data.attempt);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.message || "Your result could not be loaded. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [attemptId, retry]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>;
  if (error || !attempt) return <main className="rs-page"><div className="rs-wrap"><p className="rs-alert" role="alert">{error || "Result unavailable."}</p><button type="button" className="rs-button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={16} /> Try again</button></div></main>;

  const title = attempt.assessment?.title || "MCQ test";
  const answers = attempt.answers || [];
  const answered = answers.filter((answer) => answer.selectedOption).length;

  if (attempt.resultsWithheld) return (
    <main className="rs-page">
      <div className="rs-wrap">
        <Breadcrumbs className="rs-crumbs" items={[{ label: "Tests", to: "/tests" }, { label: "Result" }]} />
        <header className="rs-hero tone-good">
          <div className="rs-hero-copy">
            <span className="rs-eyebrow"><CheckCircle2 size={15} /> Test submitted</span>
            <h1>Well done for finishing!</h1>
            <p className="rs-test-title">{title}</p>
            <p className="rs-lead">Your answers are saved safely. Your score will appear here as soon as your teacher releases the results, and released results count on the leaderboard.</p>
            <div className="rs-actions">
              <Link className="rs-button is-light" to="/tests">Take another test <ArrowRight size={16} /></Link>
              <Link className="rs-button is-ghost" to="/dashboard">Back to dashboard</Link>
            </div>
          </div>
        </header>
        <section className="rs-stats" aria-label="Submission summary">
          <div className="rs-stat"><span className="rs-stat-icon is-green"><ListChecks /></span><div><small>Answered</small><strong>{answered}<em> / {answers.length}</em></strong></div></div>
          <div className="rs-stat"><span className="rs-stat-icon is-blue"><Clock3 /></span><div><small>Time taken</small><strong>{formatDuration(attempt.timeTakenSeconds)}</strong></div></div>
        </section>
      </div>
    </main>
  );

  const correct = answers.filter((answer) => answer.isCorrect).length;
  const unanswered = answers.length - answered;
  const wrong = answered - correct;
  const category = (answer) => !answer.selectedOption ? "unanswered" : answer.isCorrect ? "correct" : "wrong";
  const visible = answers.map((answer, index) => ({ answer, index })).filter(({ answer }) => filter === "all" || category(answer) === filter);
  const percent = Math.min(100, Math.max(0, attempt.percentage || 0));
  const grade = gradeOf(percent);
  const band = bandFor(percent);
  const BandIcon = band.icon;
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  const perQuestion = answers.length ? attempt.timeTakenSeconds / answers.length : 0;
  const share = (count) => `${answers.length ? count / answers.length * 100 : 0}%`;
  const passed = attempt.passStatus === "pass";
  const nextStep = wrong + unanswered === 0
    ? "A perfect paper! Try a complete chapter test or a new topic to keep growing."
    : `Your next ${wrong + unanswered === 1 ? "mark is" : `${wrong + unanswered} marks are`} hiding in the ${wrong + unanswered === 1 ? "question" : "questions"} below. Read ${wrong + unanswered === 1 ? "its explanation" : "their explanations"}, then try again.`;

  return (
    <main className="rs-page">
      <div className="rs-wrap">
        <Breadcrumbs className="rs-crumbs" items={[{ label: "Tests", to: "/tests" }, { label: "Result" }]} />
        <Link to="/dashboard" className="rs-back"><ArrowLeft size={15} /> Back to dashboard</Link>

        <header className={`rs-hero tone-${band.tone}`}>
          {band.tone === "top" && <div className="rs-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>}
          <div className="rs-hero-copy">
            <span className="rs-eyebrow"><BandIcon size={15} /> Test complete</span>
            <h1>{pick(band.title, attempt._id)}</h1>
            <p className="rs-test-title">{title}</p>
            <p className="rs-lead">{pick(band.body, `${attempt._id}b`)}</p>
            <div className="rs-actions">
              <Link className="rs-button is-light" to={retakeLink(attempt.assessment)}><RotateCcw size={16} /> Try again</Link>
              <Link className="rs-button is-ghost" to="/tests">Next test <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="rs-hero-score">
            <ScoreRing percent={percent} grade={grade} />
            <span className={`rs-pass ${passed ? "is-pass" : "is-fail"}`}>{passed ? <><Check size={14} strokeWidth={3} /> Passed</> : <><Target size={14} /> Keep practising</>}</span>
          </div>
        </header>

        <section className="rs-stats" aria-label="Result summary">
          <div className="rs-stat"><span className="rs-stat-icon is-purple"><Target /></span><div><small>Marks</small><strong>{formatScore(attempt.score)}<em> / {formatScore(attempt.totalMarks)}</em></strong></div></div>
          <div className="rs-stat"><span className="rs-stat-icon is-green"><Crosshair /></span><div><small>Accuracy</small><strong>{accuracy}<em>%</em></strong></div></div>
          <div className="rs-stat"><span className="rs-stat-icon is-blue"><Timer /></span><div><small>Time taken</small><strong>{formatDuration(attempt.timeTakenSeconds)}</strong><span className="rs-stat-note">{formatDuration(perQuestion)} per question</span></div></div>
          <div className="rs-stat"><span className="rs-stat-icon is-gold"><Trophy /></span><div><small>Ranking score</small><strong>{formatScore(attempt.points || 0)}</strong></div></div>
        </section>

        <section className="rs-breakdown" aria-label="Answer breakdown">
          <div className="rs-breakdown-bar" aria-hidden="true">
            <i className="is-correct" style={{ width: share(correct) }} /><i className="is-wrong" style={{ width: share(wrong) }} /><i className="is-skip" style={{ width: share(unanswered) }} />
          </div>
          <ul>
            <li className="is-correct"><CheckCircle2 size={17} /><strong>{correct}</strong> Correct</li>
            <li className="is-wrong"><XCircle size={17} /><strong>{wrong}</strong> Incorrect</li>
            <li className="is-skip"><CircleDashed size={17} /><strong>{unanswered}</strong> Unanswered</li>
          </ul>
          {attempt.status === "timed_out" && <p className="rs-breakdown-note"><Clock3 size={14} /> Submitted automatically when time ran out.</p>}
        </section>

        <div className="rs-notes">
          <p className="rs-note is-next"><Lightbulb size={18} /><span><strong>Your next step</strong>{nextStep}</span></p>
          <p className="rs-note is-rank" role="status"><Gauge size={18} /><span><strong>Leaderboard</strong>{attempt.ranking?.reason || (attempt.ranking?.eligible ? "This attempt counts toward your leaderboard position." : "This test is for practice and does not count for ranking.")}</span></p>
        </div>

        <section className="rs-review" aria-labelledby="rs-review-title">
          <div className="rs-review-head">
            <div><span className="rs-kicker">Review</span><h2 id="rs-review-title">Learn from every answer</h2></div>
            <div className="rs-filters" role="group" aria-label="Filter answers">
              {[["all", "All", answers.length], ["wrong", "Incorrect", wrong], ["unanswered", "Unanswered", unanswered], ["correct", "Correct", correct]].map(([value, label, count]) => (
                <button key={value} type="button" aria-pressed={filter === value} className={`is-${value}`} onClick={() => setFilter(value)}>{label}<span>{count}</span></button>
              ))}
            </div>
          </div>

          {!visible.length && <p className="rs-empty">{filter === "wrong" ? "No incorrect answers. Brilliant!" : filter === "unanswered" ? "You answered every question. Well done!" : "No questions in this group."}</p>}
          {visible.map(({ answer, index }) => {
            const question = answer.question;
            const state = category(answer);
            const urdu = question?.contentLanguage === "ur";
            const correctOption = question?.options?.find((option) => option.key === question.correctOption);
            return (
              <article key={question?._id || index} dir={urdu ? "rtl" : "ltr"} lang={urdu ? "ur" : "en"} className={`rs-question is-${state} ${urdu ? "urdu-content is-urdu" : ""}`}>
                <div className="rs-question-head">
                  <span className="rs-qnum">Q{index + 1}</span>
                  <span className={`rs-chip is-${state}`}>{state === "correct" ? <><Check size={13} strokeWidth={3} /> Correct</> : state === "wrong" ? <><X size={13} strokeWidth={3} /> Incorrect</> : <><CircleDashed size={13} /> Not answered</>}</span>
                  <span className="rs-marks">+{formatScore(answer.marksAwarded)} {Number(answer.marksAwarded) === 1 ? "mark" : "marks"}</span>
                </div>
                {question?.scenario && <div className="rs-scenario"><strong>{question.scenario.title}</strong><p><MathText text={question.scenario.scenarioText} /></p></div>}
                <h3><MathText text={question?.questionText || "This question is no longer available."} /></h3>
                {question?.imageUrls?.[0] && <img src={question.imageUrls[0]} alt={question.imageAlt || "Question diagram"} className="rs-question-image" loading="lazy" />}
                <div className="rs-options">
                  {(question?.options || []).map((option) => {
                    const isCorrect = option.key === question.correctOption;
                    const selected = option.key === answer.selectedOption;
                    const tone = isCorrect ? "is-correct" : selected ? "is-wrong" : "";
                    return <div key={option.key} className={`rs-option ${tone}`}>
                      <span className="rs-option-key">{isCorrect ? <Check size={15} strokeWidth={3} /> : selected ? <X size={15} strokeWidth={3} /> : option.label || option.key}</span>
                      <span className="rs-option-text"><MathText text={option.text} /></span>
                      {(isCorrect || selected) && <span className="rs-option-tag">{isCorrect && selected ? "Your answer · Correct" : isCorrect ? "Correct answer" : "Your answer"}</span>}
                    </div>;
                  })}
                </div>
                {question?.explanation
                  ? <div className="rs-explain"><span className="rs-explain-icon"><Lightbulb size={20} /></span><div><strong>Explanation</strong><p><MathText text={question.explanation} /></p></div></div>
                  : correctOption && state !== "correct" && <div className="rs-explain is-plain"><span className="rs-explain-icon"><Lightbulb size={20} /></span><div><strong>Correct answer</strong><p>{correctOption.label || correctOption.key}. <MathText text={correctOption.text} /></p></div></div>}
              </article>
            );
          })}
        </section>

        <section className="rs-cta">
          <div><h2>Ready for your next challenge?</h2><p>Small, steady practice every day is how toppers are made.</p></div>
          <div className="rs-actions">
            <Link className="rs-button is-light" to={retakeLink(attempt.assessment)}><RotateCcw size={16} /> Try again</Link>
            <Link className="rs-button is-ghost" to="/leaderboard"><Trophy size={16} /> Leaderboard</Link>
            <Link className="rs-button is-ghost" to="/dashboard">My progress <ArrowRight size={16} /></Link>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AssessmentResult;
