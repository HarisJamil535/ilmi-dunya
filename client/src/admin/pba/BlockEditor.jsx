import { useRef, useState } from "react";
import { Columns3, ArrowDown, ArrowUp, Bold, Code2, Image as ImageIcon, Italic, List, ListOrdered, Minus, Plus, Table2, Tags, Trash2, Type, Underline, Upload } from "lucide-react";
import CustomSelect from "../../shared/CustomSelect";
import { RichText } from "../../shared/PbaContent";
import { Button, input } from "../paperMaker/ui";

const LANGS = [["javascript", "JavaScript"], ["html", "HTML"], ["css", "CSS"], ["python", "Python"], ["text", "Plain code"]].map(([value, label]) => ({ value, label }));
const SIZES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"]].map(([value, label]) => ({ value, label }));
const KIND = { text: ["Text", Type], code: ["Code", Code2], image: ["Picture", ImageIcon], gallery: ["Picture row", Columns3], table: ["Table", Table2], labelling: ["Labelling pictures", Tags] };
const move = (list, from, to) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };
const BLANK = { text: () => ({ type: "text", text: "" }), code: () => ({ type: "code", language: "javascript", code: "", caption: "" }), image: () => ({ type: "image", url: "", caption: "", alt: "", size: "medium" }), gallery: () => ({ type: "gallery", size: "medium", images: [{ url: "", caption: "" }, { url: "", caption: "" }] }), table: () => ({ type: "table", header: true, rows: [["", ""], ["", ""]] }), labelling: () => ({ type: "labelling", columns: ["Item", "Name", "Purpose"], items: [{ image: "", name: "", purpose: "" }, { image: "", name: "", purpose: "" }] }) };

// A picture picker that uploads through the function it is given (admins and teachers use different addresses).
function PictureField({ url, onChange, upload, label = "Picture", compact = false }) {
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (selected) => {
    if (!selected) return;
    setBusy(true); setError("");
    try { onChange(await upload(selected)); } catch (e) { setError(e.message || "The picture could not be uploaded."); } finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  return <div className={compact ? "flex flex-col items-stretch gap-2" : "flex flex-wrap items-center gap-3"}>
    {url ? <img src={url} alt="" className={`rounded-lg border border-slate-200 bg-white object-contain ${compact ? "h-20 w-full" : "h-16 w-24"}`} /> : <span className={`grid ${compact ? "h-20 w-full" : "h-16 w-24"} place-items-center rounded-lg bg-slate-100 text-slate-400`}><ImageIcon className="h-6 w-6" /></span>}
    <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => pick(e.target.files?.[0])} />
    <Button variant="secondary" icon={Upload} loading={busy} onClick={() => file.current?.click()}>{url ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}</Button>
    {url && <Button variant="ghost" onClick={() => onChange("")} aria-label={`Remove ${label.toLowerCase()}`}><Trash2 className="h-4 w-4" /></Button>}
    {error && <p role="alert" className="w-full text-xs font-bold text-rose-600">{error}</p>}
  </div>;
}

function TextEditor({ block, onChange }) {
  const area = useRef(null);
  const [preview, setPreview] = useState(false);
  // Wraps the selected words (or puts the marks where the cursor is) and keeps the cursor in the box.
  const wrap = (before, after = before) => {
    const el = area.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const next = `${value.slice(0, a)}${before}${value.slice(a, b) || "text"}${after}${value.slice(b)}`;
    onChange({ ...block, text: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + (b - a || 4)); });
  };
  // Starts each selected line with a bullet or a number.
  const prefix = (mark) => {
    const el = area.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const start = value.lastIndexOf("\n", a - 1) + 1; const endAt = value.indexOf("\n", b); const end = endAt === -1 ? value.length : endAt;
    const lines = value.slice(start, end).split("\n").map((line, i) => (mark === "-" ? `- ${line.replace(/^\s*(-|\d+[.)])\s+/, "")}` : `${i + 1}. ${line.replace(/^\s*(-|\d+[.)])\s+/, "")}`));
    onChange({ ...block, text: value.slice(0, start) + lines.join("\n") + value.slice(end) });
    requestAnimationFrame(() => el.focus());
  };
  const tool = "grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100";
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1" role="toolbar" aria-label="Text formatting">
      <button type="button" className={tool} title="Bold" aria-label="Bold" onClick={() => wrap("**")}><Bold className="h-4 w-4" /></button>
      <button type="button" className={tool} title="Italic" aria-label="Italic" onClick={() => wrap("*")}><Italic className="h-4 w-4" /></button>
      <button type="button" className={tool} title="Underline" aria-label="Underline" onClick={() => wrap("__")}><Underline className="h-4 w-4" /></button>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <button type="button" className={tool} title="Bullet list" aria-label="Bullet list" onClick={() => prefix("-")}><List className="h-4 w-4" /></button>
      <button type="button" className={tool} title="Numbered list" aria-label="Numbered list" onClick={() => prefix("1")}><ListOrdered className="h-4 w-4" /></button>
      <button type="button" className={tool} title="Blank line to fill in" aria-label="Blank line" onClick={() => wrap("", " __________ ")}><Minus className="h-4 w-4" /></button>
      <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview} className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-black ${preview ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}>Preview</button>
    </div>
    <textarea ref={area} className={`${input} min-h-24 py-2`} maxLength={4000} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder="Write the question text. Select words and use the buttons above to format them." aria-label="Text" />
    {preview && <div className="pbc rounded-xl border border-dashed border-slate-300 bg-white p-3"><RichText text={block.text || "Nothing to preview yet."} /></div>}
  </div>;
}

