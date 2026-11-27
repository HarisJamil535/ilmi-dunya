import { useLayoutEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

// One editable box of the record. The text is managed by the browser (contenteditable) while the person
// types; changes from other people replace it only when this box is not being edited here.
export default function RichCell({ cellKey, html, editable, holder, single = false, placeholder = "", comments = 0, onFocusCell, onInputCell, onBlurCell, onComments, className = "", label, dir }) {
  const ref = useRef(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (html || "")) {
      el.innerHTML = html || "";
      // Someone else's change arrived: a short glow shows where.
      if (!first.current) { el.classList.remove("cr-flash"); void el.offsetWidth; el.classList.add("cr-flash"); }
    }
    first.current = false;
  }, [html]);
  const locked = Boolean(holder);
  const keyDown = (e) => {
    if (single && e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
    if (e.key === "Escape") e.currentTarget.blur();
  };
  // Pasted text keeps simple formatting only: the server removes anything else when it saves.
  const paste = (e) => {
    if (!single) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " "));
  };
  return <div className={`cr-cell ${locked ? "is-locked" : ""} ${className}`} style={locked ? { "--holder": holder.colour } : undefined}>
    {locked && <span className="cr-holder" style={{ background: holder.colour }}>{holder.name} is editing</span>}
    <div
      ref={ref}
      role="textbox"
      aria-label={label}
      aria-multiline={!single}
      data-cell={cellKey}
      dir={dir}
      data-placeholder={placeholder}
      contentEditable={editable && !locked}
      suppressContentEditableWarning
      spellCheck
      className={`cr-edit ${single ? "is-single" : ""}`}
      onFocus={(e) => onFocusCell?.(cellKey, e.currentTarget)}
      onInput={(e) => onInputCell?.(cellKey, e.currentTarget)}
      onBlur={(e) => onBlurCell?.(cellKey, e.currentTarget)}
      onKeyDown={keyDown}
      onPaste={paste}
    />
    {comments > 0 && <button type="button" className="cr-badge" onMouseDown={(e) => e.preventDefault()} onClick={() => onComments?.(cellKey)} aria-label={`${comments} open comments on ${label}`}><MessageSquare className="h-3 w-3" />{comments}</button>}
  </div>;
}
