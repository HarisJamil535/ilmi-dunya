import { useEffect, useRef } from "react";
import { acquireSocket, releaseSocket } from "./liveSocket";

// Listens to a live event on the shared Coordination connection, for as long as the component is on screen.
export function useCoordEvent(event, handler) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const socket = acquireSocket();
    const fn = (payload) => ref.current?.(payload);
    socket.on(event, fn);
    return () => { socket.off(event, fn); releaseSocket(); };
  }, [event]);
}

// Calls `reload` shortly after something changes in Coordination (another person's edit, a new week, a
// signature...), so lists stay current without refreshing the page. `fileId` limits it to one file.
export function useLiveRefresh(reload, fileId) {
  const timer = useRef(null);
  useCoordEvent("coord-changed", (payload) => {
    if (fileId && payload?.fileId !== fileId) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => reload(), 600);
  });
  useEffect(() => () => clearTimeout(timer.current), []);
}
