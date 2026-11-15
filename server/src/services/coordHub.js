// Holds the live connection (Socket.IO namespace) so routes can tell everyone viewing a week what changed.
let namespace = null;
const room = (weekId) => `week:${weekId}`;
module.exports = {
    attach(ns) { namespace = ns; },
    emit(weekId, event, payload) { namespace?.to(room(weekId)).emit(event, payload); },
    room,
};
