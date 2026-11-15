import { io } from "socket.io-client";

// One shared live connection for the whole Coordination area (the week editor and the announcement bell use
// the same one). It starts with ordinary HTTPS requests, which every host and proxy allows, and upgrades to a
// WebSocket only where that works. If the server cannot be reached it backs off (up to a minute between tries)
// and stops after a while, so a blocked or sleeping server is never flooded with requests — hosting firewalls
// treat such floods as an attack and block the visitor's address.
let socket = null;
let users = 0;

export function acquireSocket() {
  if (!socket) {
    socket = io("/coordination", {
      path: "/api/live",
      auth: (cb) => cb({ token: localStorage.getItem("adminToken") }),
      reconnectionDelay: 3000,
      reconnectionDelayMax: 60000,
      randomizationFactor: 0.5,
      reconnectionAttempts: 12,
      timeout: 20000,
    });
    // Try again when the person comes back to the tab, after the attempts above have run out.
    const revive = () => { if (socket && !socket.connected && document.visibilityState === "visible") socket.connect(); };
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("online", revive);
    socket.on("connect_error", (error) => { if (/sign in|session|access/i.test(error?.message || "")) socket.disconnect(); });
  }
  users += 1;
  return socket;
}

export function releaseSocket() {
  users = Math.max(0, users - 1);
  if (!users && socket) {
    const s = socket;
    // Wait a moment: moving between Coordination pages reuses the same connection.
    setTimeout(() => { if (!users && socket === s) { s.disconnect(); socket = null; } }, 4000);
  }
}
