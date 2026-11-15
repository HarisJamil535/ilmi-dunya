const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const Admin = require("../models/Admin");
const { canUseArea } = require("./coordAccess");
const { accessWeek, saveCell } = require("./coordService");
const { toHtml } = require("./coordRichText");
const { KEYS } = require("./coordTemplate");
const hub = require("./coordHub");

// Live editing for coordination weeks.
// Everyone viewing a week joins its room. The room knows who is there and which cell each person is typing
// in; a cell someone is typing in is held for them (others see their name on it) until they leave it, go
// quiet for 45 seconds, or disconnect. Edits are saved and sent to everyone else in the room at once.
const HOLD_MS = 45 * 1000;
const COLOURS = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#16a34a", "#2563eb", "#ca8a04", "#9333ea", "#0d9488", "#dc2626"];
const presence = new Map(); // weekId -> Map(socketId -> { adminId, name, colour, cell, at })

const colourFor = (id) => COLOURS[[...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLOURS.length];
const peopleIn = (weekId) => [...(presence.get(String(weekId)) || new Map()).entries()].map(([socketId, p]) => ({ socketId, adminId: p.adminId, name: p.name, colour: p.colour, cell: p.cell && Date.now() - p.at < HOLD_MS ? p.cell : "" }));
const holderOf = (weekId, cell, exceptSocket) => peopleIn(weekId).find((p) => p.cell === cell && p.socketId !== exceptSocket);

async function authenticate(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error("Sign in again."));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!["admin", "super_admin"].includes(decoded.role) || !decoded.sid) return next(new Error("Admin sign-in required."));
        const admin = await Admin.findById(decoded.id).select("-password +currentSessionId");
        if (!admin || admin.status !== "active" || admin.currentSessionId !== decoded.sid) return next(new Error("This session has ended. Sign in again."));
        if (!canUseArea(admin)) return next(new Error("You do not have access to coordination files."));
        socket.data.admin = admin;
        next();
    } catch { next(new Error("Sign in again.")); }
}

function attachCoordinationSocket(httpServer) {
    const io = new Server(httpServer, {
        path: "/api/live",
        serveClient: false,
        cors: { origin: false },
        pingInterval: 20000,
        pingTimeout: 25000,
        maxHttpBufferSize: 200 * 1024,
    });
    const ns = io.of("/coordination");
    ns.use(authenticate);
    hub.attach(ns);

    const broadcastPresence = (weekId) => ns.to(hub.room(weekId)).emit("presence", peopleIn(weekId));
    const leave = (socket) => {
        const weekId = socket.data.weekId;
        if (!weekId) return;
        presence.get(weekId)?.delete(socket.id);
        if (!presence.get(weekId)?.size) presence.delete(weekId);
        socket.leave(hub.room(weekId));
        socket.data.weekId = null;
        broadcastPresence(weekId);
    };
    // The session may end (signed in elsewhere, account disabled) while the socket is open.
    const stillValid = async (socket) => {
        const admin = await Admin.findById(socket.data.admin._id).select("+currentSessionId status name permissions role signatureUrl coordTitle coordDepartment");
        if (!admin || admin.status !== "active" || admin.currentSessionId !== socket.data.admin.currentSessionId) { socket.emit("ended", "Your session has ended. Sign in again."); socket.disconnect(true); return null; }
        socket.data.admin = admin;
        return admin;
    };

    ns.on("connection", (socket) => {
        socket.on("join", async ({ weekId } = {}, reply = () => {}) => {
            try {
                leave(socket);
                const admin = await stillValid(socket); if (!admin) return;
                await accessWeek(weekId, admin);
                const id = String(weekId);
                socket.data.weekId = id;
                socket.join(hub.room(id));
                if (!presence.has(id)) presence.set(id, new Map());
                presence.get(id).set(socket.id, { adminId: String(admin._id), name: admin.name, colour: colourFor(admin._id), cell: "", at: Date.now() });
                reply({ ok: true, me: socket.id });
                broadcastPresence(id);
            } catch (error) { reply({ ok: false, message: error.message }); }
        });

        socket.on("focus", ({ cell } = {}, reply = () => {}) => {
            const weekId = socket.data.weekId; const me = presence.get(weekId)?.get(socket.id);
            if (!me || !KEYS.has(cell)) return reply({ ok: false });
            const holder = holderOf(weekId, cell, socket.id);
            if (holder && holder.adminId !== me.adminId) return reply({ ok: false, holder: holder.name });
            me.cell = cell; me.at = Date.now();
            reply({ ok: true });
            broadcastPresence(weekId);
        });

        socket.on("blur", () => {
            const weekId = socket.data.weekId; const me = presence.get(weekId)?.get(socket.id);
            if (!me) return;
            me.cell = ""; broadcastPresence(weekId);
        });

        socket.on("edit", async ({ cell, html } = {}, reply = () => {}) => {
            const weekId = socket.data.weekId; const me = presence.get(weekId)?.get(socket.id);
            if (!me) return reply({ ok: false, message: "Reconnecting…" });
            const holder = holderOf(weekId, cell, socket.id);
            if (holder && holder.adminId !== me.adminId) return reply({ ok: false, message: `${holder.name} is editing this box.` });
            try {
                const { week, paragraphs, changed } = await saveCell({ weekId, admin: socket.data.admin, key: cell, content: typeof html === "string" ? html : "" });
                me.cell = cell; me.at = Date.now();
                reply({ ok: true, rev: week.rev });
                if (changed) socket.to(hub.room(weekId)).emit("cell", { cell, html: toHtml(paragraphs), rev: week.rev, by: me.name, byId: me.adminId });
            } catch (error) { reply({ ok: false, message: error.message, status: error.status }); }
        });

        socket.on("leave", () => leave(socket));
        socket.on("disconnect", () => leave(socket));
    });

    // Releases cells held by people who went quiet.
    setInterval(() => {
        for (const [weekId, people] of presence) {
            let changed = false;
            for (const p of people.values()) if (p.cell && Date.now() - p.at > HOLD_MS) { p.cell = ""; changed = true; }
            if (changed) broadcastPresence(weekId);
        }
    }, 15000).unref();
    return io;
}

module.exports = { attachCoordinationSocket };
