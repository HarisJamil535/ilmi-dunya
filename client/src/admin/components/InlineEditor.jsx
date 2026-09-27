import { useEffect, useRef } from "react";

export default function InlineEditor({ children }) {
    const ref = useRef(null);
    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        ref.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
    }, []);
    return <section ref={ref} className="admin-inline-editor-section" aria-label="Add or edit academic content">{children}</section>;
}
