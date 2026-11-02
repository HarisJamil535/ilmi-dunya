import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function ModalViewport({ children, onClose, busy = false }) {
  const [viewport, setViewport] = useState(null);
  const root = useRef(null);
  // The latest close handler and busy flag, read from refs so the setup below runs once per opening.
  // (Re-running it on every render moved focus back to an earlier field while the user was typing.)
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; });
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => setViewport({ top: window.visualViewport?.offsetTop || 0, height: window.visualViewport?.height || window.innerHeight });
    const keyboard = (event) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current?.();
      if (event.key !== "Tab") return;
      const elements = [...root.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')];
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    update();
    window.addEventListener("keydown", keyboard);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<div ref={root} role="dialog" aria-modal="true" className="admin-modal-viewport fixed inset-x-0 z-[100] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-5" style={{ top: viewport?.top || 0, height: viewport?.height || "100dvh" }}>{children}</div>, document.body);
}
