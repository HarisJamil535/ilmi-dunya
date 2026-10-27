// A paper as it will print, drawn on screen. The layout comes from the server, so it matches the PDF and Word files.
const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

export default function PaperPreview({ paper, logoUrl }) {
  const h = paper.header;
  return <article className="paper-sheet" aria-label={`Question paper, version ${paper.version}`}>
    <header className="paper-head">
      <div className="paper-head-left">
        {logoUrl && <img src={logoUrl} alt="" />}
        {h.schoolName && <strong>{h.schoolName}</strong>}
        {h.examName && <span>{h.examName}</span>}
        {h.subjectTitle && <h2>{h.subjectTitle}</h2>}
        {h.className && <strong>{h.className}</strong>}
        {h.paperCode && <small>{h.paperCode}</small>}
        {h.schemeNote && <small>{h.schemeNote}</small>}
        <strong>Total Marks: {paper.totalMarks}</strong>
        {h.timeAllowed && <span>Time allowed: {h.timeAllowed}</span>}
        {h.date && <span>Date: {h.date}</span>}
      </div>
      <div className="paper-head-mid">
        {h.showRollBoxes && <><b>Roll Number</b><div className="paper-roll">{Array.from({ length: h.rollBoxCount }, (_, i) => <i key={i} />)}</div></>}
        {h.instructions.length > 0 && <><b>Instructions</b><ol>{h.instructions.map((line, i) => <li key={i}><b>{roman[i]}.</b> {line}</li>)}</ol></>}
        {h.showSignatures && <div className="paper-sign"><span>Candidate Sign.</span><span>Invigilator Sign.</span></div>}
      </div>
      <div className="paper-version"><small>Version</small><b>{paper.version}</b></div>
    </header>
    {paper.sections.map((section) => <section key={section.id} className="paper-section">
      <div className="paper-section-bar"><b>{section.name.toUpperCase()} (Marks {section.marks})</b><span>{section.heading}</span></div>
      <p className="paper-attempt">{section.attemptLine}</p>
      {section.instructions && <p className="paper-section-note">{section.instructions}</p>}
      {section.kind === "mcq" ? <table className="paper-mcq">
        <thead><tr><th>Question</th>{["A", "B", "C", "D"].map((key) => <th key={key}>{key}</th>)}</tr></thead>
        <tbody>{section.items.map((item, index) => item.type === "scenario"
          ? <tr key={`s${index}`} className="paper-scenario"><th>SCENARIO<br />(FOR QUESTIONS {item.from}-{item.to})</th><td colSpan={4}>{item.title && item.title.toLowerCase() !== "scenario" && <b>{item.title}<br /></b>}<span style={{ whiteSpace: "pre-wrap" }}>{item.text}</span></td></tr>
          : <tr key={item.no}><td>{item.no}. {item.text}</td>{[0, 1, 2, 3].map((c) => <td key={c} className={item.options[c]?.key === item.answer && paper.showAnswers ? "is-answer" : ""}>{item.options[c]?.text}</td>)}</tr>)}</tbody>
      </table> : <ol className="paper-written">{section.items.map((item) => <li key={item.no}>
        <b className="paper-q">Q.{item.no}</b>
        <div>{item.alternatives.map((alt, i) => <div key={i}>{i > 0 && <p className="paper-or">OR</p>}<p>{item.alternatives.length > 1 && `(${String.fromCharCode(97 + i)}) `}{alt.text}</p></div>)}</div>
        <b className="paper-marks">[{item.marks}]</b>
      </li>)}</ol>}
    </section>)}
    <footer className="paper-foot"><b>{h.paperCode || h.examName}</b><span>{h.footerNote || "Prepared with IlmiDunya Paper Maker"}</span><b>Version {paper.version}</b></footer>
  </article>;
}
