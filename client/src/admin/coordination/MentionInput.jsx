import { useRef, useState } from "react";
import { Users } from "lucide-react";
import { Avatar, RoleBadge } from "./CoordUI";
import { ALL_MENTION } from "./coordApi";

// A text box where typing "@" lists the people who can see this week; picking one inserts "@Name".
export default function MentionInput({ value, onChange, people = [], multiline = false, onEnter, className = "", below = false, ...props }) {
  const ref = useRef(null);
  const [query, setQuery] = useState(null); // text typed after "@", or null when the list is closed
  const [active, setActive] = useState(0);
  const everyone = query !== null && "all".startsWith(query.toLowerCase()) ? [ALL_MENTION] : [];
  const matches = query === null ? [] : [...everyone, ...people.filter((p) => p.name.toLowerCase().replace(/^(mr|ms|mrs|miss|dr|sir|madam)\.?\s+/, "").includes(query.toLowerCase()) || p.name.toLowerCase().includes(query.toLowerCase()))].slice(0, 7);

  const update = (text, caret) => {
    onChange(text);
    const before = text.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]{0,20}(?:\s[^\s@]{0,20})?)$/.exec(before);
    setQuery(m ? m[1] : null);
    setActive(0);
  };
  const pick = (person) => {
    const el = ref.current;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([^\s@]{0,20}(?:\s[^\s@]{0,20})?)$/, `@${person.name} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(before.length, before.length); });
  };
  const keys = (e) => {
    if (query !== null && matches.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % matches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + matches.length) % matches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[active]); return; }
      if (e.key === "Escape") { setQuery(null); return; }
    }
    if (e.key === "Enter" && !multiline && onEnter) { e.preventDefault(); onEnter(); }
  };
  const Tag = multiline ? "textarea" : "input";
  return <div className="relative min-w-0 flex-1">
    <Tag ref={ref} value={value} onChange={(e) => update(e.target.value, e.target.selectionStart)} onKeyDown={keys} onBlur={() => setTimeout(() => setQuery(null), 150)} className={className} {...props} />
    {query !== null && matches.length > 0 && <div className={`mention-menu ${below ? "is-below" : ""}`} role="listbox">
      <p className="px-2 pb-1 pt-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-slate-500">Mention someone</p>
      {matches.map((p, i) => <button key={p.id} type="button" role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(p); }} className={i === active ? "is-active" : ""}>
        {p.id === "all" ? <><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pink-600 text-white"><Users className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1 text-left"><b>@all</b><span className="block text-[11px] font-medium text-slate-500">Everyone in this department and the Section Head</span></span></>
          : <><Avatar name={p.name} size={24} /><span className="min-w-0 flex-1 truncate text-left">{p.name}</span><RoleBadge role={p.title === "teacher" ? "teacher" : p.title} small /></>}
      </button>)}
    </div>}
  </div>;
}

