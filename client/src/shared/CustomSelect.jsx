import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

const CustomSelect = ({ label, value = "", onChange, options = [], placeholder = "Select an option", disabled = false, id, className = "" }) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value));

  const getMenuStyle = useCallback(() => {
    const trigger = ref.current?.querySelector("button");
    if (!trigger) return null;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const menuGap = 8;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap;
    const availableAbove = rect.top - viewportPadding - menuGap;
    const opensAbove = availableBelow < 180 && availableAbove > availableBelow;
    const availableSpace = opensAbove ? availableAbove : availableBelow;

    return {
      left: Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - rect.width - viewportPadding)),
      top: opensAbove ? undefined : rect.bottom + menuGap,
      bottom: opensAbove ? window.innerHeight - rect.top + menuGap : undefined,
      width: Math.min(rect.width, window.innerWidth - viewportPadding * 2),
      maxHeight: Math.max(120, Math.min(256, availableSpace)),
    };
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handleViewportChange = (event) => {
      if (event.type === "scroll" && menuRef.current?.contains(event.target)) return;
      setMenuStyle(getMenuStyle());
    };

    window.addEventListener("resize", handleViewportChange);
    document.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      document.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [getMenuStyle, open]);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setMenuStyle(getMenuStyle());
    setOpen(true);
  };

  return <div ref={ref} className={`relative ${className}`}>
    {label && <label htmlFor={selectId} className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</label>}
    <button id={selectId} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={toggleMenu} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-bold text-slate-700 shadow-sm transition hover:border-primary-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50">
      <span className={selected ? "truncate text-slate-800" : "truncate text-slate-400"}>{selected?.label || placeholder}</span>
      <ChevronDown className={`ml-3 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
    </button>
    {open && menuStyle && createPortal(<div ref={menuRef} role="listbox" aria-label={typeof label === "string" ? label : placeholder} style={menuStyle} className="fixed z-[200] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15 animate-in fade-in slide-in-from-top-2">
      <button type="button" role="option" aria-selected={!selected} onClick={() => { onChange(""); setOpen(false); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-primary-soft">{placeholder}</button>
      {options.length ? options.map((option) => <button type="button" role="option" aria-selected={String(option.value) === String(value)} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${String(option.value) === String(value) ? "bg-primary-soft font-bold text-primary-dark" : "text-slate-700 hover:bg-slate-50"}`}><span className="truncate">{option.label}</span>{String(option.value) === String(value) && <Check className="h-4 w-4 shrink-0 text-primary" />}</button>) : <p className="px-3 py-2.5 text-sm text-slate-400">No options available</p>}
    </div>, document.body)}
  </div>;
};

export default CustomSelect;
