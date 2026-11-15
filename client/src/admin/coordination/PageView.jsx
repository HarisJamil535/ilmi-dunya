import { useLayoutEffect, useRef, useState } from "react";
import RichCell from "./RichCell";
import { COLUMNS, DAYS, LABELS, TOTAL, WIDTHS } from "./pageLayout";

// Only the e-signature goes on the line (no printed name), at the height of about two lines of text.
function Signature({ title, sig }) {
  return <div className="cr-sign"><span className="cr-sign-label">{title}</span>
    <span className="cr-sign-line">{sig?.imageUrl && <img src={sig.imageUrl} alt={`Signature of ${sig.name}`} title={`Signed by ${sig.name}`} />}</span>
  </div>;
}

// Attendees come from the department (Section Head, then its staff); files without a department keep typed names.
function Attendees({ attendees, cellBox }) {
  if (!attendees) return <div className="cr-attendees">{[1, 2, 3, 4].map((n) => <div key={n} className="cr-inline"><span>{n}.</span>{cellBox(n)}</div>)}</div>;
  return <div className="cr-attendees">{attendees.map((name, i) => <div key={`${name}-${i}`} className="cr-inline"><span>{i + 1}.</span><span>{name}</span></div>)}</div>;
}

// The record exactly as printed: A4 landscape, scaled to fit the screen.
export function PageView({ cell, settings, signatures, fontPt, zoom = "fit", attendees, font = "arial" }) {
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
    <div className={`cr-page pf-${font}`} style={{ transform: `scale(${scale})`, "--fs": `${(fontPt || 9) * 1.3333}px` }}>
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
            <Attendees attendees={attendees} cellBox={(n) => c(`attendee${n}`, { single: true })} />
          </td></tr>
          <tr>
            <td colSpan={3}><div className="cr-inline"><span>Date of submission of the Lesson Plan to the Sec Head:</span>{c("submitDate", { single: true })}</div></td>
            <td colSpan={3}><div className="cr-inline"><span>Date of distribution of the finalized Lesson Plan to the Teachers:</span>{c("distributeDate", { single: true })}</div></td>
          </tr>
        </tbody>
      </table>
      <div className="cr-signs">
        <Signature title="Sign: Subject Coordinator:" sig={signatures.coordinator} />
        <Signature title="SH Sign:" sig={signatures.sectionHead} />
      </div>
      {settings.caption && <p className="cr-caption">{settings.caption}</p>}
      <div className="cr-foot"><span>{settings.footerText}</span></div>
    </div>
    </div>
  </div>;
}

// The same boxes as a simple form, for phones.
export function FormView({ cell, signatures, attendees }) {
  const box = (key, extra) => <div className="cf-field"><span className="cf-label">{LABELS[key]}</span><RichCell {...cell(key)} {...extra} /></div>;
  return <div className="cf-form">
    <section className="cf-card"><h3>Week details</h3><div className="cf-grid">{box("week", { single: true })}{box("className", { single: true })}{box("sections", { single: true })}{box("subject", { single: true })}{box("periods", { single: true })}</div>{box("topic")}{box("broughtForward")}</section>
    {DAYS.map(([day, name]) => <section key={day} className="cf-card"><h3>{name}</h3>{COLUMNS.map(([column]) => <div key={column}>{box(`${day}.${column}`, column === "period" ? { single: true } : {})}</div>)}</section>)}
    <section className="cf-card"><h3>After the plan</h3>{box("extraHelp")}{box("teacher", { single: true })}{attendees ? <div className="cf-field"><span className="cf-label">Attendees of Coordination Meeting</span><ol className="cf-attendees">{attendees.map((name, i) => <li key={`${name}-${i}`}>{name}</li>)}</ol></div> : <div className="cf-grid">{[1, 2, 3, 4].map((n) => <div key={n}>{box(`attendee${n}`, { single: true })}</div>)}</div>}{box("submitDate", { single: true })}{box("distributeDate", { single: true })}</section>
    <section className="cf-card"><h3>Signatures</h3><div className="cf-grid">
      <div className="cf-field"><span className="cf-label">Subject Coordinator</span>{signatures.coordinator?.imageUrl ? <img className="cf-sig" src={signatures.coordinator.imageUrl} alt="Subject Coordinator's signature" /> : <span className="text-sm text-slate-500">Not signed yet</span>}</div>
      <div className="cf-field"><span className="cf-label">Section Head</span>{signatures.sectionHead?.imageUrl ? <img className="cf-sig" src={signatures.sectionHead.imageUrl} alt="Section Head's signature" /> : <span className="text-sm text-slate-500">Not signed yet</span>}</div>
    </div></section>
  </div>;
}
