// A paper as it will print, drawn on screen. The words and order come from the server, so they match the PDF and Word files.
import { Fragment } from "react";

const Head = ({ paper, logoUrl, group }) => {
  const h = paper.header;
  const subject = [h.subjectTitle, h.className].filter(Boolean).join(" - ") + (paper.versionCount > 1 && paper.layout.mode !== "tear" ? `   Paper: ${paper.version}` : "");
  return <header className="pp-head">
    <div className="pp-lines"><span><b>Name of Candidate:</b> <i /></span><span><b>Class/Section:</b> <i /></span></div>
    <div className="pp-lines"><span><b>Roll No:</b> <i /></span><span><b>Date:</b> {h.date || <i />}</span><span><b>Sign. of Invigilator:</b> <i /></span></div>
    <div className="pp-title">
      {logoUrl && <img src={logoUrl} alt="" />}
      <div>{group && <u className="pp-group">{group}</u>}{h.schoolName && <strong className="pp-school">{h.schoolName}</strong>}{h.examName && <strong>{h.examName}</strong>}</div>
    </div>
    <div className="pp-meta"><b className="pp-times">{(paper.timeLines || []).map((line) => <span key={line}>{line}</span>)}</b><b>{subject}</b><b>Total Marks: {paper.totalMarks}</b></div>
  </header>;
};

const Section = ({ section, paper, showAnswers }) => <section className="pp-section">
  <h3>{section.title}</h3>
  <p className="pp-prompt">{section.prompt}</p>
  {section.kind === "mcq" ? <table className="pp-table pp-mcq">
    <thead><tr><th />{<th>Question</th>}{["A", "B", "C", "D"].map((k) => <th key={k}>{k}</th>)}{paper.layout.bubbles && <th colSpan={4} className="pp-bubble-head">A &nbsp;B &nbsp;C &nbsp;D</th>}</tr></thead>
    <tbody>{section.items.map((item, index) => item.type === "scenario"
      ? <tr key={`s${index}`}><td colSpan={paper.layout.bubbles ? 10 : 6} className="pp-scenario"><b>Scenario (Questions {item.from}-{item.to}): </b>{item.text}</td></tr>
      : <tr key={item.no}><td className="pp-no">{item.no}</td><td>{item.text}</td>{[0, 1, 2, 3].map((c) => <td key={c} className={`pp-opt ${showAnswers && item.options[c]?.key === item.answer ? "pp-answer" : ""}`}>{item.options[c]?.text}</td>)}{paper.layout.bubbles && <td colSpan={4} className="pp-bubbles"><i /><i /><i /><i /></td>}</tr>)}</tbody>
  </table> : section.choice ? <table className="pp-table pp-written"><tbody>{section.items.map((item) => <tr key={item.no}>
    <td className="pp-no"><b>({item.label})</b></td><td>{item.alternatives[0].text}</td><td className="pp-mark">{item.marks}</td><td className="pp-or"><b>OR</b></td><td>{item.alternatives[1]?.text}</td><td className="pp-mark">{item.marks}</td>
  </tr>)}</tbody></table> : <ol className="pp-lines-list">{section.items.map((item) => <li key={item.no}><b>({item.label})</b><span>{item.alternatives[0].text}</span><b>[{item.marks}]</b></li>)}</ol>}
</section>;

const SIZE = { small: 0.92, normal: 1, large: 1.1, xl: 1.2 };
const MARK = { light: 0.06, medium: 0.1, strong: 0.15 };
const fontKey = (value) => ({ sans: "arial", serif: "times" }[value] || value || "arial");
const MADE = "Prepared by IlmiDunya  ·  www.ilmidunya.org";

// The faint word or logo behind a page (or each half of a shared sheet), as it prints.
const Mark = ({ layout, tilt = -35 }) => {
  const mark = layout.watermark;
  if (!mark || mark.kind === "none") return null;
  const opacity = MARK[mark.strength] || MARK.light;
  return <div className="pp-watermark" aria-hidden="true">
    {mark.kind === "text" && mark.text && <span style={{ opacity, transform: `rotate(${tilt}deg)` }}>{mark.text}</span>}
    {mark.kind === "image" && mark.imageUrl && <img src={mark.imageUrl} alt="" style={{ opacity: opacity * 1.8 }} />}
  </div>;
};

export default function PaperPreview({ papers, version, showAnswers, logoUrl }) {
  const layout = papers[0].layout;
  const look = `pp-font-${fontKey(layout.font)} pp-space-${layout.spacing || "normal"} pp-titles-${layout.titleStyle || "bold"}`;
  const size = { "--pp-size": SIZE[layout.fontSize] || 1 };
  if (layout.mode === "tear" && papers.length > 1) {
    return <div className={`pp-stack ${look}`} style={size}>{["front", "back"].map((side) => <article key={side} className="pp-sheet pp-tear" aria-label={`Sheet ${side}`}>
      <span className="pp-side">{side === "front" ? "Front" : "Back"}</span>
      {papers.slice(0, 2).map((paper, index) => <Fragment key={paper.version}>
        {index === 1 && <div className={`pp-cut ${layout.cutLine === "both" || (layout.cutLine === "back" && side === "back") ? "is-on" : ""}`} />}
        <div className="pp-half">
          <Mark layout={layout} tilt={-20} />
          {side === "front" ? <Head paper={paper} logoUrl={logoUrl} group={`Group ${paper.version}`} /> : <u className="pp-group pp-group-back">Group {paper.version}</u>}
          {paper.sections.filter((s) => (s.kind === "mcq") === (side === "front")).map((s) => <Section key={s.id} section={s} paper={paper} showAnswers={showAnswers} />)}
          <p className="pp-made">{MADE}</p>
        </div>
      </Fragment>)}
    </article>)}</div>;
  }
  const paper = papers.find((p) => p.version === version) || papers[0];
  return <div className={`pp-stack ${look}`} style={size}><article className="pp-sheet" aria-label={`Question paper ${paper.version}`}>
    <Mark layout={layout} />
    <Head paper={paper} logoUrl={logoUrl} />
    {paper.sections.map((s, i) => <Fragment key={s.id}>
      {layout.subjectiveNewPage && s.kind !== "mcq" && paper.sections.slice(0, i).every((p) => p.kind === "mcq") && i > 0 && <div className="pp-break" role="separator"><span>New page: subjective part</span></div>}
      <Section section={s} paper={paper} showAnswers={showAnswers} />
    </Fragment>)}
    <p className="pp-made">{MADE}</p>
  </article></div>;
}
