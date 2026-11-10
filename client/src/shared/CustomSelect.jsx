import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import "./custom-select.css";

const CLOSE_MS = 120;

// The one dropdown used across the site. It opens in a layer above everything (so it is never cut off inside
// a card or dialog), flips upwards near the bottom of the screen, can be used with the keyboard
// (arrows, Home/End, Enter, Escape, and typing the first letters), and shows a search box for long lists.
const CustomSelect = ({ label, value = "", onChange, options = [], placeholder = "Select an option", disabled = false, id, className = "", searchable = false, allowClear = true, isLoading = false, size }) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listId = `${selectId}-list`;
  const [phase, setPhase] = useState("closed"); // closed | open | closing
  const [menuStyle, setMenuStyle] = useState(null);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(-1);
  const ref = useRef(null);
  const trigger = useRef(null);
  const menuRef = useRef(null);
  const typed = useRef({ text: "", at: 0 });
  const open = phase === "open";
  const selected = options.find((option) => String(option.value) === String(value));
  // Long lists get a search box; `searchable` turns it on for shorter lists too.
  const showSearch = options.length > 10 || (searchable && options.length > 6);
  const needle = filter.trim().toLowerCase();
  const visible = showSearch && needle ? options.filter((option) => String(option.label).toLowerCase().includes(needle)) : options;
  const rows = allowClear && !needle ? [{ value: "", label: placeholder, clear: true }, ...visible] : visible;
  const locked = disabled || isLoading;

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return null;
    const pad = 12, gap = 6;
    const below = window.innerHeight - rect.bottom - pad - gap;
    const above = rect.top - pad - gap;
    const up = below < 220 && above > below;
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - pad * 2);
    return {
      left: Math.max(pad, Math.min(rect.left, window.innerWidth - width - pad)),
      top: up ? undefined : rect.bottom + gap,
      bottom: up ? window.innerHeight - rect.top + gap : undefined,
      width,
      maxHeight: Math.max(140, Math.min(320, up ? above : below)),
      transformOrigin: up ? "bottom" : "top",
    };
  }, []);

  const close = useCallback((focusTrigger = false) => {
    setPhase((current) => (current === "open" ? "closing" : current));
    if (focusTrigger) trigger.current?.focus();
  }, [setPhase]);

  useEffect(() => {
    if (phase !== "closing") return undefined;
    const timer = setTimeout(() => setPhase("closed"), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!ref.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(); };
    const move = (event) => { if (event.type === "scroll" && menuRef.current?.contains(event.target)) return; setMenuStyle(place()); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", move);
    document.addEventListener("scroll", move, true);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", move); document.removeEventListener("scroll", move, true); };
  }, [open, place, close]);

  // Keeps the highlighted row in view while moving through the list with the keyboard.
  useLayoutEffect(() => {
    if (!open || active < 0) return;
    menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openMenu = () => {
    if (locked) return;
    setFilter("");
    setMenuStyle(place());
    const start = rows.findIndex((row) => !row.clear && String(row.value) === String(value));
    setActive(start >= 0 ? start : allowClear ? Math.min(1, rows.length - 1) : 0);
    setPhase("open");
  };

  const choose = (row) => { if (!row) return; onChange(row.clear ? "" : row.value); close(true); };

  const keys = (event) => {
    if (locked) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); openMenu(); }
      return;
    }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(0); }
    else if (event.key === "End") { event.preventDefault(); setActive(rows.length - 1); }
    else if (event.key === "Enter") { event.preventDefault(); choose(rows[active]); }
    else if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "Tab") close();
    else if (!showSearch && event.key.length === 1 && /\S/.test(event.key)) {
      // Typing jumps to the first option that starts with the typed letters.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + event.key.toLowerCase(), at: now };
      const hit = rows.findIndex((row) => !row.clear && String(row.label).toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  const small = size === "sm";
  return <div ref={ref} className={`relative ${className}`}>
    {label && <label htmlFor={selectId} className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</label>}
    {isLoading ? <div className={`cs-skeleton ${small ? "h-10" : "h-12"} w-full rounded-xl`} aria-hidden="true" />
      : <button ref={trigger} id={selectId} type="button" disabled={locked} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => (open ? close() : openMenu())} onKeyDown={keys}
        className={`cs-trigger ${open ? "is-open" : ""} flex ${small ? "min-h-10 px-3" : "min-h-12 px-4"} w-full items-center justify-between gap-3 rounded-xl border bg-white text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-55`}>
        <span className={selected ? "truncate" : "truncate font-medium text-slate-400"}>{selected?.label || placeholder}</span>
        <ChevronDown aria-hidden="true" className="cs-chevron h-4 w-4 shrink-0 text-slate-400" />
      </button>}
    {phase !== "closed" && menuStyle && createPortal(<div ref={menuRef} className={`cs-menu ${phase === "closing" ? "is-closing" : ""}`} style={menuStyle} onKeyDown={keys}>
      {showSearch && <div className="cs-search"><Search aria-hidden="true" className="h-4 w-4 text-slate-400" /><input type="search" autoFocus value={filter} onChange={(event) => { setFilter(event.target.value); setActive(0); }} placeholder="Search…" aria-label={`Search ${typeof label === "string" ? label : placeholder}`} aria-controls={listId} /></div>}
      <div id={listId} role="listbox" aria-label={typeof label === "string" ? label : placeholder} className="cs-list">
        {rows.length ? rows.map((row, index) => {
          const isSelected = !row.clear && String(row.value) === String(value);
          return <div key={row.clear ? "__clear" : row.value} data-index={index} role="option" aria-selected={isSelected} onPointerEnter={() => setActive(index)} onClick={() => choose(row)}
            className={`cs-option ${row.clear ? "is-clear" : ""} ${isSelected ? "is-selected" : ""} ${index === active ? "is-active" : ""}`}>
            <span className="truncate">{row.label}</span>{isSelected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
          </div>;
        }) : <p className="cs-empty">{needle ? "No matches" : "Nothing to choose yet"}</p>}
      </div>
    </div>, document.body)}
  </div>;
};

export default CustomSelect;
