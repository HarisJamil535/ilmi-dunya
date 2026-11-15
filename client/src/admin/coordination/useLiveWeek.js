import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

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
    const socket = io("/coordination", { path: "/api/live", auth: { token: localStorage.getItem("adminToken") }, transports: ["websocket", "polling"], reconnectionDelayMax: 8000 });
    socketRef.current = socket;
    const join = () => socket.emit("join", { weekId }, (reply) => {
      if (reply?.ok) { setStatus("live"); setMe(reply.me); handlersRef.current.onJoined?.(); }
      else { setStatus("offline"); handlersRef.current.onError?.(reply?.message); }
    });
    socket.on("connect", join);
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("connect_error", () => setStatus("offline"));
    socket.io.on("reconnect_attempt", () => setStatus("connecting"));
    socket.on("presence", setPeople);
    for (const event of ["cell", "comment", "comment-deleted", "activity", "status", "reload", "meta", "deleted", "ended"]) {
      socket.on(event, (payload) => handlersRef.current[`on${event.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`]?.(payload));
    }
    return () => { socket.emit("leave"); socket.disconnect(); socketRef.current = null; };
  }, [weekId]);

  const emit = (event, payload) => new Promise((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) return resolve({ ok: false, offline: true });
    socket.timeout(8000).emit(event, payload, (error, reply) => resolve(error ? { ok: false, offline: true } : reply || { ok: true }));
  });
  const send = (event, payload) => socketRef.current?.connected && socketRef.current.emit(event, payload);
  return { status, people, me, emit, send };
}
