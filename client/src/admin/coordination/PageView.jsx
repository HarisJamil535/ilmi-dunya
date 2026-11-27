import { useLayoutEffect, useRef, useState } from "react";
import RichCell from "./RichCell";
import { COLUMNS, DAYS, TOTAL, WIDTHS, textFor } from "./pageLayout";

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
function Attendees({ attendees, cellBox, signatures, att, T = textFor("en") }) {
  if (!attendees) return <div className="cr-attendees">{[1, 2, 3, 4].map((n) => <div key={n} className="cr-inline"><span>{n}.</span>{cellBox(n)}</div>)}</div>;
  const per = attendees.length <= 4 ? 4 : attendees.length <= 6 ? attendees.length : Math.ceil(attendees.length / Math.ceil(attendees.length / 6));
  return <div className={`cr-attendees is-signing ${per > 4 ? "is-stacked" : ""}`} style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))` }}>{attendees.map((person, i) => {
    const sig = attendeeSig(person, signatures);
    const action = attendeeAction(person, sig, att);
    return <div key={`${person.id || person.slot}-${i}`} className="cr-att">
      <span className="cr-att-name">{T.rtl ? `${i + 1}۔ ` : `${i + 1}. `}{person.slot === "sectionHead" ? T.sectionHead : person.name}</span>
      <span className="cr-att-line">
        {sig ? (action ? <button type="button" className="cr-sign-mine" onClick={action.run} title="Update your signature on this week"><img src={sig.imageUrl} alt={`Signature of ${sig.name}`} /><span>Update</span></button> : <img src={sig.imageUrl} alt={`Signature of ${sig.name}`} title={`Signed by ${sig.name}`} />)
          : action ? <button type="button" className="cr-sign-here" onClick={action.run}>Sign here</button> : null}
      </span>
    </div>;
  })}</div>;
}

// A tap anywhere inside a table cell (not only on its first line) puts the cursor in that cell's box,
// at the end of its text. Day cells are tall and their boxes start at the top, so this matters most on phones.
function focusCellAt(e) {
  if (e.target.closest('[contenteditable="true"], button, a, input, select, textarea')) return;
  const td = e.target.closest("td");
  const editors = td ? [...td.querySelectorAll('.cr-edit[contenteditable="true"]')] : [];
  if (!editors.length) return;
  // With several boxes in one cell, the one nearest the tap.
  const y = e.clientY;
  const editor = editors.reduce((best, el) => { const r = el.getBoundingClientRect(); const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0; return d < best.d ? { el, d } : best; }, { el: editors[0], d: Infinity }).el;
  editor.focus();
  const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
}

// The record exactly as printed: A4 landscape, scaled to fit the screen.
export function PageView({ cell, settings, signatures, fontPt, zoom = "fit", attendees, font = "arial", signSlot = "", onSign, meId = "", onUpdate, att, lang = "en", title }) {
  const T = textFor(lang);
  const upd = (slot) => (meId && signatures[slot]?.admin === meId ? onUpdate : null);
  const wrap = useRef(null);
  const page = useRef(null);
  const [scale, setScale] = useState(1);
  // The page is A4 (794 px tall) but grows when its text needs more room (Urdu Nastaleeq is taller), so
  // nothing is ever cut off; the area around it follows the page's real height.
  const [pageH, setPageH] = useState(794);
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return undefined;
    const fit = () => setScale(zoom === "fit" ? Math.min(1.25, el.clientWidth / 1123) : Number(zoom));
    fit();
    const observer = new ResizeObserver(fit); observer.observe(el);
    return () => observer.disconnect();
  }, [zoom]);
  useLayoutEffect(() => {
    const el = page.current; if (!el) return undefined;
    const measure = () => setPageH(Math.max(794, el.offsetHeight));
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const c = (key, extra) => <RichCell {...cell(key)} {...extra} />;
  return <div ref={wrap} className={`cr-stage ${zoom !== "fit" ? "is-zoomed" : ""}`} style={{ height: pageH * scale + (zoom !== "fit" ? 14 : 0) }}>
    <div className="cr-sizer" style={{ width: 1123 * scale, height: pageH * scale }}>
    <div ref={page} className={`cr-page ${T.rtl ? "is-rtl pf-urdu" : `pf-${font}`}`} dir={T.rtl ? "rtl" : "ltr"} lang={T.rtl ? "ur" : "en"} style={{ transform: `scale(${scale})`, "--fs": `${(fontPt || 9) * 1.3333}px` }}>
      {settings.watermarkUrl && <img className="cr-watermark" src={settings.watermarkUrl} alt="" style={{ opacity: Math.min(0.5, (settings.watermarkOpacity || 0.12) * 2.2) }} />}
      <h2 className="cr-title">{title || settings.title}</h2>
      <div className="cr-topline">
        <span><b>{T.week}</b>{c("week", { single: true, className: "cr-u" })}</span>
        <span><b>{T.className}</b>{c("className", { single: true, className: "cr-u" })}</span>
        <span><b>{T.sections}</b>{c("sections", { single: true, className: "cr-u" })}</span>
      </div>
      <table className="cr-table" onClick={focusCellAt}>
        <colgroup>{WIDTHS.map((w, i) => <col key={i} style={{ width: `${(w / TOTAL) * 100}%` }} />)}</colgroup>
        <tbody>
          <tr><td colSpan={6} className="cr-subject">
            <div className="cr-subject-left"><div className="cr-inline"><b>{T.subject}</b>{c("subject", { single: true, className: "cr-u" })}</div><div className="cr-inline"><b>{T.periods}</b>{c("periods", { single: true })}</div></div>
            <div className="cr-inline cr-topic"><b>{T.topic}</b>{c("topic")}</div>
          </td></tr>
          <tr><td colSpan={6}><div className="cr-inline"><span>{T.broughtForward}</span>{c("broughtForward")}</div></td></tr>
          <tr className="cr-head">{COLUMNS.map(([column]) => <th key={column}>{T.columns[column]}</th>)}</tr>
          {DAYS.map(([day]) => <tr key={day} className="cr-day">{COLUMNS.map(([column], i) => <td key={column}>{i === 0 ? <><span className="cr-dayname">{T.days[day]}</span>{c(`${day}.period`, { placeholder: T.period })}</> : c(`${day}.${column}`)}</td>)}</tr>)}
          <tr><td colSpan={6}><div className="cr-inline">{T.rtl ? <span>{T.extraHelp}</span> : <i>{T.extraHelp}</i>}{c("extraHelp")}</div></td></tr>
          <tr><td colSpan={6}>
            <div className="cr-inline"><span>{T.teacher}</span>{c("teacher", { single: true })}</div>
            <div>{T.attendees}</div>
            <Attendees attendees={attendees} signatures={signatures} att={att} T={T} cellBox={(n) => c(`attendee${n}`, { single: true })} />
          </td></tr>
          <tr>
            <td colSpan={3}><div className="cr-inline"><span>{T.submitDate}</span>{c("submitDate", { single: true })}</div></td>
            <td colSpan={3}><div className="cr-inline"><span>{T.distributeDate}</span>{c("distributeDate", { single: true })}</div></td>
          </tr>
        </tbody>
      </table>
      <div className="cr-signs">
        <Signature title={T.signCoordinator} sig={signatures.coordinator} onSign={signSlot === "coordinator" ? onSign : null} onUpdate={upd("coordinator")} />
        <Signature title={T.signSectionHead} sig={signatures.sectionHead} onSign={signSlot === "sectionHead" ? onSign : null} onUpdate={upd("sectionHead")} />
        {(signatures.principal || signSlot === "principal") && <Signature title={T.signPrincipal} sig={signatures.principal} onSign={signSlot === "principal" ? onSign : null} onUpdate={upd("principal")} />}
      </div>
      {!T.rtl && settings.caption && <p className="cr-caption">{settings.caption}</p>}
      <div className="cr-foot"><span>{T.rtl ? "" : settings.footerText}</span></div>
    </div>
    </div>
  </div>;
}

// The same boxes as a simple form, for phones.
export function FormView({ cell, signatures, attendees, signSlot = "", onSign, meId = "", onUpdate, att, lang = "en" }) {
  const T = textFor(lang);
  const updateBtn = (slot) => (meId && onUpdate && signatures[slot]?.admin === meId ? <button type="button" onClick={onUpdate} className="mt-1 text-xs font-bold text-primary underline">Update my signature</button> : null);
  const signHere = (slot) => (signSlot === slot && onSign ? <button type="button" className="cr-sign-here !min-h-11" onClick={onSign}>Click to sign here</button> : <span className="text-sm text-slate-500">Not signed yet</span>);
  const box = (key, extra) => <div className="cf-field"><span className="cf-label">{T.labels[key]}</span><RichCell {...cell(key)} {...extra} /></div>;
  return <div className={`cf-form ${T.rtl ? "is-rtl" : ""}`} dir={T.rtl ? "rtl" : "ltr"} lang={T.rtl ? "ur" : "en"}>
    <section className="cf-card"><h3>{T.weekDetails}</h3><div className="cf-grid">{box("week", { single: true })}{box("className", { single: true })}{box("sections", { single: true })}{box("subject", { single: true })}{box("periods", { single: true })}</div>{box("topic")}{box("broughtForward")}</section>
    {DAYS.map(([day]) => <section key={day} className="cf-card"><h3>{T.days[day]}</h3>{COLUMNS.map(([column]) => <div key={column}>{box(`${day}.${column}`, column === "period" ? { single: true } : {})}</div>)}</section>)}
    <section className="cf-card"><h3>{T.afterPlan}</h3>{box("extraHelp")}{box("teacher", { single: true })}{attendees ? <div className="cf-field"><span className="cf-label">{T.attendees.replace(/:$/, "")}</span><ul className="cf-attendee-list">{attendees.map((person, i) => {
      const sig = attendeeSig(person, signatures);
      const action = attendeeAction(person, sig, att);
      return <li key={`${person.id || person.slot}-${i}`} className={sig ? "is-signed" : ""}>
        <span className="cf-att-num">{i + 1}</span>
        <span className="cf-att-name">{person.slot === "sectionHead" ? T.sectionHead : person.name}{person.id && person.id === att?.meId ? <em> (you)</em> : null}</span>
        <span className="cf-att-sig">{sig ? <img src={sig.imageUrl} alt={`Signature of ${sig.name}`} /> : <i>Not signed</i>}</span>
        {action && <button type="button" onClick={action.run} className={action.kind === "sign" ? "cf-att-btn is-sign" : "cf-att-btn"}>{action.kind === "sign" ? "Sign" : "Update"}</button>}
      </li>;
    })}</ul></div> : <div className="cf-grid">{[1, 2, 3, 4].map((n) => <div key={n}>{box(`attendee${n}`, { single: true })}</div>)}</div>}{box("submitDate", { single: true })}{box("distributeDate", { single: true })}</section>
    <section className="cf-card"><h3>{T.signatures}</h3><div className="cf-grid">
      <div className="cf-field"><span className="cf-label">{T.coordinator}</span>{signatures.coordinator?.imageUrl ? <><img className="cf-sig" src={signatures.coordinator.imageUrl} alt="Subject Coordinator's signature" />{updateBtn("coordinator")}</> : signHere("coordinator")}</div>
      <div className="cf-field"><span className="cf-label">{T.sectionHead}</span>{signatures.sectionHead?.imageUrl ? <><img className="cf-sig" src={signatures.sectionHead.imageUrl} alt="Section Head's signature" />{updateBtn("sectionHead")}</> : signHere("sectionHead")}</div>
      {(signatures.principal?.imageUrl || signSlot === "principal") && <div className="cf-field"><span className="cf-label">{T.principal}</span>{signatures.principal?.imageUrl ? <><img className="cf-sig" src={signatures.principal.imageUrl} alt="Principal's signature" />{updateBtn("principal")}</> : signHere("principal")}</div>}
    </div></section>
  </div>;
}
