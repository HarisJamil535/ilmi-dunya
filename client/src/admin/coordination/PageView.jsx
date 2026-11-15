import { useLayoutEffect, useRef, useState } from "react";
import RichCell from "./RichCell";
import { COLUMNS, DAYS, LABELS, TOTAL, WIDTHS } from "./pageLayout";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

function Signature({ title, sig, nameCell }) {
  return <div className="cr-sign"><span className="cr-sign-label">{title}</span>
    <span className="cr-sign-line">{sig?.imageUrl && <img src={sig.imageUrl} alt={`Signature of ${sig.name}`} />}</span>
    <span className="cr-sign-name">{nameCell}{sig?.at && <small> · {fmtDate(sig.at)}</small>}</span>
  </div>;
}

// The record exactly as printed: A4 landscape, scaled to fit the screen.
export function PageView({ cell, settings, signatures, fontPt, zoom = "fit" }) {
  const wrap = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return undefined;
    const fit = () => setScale(zoom === "fit" ? Math.min(1.25, el.clientWidth / 1123) : Number(zoom));
    fit();
    const observer = new ResizeObserver(fit); observer.observe(el);
    return () => observer.disconnect();
  }, [zoom]);
  const c = (key, extra) => <RichCell {...cell(key)} {...extra} />;
  return <div ref={wrap} className={`cr-stage ${zoom !== "fit" ? "is-zoomed" : ""}`} style={{ height: 794 * scale + (zoom !== "fit" ? 14 : 0) }}>
    <div className="cr-sizer" style={{ width: 1123 * scale, height: 794 * scale }}>
    <div className="cr-page" style={{ transform: `scale(${scale})`, "--fs": `${(fontPt || 9) * 1.3333}px` }}>
      {settings.watermarkUrl && <img className="cr-watermark" src={settings.watermarkUrl} alt="" style={{ opacity: Math.min(0.5, (settings.watermarkOpacity || 0.12) * 2.2) }} />}
      <h2 className="cr-title">{settings.title}</h2>
      <div className="cr-topline">
        <span><b>Week:</b>{c("week", { single: true, className: "cr-u" })}</span>
        <span><b>Class:</b>{c("className", { single: true, className: "cr-u" })}</span>
        <span><b>No. of Sections:</b>{c("sections", { single: true, className: "cr-u" })}</span>
      </div>
      <table className="cr-table">
        <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${(w / TOTAL) * 100}%` }} />)}</colgroup>
        <tbody>
          <tr><td colSpan={6} className="cr-subject">
            <div className="cr-subject-left"><div className="cr-inline"><b>Subject:</b>{c("subject", { single: true, className: "cr-u" })}</div><div className="cr-inline"><b>Periods per week</b>{c("periods", { single: true })}</div></div>
            <div className="cr-inline cr-topic"><b>Topic:</b>{c("topic")}</div>
          </td></tr>
          <tr><td colSpan={6}><div className="cr-inline"><span>Topics brought forward (if any):</span>{c("broughtForward")}</div></td></tr>
          <tr className="cr-head">{COLUMNS.map(([, name]) => <th key={name}>{name}</th>)}</tr>
          {DAYS.map(([day, name]) => <tr key={day} className="cr-day">{COLUMNS.map(([column], i) => <td key={column}>{i === 0 ? <><span className="cr-dayname">{name}</span>{c(`${day}.period`, { placeholder: "Period…" })}</> : c(`${day}.${column}`)}</td>)}</tr>)}
          <tr><td colSpan={6}><div className="cr-inline"><i>Strategies for Learners requiring extra assistance:</i>{c("extraHelp")}</div></td></tr>
          <tr><td colSpan={6}>
            <div className="cr-inline"><span>Teacher Responsible for Preparing lesson Plan:</span>{c("teacher", { single: true })}</div>
            <div>Attendees of Coordination Meeting:</div>
            <div className="cr-attendees">{[1, 2, 3, 4].map((n) => <div key={n} className="cr-inline"><span>{n}.</span>{c(`attendee${n}`, { single: true })}</div>)}</div>
          </td></tr>
          <tr>
            <td colSpan={3}><div className="cr-inline"><span>Date of submission of the Lesson Plan to the Sec Head:</span>{c("submitDate", { single: true })}</div></td>
            <td colSpan={3}><div className="cr-inline"><span>Date of distribution of the finalized Lesson Plan to the Teachers:</span>{c("distributeDate", { single: true })}</div></td>
          </tr>
        </tbody>
      </table>
      <div className="cr-signs">
        <Signature title="Sign: Subject Coordinator:" sig={signatures.coordinator} nameCell={c("coordinatorName", { single: true, placeholder: "Name" })} />
        <Signature title="SH Sign:" sig={signatures.sectionHead} nameCell={c("sectionHeadName", { single: true, placeholder: "Name" })} />
      </div>
      {settings.caption && <p className="cr-caption">{settings.caption}</p>}
      <div className="cr-foot"><span>{settings.footerText}</span></div>
    </div>
    </div>
  </div>;
}

// The same boxes as a simple form, for phones.
export function FormView({ cell, signatures }) {
  const box = (key, extra) => <div className="cf-field"><span className="cf-label">{LABELS[key]}</span><RichCell {...cell(key)} {...extra} /></div>;
  return <div className="cf-form">
    <section className="cf-card"><h3>Week details</h3><div className="cf-grid">{box("week", { single: true })}{box("className", { single: true })}{box("sections", { single: true })}{box("subject", { single: true })}{box("periods", { single: true })}</div>{box("topic")}{box("broughtForward")}</section>
    {DAYS.map(([day, name]) => <section key={day} className="cf-card"><h3>{name}</h3>{COLUMNS.map(([column]) => <div key={column}>{box(`${day}.${column}`, column === "period" ? { single: true } : {})}</div>)}</section>)}
    <section className="cf-card"><h3>After the plan</h3>{box("extraHelp")}{box("teacher", { single: true })}<div className="cf-grid">{[1, 2, 3, 4].map((n) => <div key={n}>{box(`attendee${n}`, { single: true })}</div>)}</div>{box("submitDate", { single: true })}{box("distributeDate", { single: true })}</section>
    <section className="cf-card"><h3>Signatures</h3><div className="cf-grid">
      <div>{box("coordinatorName", { single: true })}{signatures.coordinator?.imageUrl && <img className="cf-sig" src={signatures.coordinator.imageUrl} alt="Subject Coordinator's signature" />}</div>
      <div>{box("sectionHeadName", { single: true })}{signatures.sectionHead?.imageUrl && <img className="cf-sig" src={signatures.sectionHead.imageUrl} alt="Section Head's signature" />}</div>
    </div></section>
  </div>;
}