function CodeEditor({ block, onChange }) {
  const tab = (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const el = event.target; const { selectionStart: a, selectionEnd: b, value } = el;
    onChange({ ...block, code: `${value.slice(0, a)}  ${value.slice(b)}` });
    requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
  };
  return <div className="space-y-2">
    <div className="grid gap-2 sm:grid-cols-[200px_1fr]"><CustomSelect value={block.language} allowClear={false} onChange={(language) => onChange({ ...block, language })} options={LANGS} /><input className={input} maxLength={120} value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Heading above the code (optional)" aria-label="Code heading" /></div>
    <textarea className={`${input} min-h-36 py-2 font-mono text-[13px] leading-6`} spellCheck={false} maxLength={6000} value={block.code} onChange={(e) => onChange({ ...block, code: e.target.value })} onKeyDown={tab} placeholder={"let marks = [45, 90, 67];\nfor (let i = 0; i < marks.length; i++) {\n  // keep the spaces: this is shown exactly as typed\n}"} aria-label="Code" />
  </div>;
}

function TableEditor({ block, onChange }) {
  const rows = block.rows; const cols = rows[0]?.length || 1;
  const set = (r, c, value) => onChange({ ...block, rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)) });
  return <div className="space-y-2">
    <div className="overflow-x-auto"><table className="w-full border-collapse"><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className="p-0.5"><input className={`${input} min-h-10 ${block.header && r === 0 ? "font-black" : ""}`} value={cell} maxLength={200} onChange={(e) => set(r, c, e.target.value)} aria-label={`Row ${r + 1}, column ${c + 1}`} placeholder={block.header && r === 0 ? "Heading" : ""} /></td>)}</tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" className="min-h-9" icon={Plus} disabled={rows.length >= 14} onClick={() => onChange({ ...block, rows: [...rows, Array(cols).fill("")] })}>Row</Button>
      <Button variant="secondary" className="min-h-9" icon={Plus} disabled={cols >= 6} onClick={() => onChange({ ...block, rows: rows.map((row) => [...row, ""]) })}>Column</Button>
      <Button variant="ghost" className="min-h-9" disabled={rows.length <= 1} onClick={() => onChange({ ...block, rows: rows.slice(0, -1) })}>Remove last row</Button>
      <Button variant="ghost" className="min-h-9" disabled={cols <= 1} onClick={() => onChange({ ...block, rows: rows.map((row) => row.slice(0, -1)) })}>Remove last column</Button>
      <label className="ml-auto flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={block.header} onChange={(e) => onChange({ ...block, header: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />First row is a heading</label>
    </div>
    <p className="text-xs text-slate-500">Leave a cell empty to give students a space to write in it.</p>
  </div>;
}

