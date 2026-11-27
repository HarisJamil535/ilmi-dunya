const mongoose = require("mongoose");
const QRCode = require("qrcode");
const { readImage } = require("./mediaStore");
const { fadeImage } = require("./watermark");
const { flatCells, plainText } = require("./coordService");
const { fromText } = require("./coordRichText");
const Admin = require("../models/Admin");
const { fileTitle, departmentNameOf } = require("./coordSubjects");
const { displayName } = require("./coordPeople");
const { tintSignature } = require("./signatureImage");
const { languageOf, urduClass, urduSubject, URDU_TITLE } = require("./coordLang");
const inked = (image, ink, weight) => (image ? tintSignature(image, ink, weight) : null);

// The meeting's attendees: the Section Head, then the department's teachers, then its Subject Coordinator
// (as in the school's form: "1. Section Head  2. Ms. Ammara  3. Ms. Tahniyat"). Files without a department
// fall back to the names typed in the week.
async function attendeePeople(file) {
    if (!file.department) return null;
    const staff = await Admin.find({ coordDepartment: file.department?._id || file.department, coordTitle: { $in: ["teacher", "coordinator"] }, status: "active" }).select("name salutation coordTitle createdAt").sort({ createdAt: 1 }).lean();
    staff.sort((a, b) => Number(a.coordTitle === "coordinator") - Number(b.coordTitle === "coordinator"));
    return [{ id: "", name: "Section Head", slot: "sectionHead" }, ...staff.map((p) => ({ id: String(p._id), name: displayName(p), slot: p.coordTitle === "coordinator" ? "coordinator" : "member" }))];
}
async function attendeesOf(file) { const people = await attendeePeople(file); return people && people.map((p) => p.name); }

// The signature beside each attendee: the Section Head's approval signature, the coordinator's submission
// signature (or their attendance signature), and each teacher's attendance signature.
function attendeeSignature(person, sig) {
    if (person.slot === "sectionHead") return sig.sectionHead?.imageUrl ? { ...sig.sectionHead, ink: "pink" } : null;
    const own = (sig.members || []).find((m) => String(m.admin) === person.id);
    if (own?.imageUrl) return { ...own, ink: "blue" };
    if (person.slot === "coordinator" && String(sig.coordinator?.admin || "") === person.id && sig.coordinator.imageUrl) return { ...sig.coordinator, ink: "blue" };
    return null;
}

// Prepares one week for printing: fills in what the system already knows (week, class, subject,
// sections, signer names) when the cell is empty, and loads the pictures (watermark, signatures, QR).
const fill = (paragraphs, text) => (plainText(paragraphs) ? paragraphs : fromText(text || ""));
const classLabel = (name) => String(name || "").replace(/^class\s*/i, "").trim();
const siteOrigin = () => { try { return new URL(process.env.SITE_URL || "http://localhost:5000").origin; } catch { return "http://localhost:5000"; } };

async function pictureCache() {
    const cache = new Map();
    return async (url) => {
        if (!url) return null;
        if (!cache.has(url)) cache.set(url, readImage(url).catch(() => null));
        const buffer = await cache.get(url);
        // Only PNG and JPG can be printed in both Word and PDF.
        return buffer && (/^\x89PNG/.test(buffer.subarray(0, 4).toString("binary")) || (buffer[0] === 0xff && buffer[1] === 0xd8)) ? buffer : null;
    };
}

async function buildRecords(file, weeks, settings) {
    const picture = await pictureCache();
    const original = await picture(settings.watermarkUrl);
    let watermark = null;
    try { watermark = original ? fadeImage(original, Math.max(0.03, Math.min(0.4, settings.watermarkOpacity || 0.12))) : null; } catch { watermark = null; }
    const session = file.session;
    const people = await attendeePeople(file);
    const departmentAttendees = people && people.map((p) => p.name);
    const departmentId = file.department?._id || file.department;
    const department = departmentId ? await mongoose.model("CoordinationDepartment").findById(departmentId).select("name language").lean().catch(() => null) : null;
    const lang = languageOf(department);
    const title = fileTitle(file, department?.name || await departmentNameOf(file));
    if (lang === "ur") { title.className = urduClass(title.className); title.subject = urduSubject(title.subject); }
    const records = [];
    for (const [index, week] of weeks.entries()) {
        const cells = flatCells(week.cells);
        const sig = week.signatures || {};
        cells.week = fill(cells.week, `${week.week}${week.term ? ` (${week.term})` : ""}`);
        cells.className = fill(cells.className, title.className);
        cells.sections = fill(cells.sections, file.sections);
        cells.subject = fill(cells.subject, title.subject);
        const approved = week.status === "approved" && week.verifyCode;
        records.push({
            cells,
            font: week.font || "arial",
            attendees: departmentAttendees || [1, 2, 3, 4].map((n) => plainText(cells[`attendee${n}`])),
            status: week.status,
            lang,
            title: (lang === "ur" ? URDU_TITLE : settings.title || "").replace("{session}", session),
            footerText: lang === "ur" ? "" : (settings.footerText || "").replace("{session}", session),
            caption: lang === "ur" ? "" : settings.caption || "",
            watermarkOpacity: settings.watermarkOpacity,
            pageNumber: index + 1,
            pageCount: weeks.length,
            verifyUrl: approved ? `${siteOrigin()}/verify/coordination/${week.verifyCode}` : "",
            attendeeSignatures: people ? await Promise.all(people.map(async (p) => { const s = attendeeSignature(p, sig); const image = s && await picture(s.imageUrl); return image ? { image: tintSignature(image, s.ink, s.weight), at: s.at } : null; })) : [],
            assets: {
                watermark,
                coordinator: sig.coordinator?.imageUrl ? { image: inked(await picture(sig.coordinator.imageUrl), "blue", sig.coordinator.weight), at: sig.coordinator.at } : null,
                sectionHead: sig.sectionHead?.imageUrl ? { image: inked(await picture(sig.sectionHead.imageUrl), "pink", sig.sectionHead.weight), at: sig.sectionHead.at } : null,
                principal: sig.principal?.imageUrl ? { image: inked(await picture(sig.principal.imageUrl), "blue", sig.principal.weight), at: sig.principal.at } : null,
                qr: approved && file.showQr ? await QRCode.toBuffer(`${siteOrigin()}/verify/coordination/${week.verifyCode}`, { type: "png", margin: 0, width: 240, errorCorrectionLevel: "M" }) : null,
            },
        });
    }
    return records;
}

module.exports = { buildRecords, classLabel, attendeesOf, attendeePeople, attendeeSignature };
