import { useLayoutEffect, useRef, useState } from "react";
import RichCell from "./RichCell";
import { COLUMNS, DAYS, LABELS, TOTAL, WIDTHS } from "./pageLayout";

// Only the e-signature goes on the line (no printed name), at the height of about two lines of text.
function Signature({ title, sig, onSign, onUpdate }) {
  return <div className="cr-sign"><span className="cr-sign-label">{title}</span>
    <span className="cr-sign-line">{sig?.imageUrl ? <>{onUpdate ? <button type="button" className="cr-sign-mine" onClick={onUpdate} title="Update your signature on this week"><img src={sig.imageUrl} alt={`Signature of ${sig.name}`} /><span>Update</span></button> : <img src={sig.imageUrl} alt={`Signature of ${sig.name}`} title={`Signed by ${sig.name}`} />}</> : onSign ? <button type="button" className="cr-sign-here" onClick={onSign}>Click to sign here</button> : null}</span>
  </div>;
}

// The signature beside an attendee (same rules as the printed record): the Section Head's approval
// signature, the coordinator's submission signature or their own attendance signature, each teacher's own.
function attendeeSig(person, signatures = {}) {
  if (person.slot === "sectionHead") return signatures.sectionHead || null;
  const own = (signatures.members || []).find((m) => m.admin === person.id);
  if (own) return own;
  return person.slot === "coordinator" && signatures.coordinator?.admin === person.id ? signatures.coordinator : null;
}

// What the viewer can do on one attendee row: sign it, or update their signature on it.
function attendeeAction(person, sig, att) {
  if (!att) return null;
  if (person.slot === "sectionHead") return sig ? (att.shUpdate ? { kind: "update", run: att.shUpdate } : null) : att.shSign ? { kind: "sign", run: att.shSign } : null;
  if (person.id !== att.meId || !att.canAttend) return null;
  return sig ? { kind: "update", run: att.onUpdate } : { kind: "sign", run: att.onAttend };
}

// Attendees come from the department (Section Head, then its staff); files without a department keep typed names.
function Attendees({ attendees, cellBox, signatures, att }) {
  if (!attendees) return <div className="cr-attendees">{[1, 2, 3, 4].map((n) => <div key={n} className="cr-inline"><span>{n}.</span>{cellBox(n)}</div>)}</div>;
  return <div className="cr-attendees is-signing">{attendees.map((person, i) => {
    const sig = attendeeSig(person, signatures);
    const action = attendeeAction(person, sig, att);
    return <div key={`${person.id || person.slot}-${i}`} className="cr-att">
      <span className="cr-att-name">{i + 1}. {person.name}</span>
      <span className="cr-att-line">
        {sig ? (action ? <button type="button" className="cr-sign-mine" onClick={action.run} title="Update your signature on this week"><img src={sig.imageUrl} alt={`Signature of ${sig.name}`} /><span>Update</span></button> : <img src={sig.imageUrl} alt={`Signature of ${sig.name}`} title={`Signed by ${sig.name}`} />)
          : action ? <button type="button" className="cr-sign-here" onClick={action.run}>Sign here</button> : null}
      </span>
    </div>;
  })}</div>;
}

// The record exactly as printed: A4 landscape, scaled to fit the screen.
export function PageView({ cell, settings, signatures, fontPt, zoom = "fit", attendees, font = "arial", signSlot = "", onSign, meId = "", onUpdate, att }) {
  const upd = (slot) => (meId && signatures[slot]?.admin === meId ? onUpdate : null);
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
            <Attendees attendees={attendees} signatures={signatures} att={att} cellBox={(n) => c(`attendee${n}`, { single: true })} />
          </td></tr>
          <tr>
            <td colSpan={3}><div className="cr-inline"><span>Date of submission of the Lesson Plan to the Sec Head:</span>{c("submitDate", { single: true })}</div></td>
            <td colSpan={3}><div className="cr-inline"><span>Date of distribution of the finalized Lesson Plan to the Teachers:</span>{c("distributeDate", { single: true })}</div></td>
          </tr>
        </tbody>
      </table>
      <div className="cr-signs">
        <Signature title="Sign: Subject Coordinator:" sig={signatures.coordinator} onSign={signSlot === "coordinator" ? onSign : null} onUpdate={upd("coordinator")} />
        <Signature title="SH Sign:" sig={signatures.sectionHead} onSign={signSlot === "sectionHead" ? onSign : null} onUpdate={upd("sectionHead")} />
        {(signatures.principal || signSlot === "principal") && <Signature title="Principal Sign:" sig={signatures.principal} onSign={signSlot === "principal" ? onSign : null} onUpdate={upd("principal")} />}
      </div>
      {settings.caption && <p className="cr-caption">{settings.caption}</p>}
      <div className="cr-foot"><span>{settings.footerText}</span></div>
    </div>
    </div>
  </div>;
}