function LabellingEditor({ block, onChange, upload }) {
  const setItem = (i, patch) => onChange({ ...block, items: block.items.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-3">{block.columns.map((column, i) => <input key={i} className={`${input} font-black`} maxLength={30} value={column} onChange={(e) => onChange({ ...block, columns: block.columns.map((c, j) => (j === i ? e.target.value : c)) })} aria-label={`Column ${i + 1} heading`} />)}</div>
    {block.items.map((item, i) => <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Picture {i + 1}</span><Button variant="danger" className="min-h-8" disabled={block.items.length <= 1} aria-label={`Remove picture ${i + 1}`} onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>
      <PictureField url={item.image} upload={upload} onChange={(url) => setItem(i, { image: url })} />
      <div className="grid gap-2 sm:grid-cols-2"><input className={input} maxLength={120} value={item.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Answer: name (for the answer key)" aria-label={`Picture ${i + 1} name`} /><input className={input} maxLength={240} value={item.purpose} onChange={(e) => setItem(i, { purpose: e.target.value })} placeholder="Answer: purpose (for the answer key)" aria-label={`Picture ${i + 1} purpose`} /></div>
    </div>)}
    <Button variant="secondary" icon={Plus} disabled={block.items.length >= 10} onClick={() => onChange({ ...block, items: [...block.items, { image: "", name: "", purpose: "" }] })}>Add a picture</Button>
    <p className="text-xs text-slate-500">Students see the pictures with empty Name and Purpose boxes. The answers appear only in the answer key.</p>
  </div>;
}

// One to four pictures in a single row. Each slot has its own upload and caption; the row is laid out evenly.
function GalleryEditor({ block, onChange, upload }) {
  const setImage = (i, patch) => onChange({ ...block, images: block.images.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
  const count = block.images.length;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Pictures in the row" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">{[1, 2, 3, 4].map((n) => <button key={n} type="button" role="radio" aria-checked={count === n} onClick={() => onChange({ ...block, images: Array.from({ length: n }, (_, i) => block.images[i] || { url: "", caption: "" }) })} className={`h-9 min-w-9 rounded-lg px-3 text-sm font-black ${count === n ? "bg-white text-primary-dark shadow-sm" : "text-slate-600"}`}>{n}</button>)}</div>
      <span className="text-xs font-bold text-slate-500">pictures in the row</span>
      <div className="ml-auto w-36"><CustomSelect value={block.size} allowClear={false} onChange={(size) => onChange({ ...block, size })} options={SIZES} /></div>
    </div>
    <div className={`grid gap-2.5 ${count > 2 ? "sm:grid-cols-4 grid-cols-2" : count === 2 ? "grid-cols-2" : "grid-cols-1"}`}>{block.images.map((item, i) => <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-2.5">
      <span className="block text-[11px] font-black uppercase tracking-wide text-slate-500">Picture {i + 1}</span>
      <PictureField url={item.url} upload={upload} onChange={(url) => setImage(i, { url })} label="picture" compact />
      <input className={input} maxLength={120} value={item.caption} onChange={(e) => setImage(i, { caption: e.target.value })} placeholder="Caption (optional)" aria-label={`Picture ${i + 1} caption`} />
    </div>)}</div>
    <p className="text-xs text-slate-500">The pictures sit side by side on the paper. On a phone screen they wrap two by two.</p>
  </div>;
}

// Builds a question out of text, code, pictures, tables and labelling pictures, in any order.
export default function BlockEditor({ blocks, onChange, upload, label = "content" }) {
  const set = (i, block) => onChange(blocks.map((b, j) => (j === i ? block : b)));
  return <div className="space-y-3">
    {blocks.map((block, i) => { const [name, Icon] = KIND[block.type]; return <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2.5 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="h-4 w-4" /></span><span className="text-sm font-black text-slate-800">{name}</span>
        <span className="ml-auto flex">
          <button type="button" disabled={i === 0} onClick={() => onChange(move(blocks, i, i - 1))} aria-label={`Move ${name} up`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" disabled={i === blocks.length - 1} onClick={() => onChange(move(blocks, i, i + 1))} aria-label={`Move ${name} down`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label={`Delete ${name}`} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></span></div>
      {block.type === "text" && <TextEditor block={block} onChange={(next) => set(i, next)} />}
      {block.type === "code" && <CodeEditor block={block} onChange={(next) => set(i, next)} />}
      {block.type === "image" && <div className="space-y-2"><PictureField url={block.url} upload={upload} onChange={(url) => set(i, { ...block, url })} />
        <div className="grid gap-2 sm:grid-cols-[1fr_160px]"><input className={input} maxLength={120} value={block.caption} onChange={(e) => set(i, { ...block, caption: e.target.value })} placeholder="Caption (optional)" aria-label="Caption" /><CustomSelect value={block.size} allowClear={false} onChange={(size) => set(i, { ...block, size })} options={SIZES} /></div></div>}
      {block.type === "gallery" && <GalleryEditor block={block} upload={upload} onChange={(next) => set(i, next)} />}
      {block.type === "table" && <TableEditor block={block} onChange={(next) => set(i, next)} />}
      {block.type === "labelling" && <LabellingEditor block={block} upload={upload} onChange={(next) => set(i, next)} />}
    </div>; })}
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Add to the ${label}`}>
      {Object.entries(KIND).map(([type, [name, Icon]]) => <Button key={type} variant="secondary" className="min-h-9" icon={Icon} onClick={() => onChange([...blocks, BLANK[type]()])}>{name}</Button>)}
    </div>
  </div>;
}
