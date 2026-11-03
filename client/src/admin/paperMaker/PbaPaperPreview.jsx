// A PBA paper as it will print, drawn on screen from the same model the PDF and Word files use.
import { Fragment } from "react";
import { Blocks } from "../../shared/PbaContent";

const SIZE = { small: 0.92, normal: 1, large: 1.1, xl: 1.2 };
const MARK = { light: 0.06, medium: 0.1, strong: 0.15 };
const MADE = "Prepared by IlmiDunya  ·  www.ilmidunya.org";

const Space = ({ space }) => {
  if (!space || space.mode === "none" || !space.size) return null;
  return space.mode === "lines" ? <div className="pbp-lines">{Array.from({ length: space.size }, (_, i) => <i key={i} />)}</div> : <div className="pbp-box" style={{ height: `${space.size * 1.4}em` }} />;
};

export default function PbaPaperPreview({ paper, mode = "paper", logoUrl }) {
  const h = paper.header; const layout = paper.layout; const mark = layout.watermark;
  const key = mode === "key";
  const sheet = mode === "esheet";
  return <div className={`pp-stack pp-font-${layout.font || "arial"} pp-space-${layout.spacing || "normal"}`} style={{ "--pp-size": SIZE[layout.fontSize] || 1 }}>
    <article className="pp-sheet pbp" aria-label={`PBA paper ${paper.version}`}>
      {mark?.kind !== "none" && <div className="pp-watermark" aria-hidden="true">{mark.kind === "text" && mark.text && <span style={{ opacity: MARK[mark.strength] || 0.06, transform: "rotate(-35deg)" }}>{mark.text}</span>}{mark.kind === "image" && mark.imageUrl && <img src={mark.imageUrl} alt="" style={{ opacity: (MARK[mark.strength] || 0.06) * 1.8 }} />}</div>}
      {key ? <header className="pbp-key"><h2>ANSWER KEY</h2><p>{[h.schoolName, h.paperTitle, h.session, paper.versionCount > 1 ? `Paper ${paper.version}` : ""].filter(Boolean).join("  |  ")}</p><small>For teachers only. Do not give this to students.</small></header> : <>
        <header className="pbp-head">
          <div className="pbp-fields">{h.candidateFields.map((field) => <p key={field}><b>{field}:</b> <span>{field.toLowerCase() === "date" && h.date ? h.date : ""}</span></p>)}</div>
          <div className="pbp-title">{logoUrl && <img src={logoUrl} alt="" />}{[h.schoolName, h.examName, h.paperTitle, h.session].filter(Boolean).map((line, i) => <strong key={line + i}>{line}</strong>)}</div>
          {layout.rollNumber && <div className="pbp-roll"><b>Roll Number</b><div className="pbp-boxes">{Array.from({ length: layout.rollDigits }, (_, i) => <i key={i} />)}</div>
            <div className="pbp-digits" style={{ gridTemplateColumns: `repeat(${layout.rollDigits}, 1fr)` }}>{Array.from({ length: 10 * layout.rollDigits }, (_, i) => <span key={i}>{Math.floor(i / layout.rollDigits)}</span>)}</div></div>}
        </header>
        <p className="pbp-total"><b>Total Marks: {paper.totalMarks}</b>{h.timeAllowed && <b>Time: {h.timeAllowed}</b>}</p>
        {h.note && <p className="pbp-note"><b>{sheet ? "E-SHEET: write the answers in the boxes below" : h.note}</b></p>}
      </>}
      {paper.sections.map((section) => <section key={section.id} className="pbp-section">
        <h3>{section.title}</h3>
        {section.note && <p className="pbp-sectionnote">{section.note}</p>}
        {section.questions.map((question) => <div key={question.id + question.number} className="pbp-question">
          {sheet ? <p className="pbp-qhead"><b>{question.label}:</b><b>[{question.marks}]</b></p> : null}
          {!sheet && (question.stem.length ? <div className="pbp-row"><b className="pbp-label">{question.label}:</b><div className="pbp-body"><Blocks blocks={key ? [] : question.stem} reveal={key} />{key && question.stem.some((block) => block.type === "labelling") && !question.parts.some((part) => part.answer.length) && <Blocks blocks={question.stem.filter((block) => block.type === "labelling")} reveal />}</div><b className="pbp-marks">[{question.marks}]</b></div>
            : <p className="pbp-qhead"><b>{question.label}:</b><b>[{question.marks}]</b></p>)}
          {question.parts.map((part) => <Fragment key={part.label}>
            <div className="pbp-row pbp-part"><b className="pbp-label">{part.label}.</b>
              <div className="pbp-body">{sheet ? <Space space={{ mode: "box", size: 9 }} /> : key ? (part.answer.length ? <Blocks blocks={part.answer} reveal /> : <em>No model answer added.</em>) : <><Blocks blocks={part.blocks} /><Space space={part.space} /></>}</div>
              <span className="pbp-marks">({part.marks})</span></div>
          </Fragment>)}
        </div>)}
      </section>)}
      {layout.credit !== false && <p className="pp-made">{MADE}</p>}
    </article>
  </div>;
}
