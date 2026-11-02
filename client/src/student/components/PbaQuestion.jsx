import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import axiosInstance from "../../api/axios";
import Spinner from "../../shared/Spinner";
import { Blocks } from "../../shared/PbaContent";

const letter = (i) => String.fromCharCode(97 + i);

// The full question of a practical: statement, parts with marks, and (when the admin allows it) the model answers.
export default function PbaQuestion({ subjectId, id, heading = true }) {
  const [state, setState] = useState("loading");
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    axiosInstance.get(`/pba/${subjectId}/practicals/${id}`, { signal: controller.signal })
      .then(({ data }) => { setQuestion(data.practical); setState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [subjectId, id]);

  if (state === "loading") return <div className="pba-q-state"><Spinner /></div>;
  if (state === "error" || !question) return <p className="pba-q-state" role="alert">The question could not be loaded.</p>;
  return <div className="pba-q">
    {heading && <div className="pba-q-head"><h3>Question</h3>{question.marks > 0 && <span className="pba-q-marks">{question.marks} marks</span>}</div>}
    <Blocks blocks={question.blocks} reveal={answers} />
    {question.parts.map((part, i) => <div key={i} className="pba-q-part">
      <div className="pba-q-label"><b>{letter(i)}.</b></div>
      <div className="pba-q-body"><Blocks blocks={part.blocks} reveal={answers} />{answers && part.answer?.length > 0 && <div className="pba-q-answer"><span>Model answer</span><Blocks blocks={part.answer} reveal /></div>}</div>
      <div className="pba-q-pm">({part.marks})</div>
    </div>)}
    {question.answerVisible && <button type="button" className="pba-q-toggle" aria-pressed={answers} onClick={() => setAnswers(!answers)}>{answers ? <><EyeOff size={15} />Hide model answer</> : <><Eye size={15} />Show model answer</>}</button>}
  </div>;
}
