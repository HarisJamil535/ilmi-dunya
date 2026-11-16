const QRCode = require("qrcode");
const { readImage } = require("./mediaStore");
const { fadeImage } = require("./watermark");
const { flatCells, plainText } = require("./coordService");
const { fromText } = require("./coordRichText");
const Admin = require("../models/Admin");
const { fileTitle, departmentNameOf } = require("./coordSubjects");
const { displayName } = require("./coordPeople");

// The meeting's attendees: the Section Head, then the department's teachers, then its Subject Coordinator
// (as in the school's form: "1. Section Head  2. Ms. Ammara  3. Ms. Tahniyat"). Files without a department
// fall back to the names typed in the week.
async function attendeesOf(file) {
    if (!file.department) return null;
    const staff = await Admin.find({ coordDepartment: file.department?._id || file.department, coordTitle: { $in: ["teacher", "coordinator"] }, status: "active" }).select("name salutation coordTitle createdAt").sort({ createdAt: 1 }).lean();
    staff.sort((a, b) => Number(a.coordTitle === "coordinator") - Number(b.coordTitle === "coordinator"));
    return ["Section Head", ...staff.map(displayName)];
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
    const departmentAttendees = await attendeesOf(file);
    const title = fileTitle(file, await departmentNameOf(file));
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
            title: (settings.title || "").replace("{session}", session),
            footerText: (settings.footerText || "").replace("{session}", session),
            caption: settings.caption || "",
            watermarkOpacity: settings.watermarkOpacity,
            pageNumber: index + 1,
            pageCount: weeks.length,
            verifyUrl: approved ? `${siteOrigin()}/verify/coordination/${week.verifyCode}` : "",
            assets: {
                watermark,
                coordinator: sig.coordinator?.imageUrl ? { image: await picture(sig.coordinator.imageUrl), at: sig.coordinator.at } : null,
                sectionHead: sig.sectionHead?.imageUrl ? { image: await picture(sig.sectionHead.imageUrl), at: sig.sectionHead.at } : null,
                qr: approved && file.showQr ? await QRCode.toBuffer(`${siteOrigin()}/verify/coordination/${week.verifyCode}`, { type: "png", margin: 0, width: 240, errorCorrectionLevel: "M" }) : null,
            },
        });
    }
    return records;
}

module.exports = { buildRecords, classLabel, attendeesOf };
