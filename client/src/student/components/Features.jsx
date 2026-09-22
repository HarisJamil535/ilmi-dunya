import { ArrowUpRight, BookOpen, FileText, Play, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";

const resources = [
  { title: "Chapter notes", category: "READ & REVISE", description: "Short questions, long questions and chapter notes. A clearer way through your syllabus.", icon: FileText, tone: "mint", to: "/subjects", action: "Find chapter notes" },
  { title: "Video lessons", category: "WATCH & LEARN", description: "Go topic by topic with video lessons you can pause, revisit and learn from at your own pace.", icon: Play, tone: "sky", to: "/videos", action: "Explore video lessons" },
  { title: "MCQ practice", category: "TEST YOURSELF", description: "Chapter and topic MCQs, instant results and explanations that help the next answer come easier.", icon: ClipboardCheck, tone: "peach", to: "/tests", action: "Take an MCQ test" },
  { title: "Books & past papers", category: "PREPARE FOR EXAMS", description: "Textbooks and past papers, together with your subject. Read online or keep a copy for later.", icon: BookOpen, tone: "lilac", to: "/subjects", action: "Browse books & papers" },
];

export default function Features() {
  return <section className="home-section home-resources" id="study-resources">
    <div className="home-width">
      <div className="home-section-heading"><div><p className="home-eyebrow">A place for every way you learn</p><h2>Everything for your<br /><span>next lightbulb moment.</span></h2></div><p>From the first read to the final revision.<br />Pick up exactly where you need to.</p></div>
      <div className="home-resource-grid">{resources.map((item) =>
        <Link key={item.title} to={item.to} className={`home-resource home-tone-${item.tone}`}>
          <div className="home-resource-top"><span className="home-resource-icon"><item.icon size={28} strokeWidth={1.5} /></span><ArrowUpRight className="home-resource-arrow" size={22} /></div>
          <p className="home-resource-category">{item.category}</p><h3>{item.title}</h3><p>{item.description}</p><span className="home-resource-action">{item.action} <ArrowUpRight size={16} /></span>
        </Link>
      )}</div>
    </div>
  </section>;
}
