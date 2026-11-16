// Holds the live connection (Socket.IO namespace) so routes can tell everyone viewing a week what changed.
let namespace = null;
const room = (weekId) => `week:${weekId}`;
module.exports = {
    attach(ns) { namespace = ns; },
    emit(weekId, event, payload) { namespace?.to(room(weekId)).emit(event, payload); },
    // Announcements go to everyone ("ann:all") or to coordinators, the Section Head and the Principal ("ann:coordinators").
    emitRoom(name, event, payload) { namespace?.to(name).emit(event, payload); },
    // Personal events (notifications) go to every open tab of that person.
    emitUser(adminId, event, payload) { namespace?.to(`user:${adminId}`).emit(event, payload); },
    // "Something in this file changed": list pages refresh quietly. Sent at most every 2 seconds per file.
    changed(fileId) {
        if (!namespace || !fileId) return;
        const key = String(fileId);
        if (pending.has(key)) return;
        pending.add(key);
        setTimeout(() => { pending.delete(key); namespace?.emit("coord-changed", { fileId: key }); }, 2000).unref?.();
    },
    room,
};
const pending = new Set();
