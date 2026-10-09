import { useContext, useState } from "react";
import { ArrowRight, BookOpen, Building2, GraduationCap, Pause, Play } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import heroImg from "../../assets/hero_img.jpg";
import CustomSelect from "../../shared/CustomSelect";
import { showStudentToast } from "../../shared/studentNotifications";

const Hero = ({ stats = [] }) => {
  const { boards, classes, isLoadingContext, refreshContext } = useContext(AppContext);
  const [classId, setClassId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [wordsPaused, setWordsPaused] = useState(false);
  const navigate = useNavigate();
  const unavailable = !isLoadingContext && (!boards.length || !classes.length);

  const startLearning = (event) => {
    event.preventDefault();
    const grade = classes.find((item) => item._id === classId);
    const board = boards.find((item) => item._id === boardId);
    if (!grade || !board) {
      showStudentToast({
        type: "warning",
        title: "Choose your study path",
        message: !grade && !board ? "Select your class and board to start learning." : !grade ? "Select your class to continue." : "Select your board to continue.",
      });
      return;
    }
    const params = new URLSearchParams({
      classId, boardId,
      class: String(grade.classNumber || grade.name || "").replace(/class\s*/i, "").trim(),
      board: board.name.replace(/\s*board/i, "").trim().toLowerCase(),
    });
    navigate(`/subjects?${params}`);
  };

  return (
    <>
      <section className="home-hero" data-motion={wordsPaused ? "paused" : "playing"}>
        <img src={heroImg} alt="" className="home-hero-photo" fetchPriority="low" decoding="async" />
        <div className="home-hero-content home-width">
          <p className="home-eyebrow"><BookOpen size={16} /> Built for Classes 9–12 in Pakistan</p>
          <h1>IlmiDunya<span className="home-tagline"><span className="sr-only">Your world of learning.</span><span className="home-tagline-visual" aria-hidden="true">Your world of <span className="home-word-window">{["learning.", "discovery.", "progress."].map((word, index) => <span className="home-changing-word" key={word} style={{ "--word-index": index }}>{word}</span>)}</span></span></span></h1>
          <p className="home-hero-description">Big goals start with one chapter. Find your notes, understand the topic, and put your knowledge to the test.</p>
          <form className="home-finder" onSubmit={startLearning} aria-label="Find your subjects">
            <CustomSelect id="home-class" label={<><GraduationCap size={17} /> Your class</>} value={classId} disabled={isLoadingContext} placeholder={isLoadingContext ? "Loading classes..." : "Choose class"} options={classes.map((item) => ({ value: item._id, label: /class/i.test(item.name || "") ? item.name : `Class ${item.classNumber || item.name}` }))} onChange={setClassId} />
            <CustomSelect id="home-board" label={<><Building2 size={17} /> Your board</>} value={boardId} disabled={isLoadingContext} placeholder={isLoadingContext ? "Loading boards..." : "Choose board"} options={boards.map((item) => ({ value: item._id, label: item.name }))} onChange={setBoardId} />
            <button className="home-button" disabled={isLoadingContext || unavailable}>Start learning <ArrowRight size={18} /></button>
          </form>
          {unavailable && <p role="status" className="home-option-error">Study options are unavailable. <button type="button" onClick={refreshContext}>Try again</button></p>}
          <div className="home-hero-links"><Link to="/learn">Browse resources <ArrowRight size={15} /></Link><Link to="/tests">Practise MCQs <ArrowRight size={15} /></Link><button type="button" className="home-motion-toggle" onClick={() => setWordsPaused((value) => !value)} aria-label={wordsPaused ? "Play headline animation" : "Pause headline animation"} title={wordsPaused ? "Play headline animation" : "Pause headline animation"}>{wordsPaused ? <Play size={14} /> : <Pause size={14} />}</button></div>
        </div>
      </section>
      {stats.length > 0 && <section className="home-stats" aria-label="IlmiDunya in numbers"><div className="home-width">{stats.slice(0, 4).map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div></section>}
    </>
  );
};
export default Hero;
