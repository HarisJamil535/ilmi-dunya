import { useSearchParams, Link } from "react-router-dom";
import AssessmentPlayer from "./AssessmentPlayer";

export default function TestStart() {
  const [params] = useSearchParams();
  const chapter = params.get("chapter") || undefined;
  const topic = params.get("topic") || undefined;
  if (!chapter && !topic) return <main className="p-8 text-center"><h1>Select a chapter or topic first</h1><Link to="/subjects">Browse subjects</Link></main>;
  return <AssessmentPlayer key={topic || chapter} chapter={chapter} topic={topic} />;
}
