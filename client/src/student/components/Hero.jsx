import { useContext, useState } from "react";
import { ArrowRight, BookOpen, Building2, GraduationCap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppContext } from "../../context/AppContext";
import heroImg from "../../assets/hero_img.jpg";
import CustomSelect from "../../shared/CustomSelect";

const Hero = ({ stats = [] }) => {
  const { boards, classes, isLoadingContext, refreshContext } = useContext(AppContext);
  const [classId, setClassId] = useState("");
  const [boardId, setBoardId] = useState("");
  const navigate = useNavigate();
  const unavailable = !isLoadingContext && (!boards.length || !classes.length);

  const startLearning = (event) => {
    event.preventDefault();
    const grade = classes.find((item) => item._id === classId);
    const board = boards.find((item) => item._id === boardId);
    if (!grade || !board) return;
    const params = new URLSearchParams({
      classId, boardId,
      class: String(grade.classNumber || grade.name || "").replace(/class\s*/i, "").trim(),
      board: board.name.replace(/\s*board/i, "").trim().toLowerCase(),
    });
    navigate(`/subjects?${params}`);
  };

  return (
    <>
      <section className="home-hero">
        <img src={heroImg} alt="" className="home-hero-photo" fetchPriority="high" />
        <div className="home-hero-content home-width">
          <p className="home-eyebrow"><BookOpen size={16} /> A little progress. Every day.</p>
          <h1>IlmiDunya<span>Your world of learning.</span></h1>
          <p className="home-hero-description">Big goals start with one chapter. Find your notes, understand the topic, and put your knowledge to the test.</p>
          <form className="home-finder" onSubmit={startLearning} aria-label="Find your subjects">
            <CustomSelect id="home-class" label={<><GraduationCap size={17} /> Your class</>} value={classId} disabled={isLoadingContext} placeholder={isLoadingContext ? "Loading classes..." : "Choose class"} options={classes.map((item) => ({ value: item._id, label: /class/i.test(item.name || "") ? item.name : `Class ${item.classNumber || item.name}` }))} onChange={setClassId} />
            <CustomSelect id="home-board" label={<><Building2 size={17} /> Your board</>} value={boardId} disabled={isLoadingContext} placeholder={isLoadingContext ? "Loading boards..." : "Choose board"} options={boards.map((item) => ({ value: item._id, label: item.name }))} onChange={setBoardId} />
            <button className="home-button" disabled={isLoadingContext || unavailable || !classId || !boardId}>Start learning <ArrowRight size={18} /></button>
          </form>
          {unavailable && <p role="status" className="home-option-error">Study options are unavailable. <button type="button" onClick={refreshContext}>Try again</button></p>}
          <div className="home-hero-links"><Link to="/learn">Browse the study library <ArrowRight size={15} /></Link><Link to="/tests">Ready to practise? <ArrowRight size={15} /></Link></div>
        </div>
      </section>
      {stats.length > 0 && <section className="home-stats" aria-label="IlmiDunya in numbers"><div className="home-width">{stats.slice(0, 4).map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div></section>}
    </>
  );
};
export default Hero;
