import { useCallback, useState } from "react";

// What the student has finished, kept on this device only; shared by the PBA list and the video page.
export function useProgress(subjectId) {
  const key = `pba-progress:${subjectId}`;
  const [done, setDone] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); } });
  const toggle = useCallback((id, force) => setDone((current) => {
    const next = new Set(current);
    const want = force === undefined ? !next.has(id) : force;
    if (want) next.add(id); else next.delete(id);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* progress is a convenience; ignore storage errors */ }
    return next;
  }), [key]);
  return [done, toggle];
}
