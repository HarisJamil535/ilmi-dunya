import { useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, Atom, FlaskConical, Dna, Laptop, BookOpen, PenLine, Map, Moon, Globe, ArrowRight } from "lucide-react";
const icons = { english: BookOpen, urdu: PenLine, mathematics: Calculator, math: Calculator, physics: Atom, chemistry: FlaskConical, biology: Dna, "computer science": Laptop, "pakistan studies": Map, "islamic studies": Moon, pst: Map };
export default function SubjectCard({ subj = "English", image = "", onClick, to }) {
  const [failedImage, setFailedImage] = useState(null);
  const subjectName = typeof subj === "string" ? subj.trim() : subj.name;
  const Icon = icons[subjectName.toLowerCase()] || Globe;
  const Element = to ? Link : "button";
  return <Element to={to} type={to ? undefined : "button"} onClick={onClick} className="study-subject-card">
    <div className="study-subject-image">
      {image && failedImage !== image ? <img src={image} alt="" width="80" height="80" loading="lazy" decoding="async" onError={() => setFailedImage(image)} /> : <Icon size={64} strokeWidth={1.4} aria-hidden="true" />}
    </div>
    <h2>{subjectName}</h2>
    <p>Chapters, lectures, notes and papers organized for this subject.</p>
    <span className="study-subject-action">Explore subject <ArrowRight size={21} aria-hidden="true" /></span>
  </Element>;
}