// The same boxes as a simple form, for phones.
export function FormView({ cell, signatures, attendees, signSlot = "", onSign, meId = "", onUpdate, att }) {
  const updateBtn = (slot) => (meId && onUpdate && signatures[slot]?.admin === meId ? <button type="button" onClick={onUpdate} className="mt-1 text-xs font-bold text-primary underline">Update my signature</button> : null);
  const signHere = (slot) => (signSlot === slot && onSign ? <button type="button" className="cr-sign-here !min-h-11" onClick={onSign}>Click to sign here</button> : <span className="text-sm text-slate-500">Not signed yet</span>);
  const box = (key, extra) => <div className="cf-field"><span className="cf-label">{LABELS[key]}</span><RichCell {...cell(key)} {...extra} /></div>;
  return <div className="cf-form">
    <section className="cf-card"><h3>Week details</h3><div className="cf-grid">{box("week", { single: true })}{box("className", { single: true })}{box("sections", { single: true })}{box("subject", { single: true })}{box("periods", { single: true })}</div>{box("topic")}{box("broughtForward")}</section>
    {DAYS.map(([day, name]) => <section key={day} className="cf-card"><h3>{name}</h3>{COLUMNS.map(([column]) => <div key={column}>{box(`${day}.${column}`, column === "period" ? { single: true } : {})}</div>)}</section>)}
    <section className="cf-card"><h3>After the plan</h3>{box("extraHelp")}{box("teacher", { single: true })}{attendees ? <div className="cf-field"><span className="cf-label">Attendees of Coordination Meeting</span><ul className="cf-attendee-list">{attendees.map((person, i) => {
      const sig = attendeeSig(person, signatures);
      const action = attendeeAction(person, sig, att);
      return <li key={`${person.id || person.slot}-${i}`} className={sig ? "is-signed" : ""}>
        <span className="cf-att-num">{i + 1}</span>
        <span className="cf-att-name">{person.name}{person.id && person.id === att?.meId ? <em> (you)</em> : null}</span>
        <span className="cf-att-sig">{sig ? <img src={sig.imageUrl} alt={`Signature of ${sig.name}`} /> : <i>Not signed</i>}</span>
        {action && <button type="button" onClick={action.run} className={action.kind === "sign" ? "cf-att-btn is-sign" : "cf-att-btn"}>{action.kind === "sign" ? "Sign" : "Update"}</button>}
      </li>;
    })}</ul></div> : <div className="cf-grid">{[1, 2, 3, 4].map((n) => <div key={n}>{box(`attendee${n}`, { single: true })}</div>)}</div>}{box("submitDate", { single: true })}{box("distributeDate", { single: true })}</section>
    <section className="cf-card"><h3>Signatures</h3><div className="cf-grid">
      <div className="cf-field"><span className="cf-label">Subject Coordinator</span>{signatures.coordinator?.imageUrl ? <><img className="cf-sig" src={signatures.coordinator.imageUrl} alt="Subject Coordinator's signature" />{updateBtn("coordinator")}</> : signHere("coordinator")}</div>
      <div className="cf-field"><span className="cf-label">Section Head</span>{signatures.sectionHead?.imageUrl ? <><img className="cf-sig" src={signatures.sectionHead.imageUrl} alt="Section Head's signature" />{updateBtn("sectionHead")}</> : signHere("sectionHead")}</div>
      {(signatures.principal?.imageUrl || signSlot === "principal") && <div className="cf-field"><span className="cf-label">Principal</span>{signatures.principal?.imageUrl ? <><img className="cf-sig" src={signatures.principal.imageUrl} alt="Principal's signature" />{updateBtn("principal")}</> : signHere("principal")}</div>}
    </div></section>
  </div>;
}
