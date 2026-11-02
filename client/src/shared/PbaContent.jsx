import { useState } from "react";
import { inline, paragraphs } from "./pbaMarkup";
import "./pba-content.css";

const LANGUAGE = { javascript: "JavaScript", html: "HTML", css: "CSS", python: "Python", text: "Code" };

export function Runs({ runs }) {
  return runs.map((run, i) => { let node = run.text; if (run.underline) node = <u>{node}</u>; if (run.italic) node = <em>{node}</em>; if (run.bold) node = <strong>{node}</strong>; return <span key={i}>{node}</span>; });
}

// Text with the small markup: bold, italic, underline, bullets and numbered lines.
export function RichText({ text }) {
  return paragraphs(text).map((item, i) => item.type === "p" ? <p key={i}><Runs runs={item.runs} /></p>
    : item.type === "ul" ? <ul key={i}>{item.items.map((entry, j) => <li key={j}><Runs runs={entry.runs} /></li>)}</ul>
      : <ol key={i} start={item.items[0]?.number || 1}>{item.items.map((entry, j) => <li key={j}><Runs runs={entry.runs} /></li>)}</ol>);
}

function Code({ block }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(block.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* copying is optional */ } };
  return <figure className="pbc-code"><figcaption><span>{block.caption || LANGUAGE[block.language] || "Code"}</span><button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button></figcaption><pre><code>{block.code}</code></pre></figure>;
}

// Shows a list of content blocks. `reveal` fills in the answers of labelling tables.
export function Blocks({ blocks = [], reveal = false }) {
  if (!blocks.length) return null;
  return <div className="pbc">{blocks.map((block, i) => {
    if (block.type === "text") return <div key={i} className="pbc"><RichText text={block.text} /></div>;
    if (block.type === "code") return <Code key={i} block={block} />;
    if (block.type === "image") return <figure key={i} className={`pbc-figure is-${block.size || "medium"}`}><img src={block.url} alt={block.alt || block.caption || ""} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (block.type === "table") return <div key={i} className="pbc-table-wrap"><table className="pbc-table">{block.header && <thead><tr>{block.rows[0].map((cell, c) => <th key={c}>{cell}</th>)}</tr></thead>}<tbody>{block.rows.slice(block.header ? 1 : 0).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className={cell ? "" : "is-blank"}>{cell ? <RichInline text={cell} /> : null}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === "labelling") return <div key={i} className="pbc-table-wrap"><table className="pbc-table"><thead><tr>{block.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{block.items.map((item, r) => <tr key={r}><td>{item.image ? <img src={item.image} alt="" loading="lazy" /> : null}</td><td className={reveal ? "" : "is-blank"}>{reveal ? item.name : null}</td><td className={reveal ? "" : "is-blank"}>{reveal ? item.purpose : null}</td></tr>)}</tbody></table></div>;
    return null;
  })}</div>;
}

const RichInline = ({ text }) => <Runs runs={inline(text)} />;
