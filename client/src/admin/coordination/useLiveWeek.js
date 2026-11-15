import { useEffect, useRef, useState } from "react";
import { acquireSocket, releaseSocket } from "./liveSocket";

// Live connection to one week: who is here, which cell each person is typing in, and changes from others.
// Socket.IO falls back to ordinary requests where WebSockets are blocked, so it works behind most proxies.
export function useLiveWeek(weekId, handlers) {
  const [status, setStatus] = useState("connecting"); // connecting | live | offline
  const [people, setPeople] = useState([]);
  const [me, setMe] = useState("");
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    if (!weekId) return undefined;
    const socket = acquireSocket();
    socketRef.current = socket;
    const join = () => socket.emit("join", { weekId }, (reply) => {
      if (reply?.ok) { setStatus("live"); setMe(reply.me); handlersRef.current.onJoined?.(); }
      else { setStatus("offline"); handlersRef.current.onError?.(reply?.message); }
    });
    const offline = () => setStatus("offline");
    const connecting = () => setStatus("connecting");
    const handlers = { connect: join, disconnect: offline, connect_error: offline, presence: setPeople };
    for (const event of ["cell", "comment", "comment-deleted", "activity", "status", "reload", "meta", "deleted", "ended"]) {
      handlers[event] = (payload) => handlersRef.current[`on${event.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`]?.(payload);
    }
    for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);
    socket.io.on("reconnect_attempt", connecting);
    if (socket.connected) join();
    return () => {
      socket.emit("leave");
      for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
      socket.io.off("reconnect_attempt", connecting);
      socketRef.current = null;
      releaseSocket();
    };
  }, [weekId]);

  const emit = (event, payload) => new Promise((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) return resolve({ ok: false, offline: true });
    socket.timeout(8000).emit(event, payload, (error, reply) => resolve(error ? { ok: false, offline: true } : reply || { ok: true }));
  });
  const send = (event, payload) => socketRef.current?.connected && socketRef.current.emit(event, payload);
  return { status, people, me, emit, send };
}
