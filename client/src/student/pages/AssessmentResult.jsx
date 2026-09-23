import { useEffect, useState } from "react";
import { Award, ArrowLeft, ArrowRight, CheckCircle2, Clock3, Loader2, Target, Trophy, CircleCheckBig, CircleX, CircleDashed } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import axiosInstance from "../../api/axios";
import { formatDuration, formatScore } from "../utils/resultFormat";
import "./learning-experience.css";
import Breadcrumbs from "../components/Breadcrumbs";

const AssessmentResult = () => {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="sr-only">Loading result</span></div>;
  if (error || !attempt) return <main className="learning-page"><div className="learning-wrap"><p className="learning-alert" role="alert">{error || "Result unavailable."}</p><button className="learning-button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div></main>;

  const answers = attempt.answers || [];
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const unanswered = answers.filter((answer) => !answer.selectedOption).length;
  const wrong = answers.length - correct - unanswered;
  const category = (answer) => !answer.selectedOption ? "unanswered" : answer.isCorrect ? "correct" : "wrong";
  const visible = answers.map((answer, index) => ({ answer, index })).filter(({ answer }) => filter === "all" || category(answer) === filter);
  const percent = Math.min(100, Math.max(0, attempt.percentage || 0));
  const encouragement = percent >= 90
    ? ["Excellent work!", "Your practice is paying off. Keep the momentum going with another topic."]
    : percent >= 70 ? ["You're making strong progress!", "Review the questions you missed to make your next attempt even stronger."]
    : percent >= 40 ? ["Keep building, one question at a time.", "You have a foundation to build on. Start with the explanations below, then practise again."]
    : ["Every attempt is a step forward.", "This result shows where to focus next. Take your time with the explanations and try a few questions again."];
  return (
    <main className="learning-page result-page">
      <div className="learning-wrap learning-enter">
        <Breadcrumbs className="result-breadcrumbs" items={[
          { label: "Tests", to: "/tests" },
          { label: "Result" },
        ]} />
        <Link to="/dashboard" className="result-back"><ArrowLeft size={15} /> Back to dashboard</Link>
        <header className="result-hero">
          <div className="result-copy">
            <div className="learning-eyebrow"><Award size={17} /> Test complete</div>
            <h1>{encouragement[0]}</h1>
            <p className="result-test-title">{attempt.assessment?.title || "MCQ test"}</p>
            <p className="result-encouragement">{encouragement[1]}</p>
            <div className="learning-actions">
              <Link className="learning-button" to="/tests">Take another test <ArrowRight size={16} /></Link>
              <Link className="learning-button secondary" to="/leaderboard"><Trophy size={16} /> View leaderboard</Link>
            </div>
          </div>
          <div className="result-score-panel">
            <div className="learning-score-ring" style={{ "--score": percent + "%" }} aria-label={percent.toFixed(2) + " percent"}>
              <div><strong>{percent.toFixed(2)}%</strong><span>{attempt.passStatus === "pass" ? "Passed" : "Practice mode"}</span></div>
            </div>
            <span className={`result-status ${attempt.passStatus === "pass" ? "passed" : "needs-work"}`}>{attempt.passStatus === "pass" ? "Passed" : "Keep learning"}</span>
          </div>
        </header>
        <section className="result-overview" aria-label="Result summary">
          <div className="result-stat"><span className="result-stat-icon score"><Target /></span><div><span>Marks</span><strong>{formatScore(attempt.score)}<small> / {formatScore(attempt.totalMarks)}</small></strong></div></div>
          <div className="result-stat"><span className="result-stat-icon points"><Trophy /></span><div><span>Points earned</span><strong>{formatScore(attempt.points ?? attempt.score * 100)}</strong></div></div>
          <div className="result-stat"><span className="result-stat-icon time"><Clock3 /></span><div><span>Time taken</span><strong>{formatDuration(attempt.timeTakenSeconds)}</strong></div></div>
          <div className="result-stat"><span className="result-stat-icon correct"><CheckCircle2 /></span><div><span>Correct</span><strong>{correct}<small> / {answers.length}</small></strong></div></div>
        </section>
        <section className="result-breakdown" aria-label="Answer breakdown">
          <div><CircleCheckBig /><strong>{correct}</strong><span>Correct</span></div>
          <div><CircleX /><strong>{wrong}</strong><span>Incorrect</span></div>
          <div><CircleDashed /><strong>{unanswered}</strong><span>Unanswered</span></div>
          <p>{answers.length > 0 && `${formatDuration(attempt.timeTakenSeconds / answers.length)} average per question`}{attempt.status === "timed_out" && " · Submitted automatically when time ran out"}</p>
        </section>
        <div className="learning-review-heading">
          <div><span className="learning-eyebrow">Review</span><h2>Learn from your answers</h2></div>
          <div className="learning-tabs" aria-label="Filter answer review">
            {[["all", "All", answers.length], ["correct", "Correct", correct], ["wrong", "Incorrect", wrong], ["unanswered", "Unanswered", unanswered]].map(([value, label, count]) => (
              <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} ({count})</button>
            ))}
          </div>
        </div>
        {!visible.length && <p className="py-8 text-center learning-muted">No questions in this category.</p>}
        {visible.map(({ answer, index }) => (
          <article key={answer.question?._id || index} className={"learning-question " + category(answer)}>
            <div className="learning-question-meta"><span>QUESTION {index + 1} · {category(answer) === "wrong" ? "Incorrect" : category(answer) === "unanswered" ? "Unanswered" : "Correct"}</span><span>{formatScore(answer.marksAwarded)} marks earned</span></div>
            {answer.question?.scenario && <div className="learning-scenario"><strong>{answer.question.scenario.title}</strong><p>{answer.question.scenario.scenarioText}</p></div>}
            <h3>{answer.question?.questionText || "This question is no longer available."}</h3>
            <div className="learning-options">
              {(answer.question?.options || []).map((option) => {
                const isCorrect = option.key === answer.question.correctOption;
                const selected = option.key === answer.selectedOption;
                return <div key={option.key} className={"learning-option " + (isCorrect ? "correct" : selected && !answer.isCorrect ? "wrong" : "")}>
                  <strong>{option.key}.</strong> {option.text}
                  {(isCorrect || selected) && <small>{isCorrect ? "Correct answer" : "Your answer"}{isCorrect && selected ? " · Your answer" : ""}</small>}
                </div>;
              })}
            </div>
            {answer.question?.explanation && <p className="learning-explanation"><strong>Why this answer? </strong>{answer.question.explanation}</p>}
          </article>
        ))}
        <Link className="learning-button secondary" to="/dashboard">View my learning progress <ArrowRight size={16} /></Link>
      </div>
    </main>
  );
};

export default AssessmentResult;
