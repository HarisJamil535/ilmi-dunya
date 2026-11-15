const PDFDocument = require("pdfkit");
const { DAYS, COLUMNS, WIDTHS } = require("./coordTemplate");

// The Weekly Subject Coordination Meeting Record on one A4 landscape page per week.
// Text is laid out word by word with real font measurements, so the same code decides both where every
// line breaks and how big the text can be: the text size is lowered step by step until the week fits on
// one page (it never spills onto a second page).
const { fontKey: pageFontKey, registerPdfFonts } = require("./coordFonts");
const PAGE = { w: 841.89, h: 595.28 };
const M = { top: 22, side: 36, bottom: 18 };
const SIZES = [9.5, 9, 8.5, 8, 7.5, 7, 6.75, 6.5, 6.25, 6, 5.75, 5.5, 5.25, 5];
const PAD = { x: 3.5, y: 2.5 };
const LINE = 1.18;
const SCALE = { s: 0.86, m: 1, l: 1.2 };

// The page font is set per week before it is laid out; a run may choose its own font (run.f).
let pageFont = "arial";
const styleOf = (run) => (run.b && run.i ? "bi" : run.b ? "b" : run.i ? "i" : "r");
const F = (style) => `${pageFont}-${style}`;
const useFont = (doc, run, size) => doc.font(`${run.f || pageFont}-${styleOf(run)}`).fontSize(size * (SCALE[run.z] || 1));

// Breaks paragraphs into lines that fit `width`. Each line is a list of pieces { text, run, x, w }.
function layout(doc, paragraphs, width, size, { base = {} } = {}) {
    const lines = [];
    let number = 0;
    let lastList = "";
    for (const p of paragraphs || []) {
        if (p.list !== "ol") number = 0;
        if (p.list === "ol" && lastList !== "ol") number = 0;
        lastList = p.list;
        const indent = p.list ? size * 1.15 : 0;
        const marker = p.list === "ul" ? "•" : p.list === "ol" ? `${++number}.` : "";
        const avail = Math.max(10, width - indent);
        const tokens = [];
        for (const run of p.runs || []) {
            const style = { ...base, ...run };
            for (const part of run.t.split(/(\s+)/)) if (part) tokens.push({ text: part, run: style, space: /^\s+$/.test(part) });
        }
        const height = (pieces) => Math.max(size, ...pieces.map((x) => size * (SCALE[x.run.z] || 1))) * LINE;
        let line = []; let x = 0;
        const push = (first) => {
            while (line.length && line[line.length - 1].space) line.pop();
            lines.push({ pieces: line, indent, marker: first ? marker : "", align: p.align || "left", width: x, h: height(line.length ? line : [{ run: base }]) });
            line = []; x = 0;
        };
        let first = true;
        if (!tokens.length) { lines.push({ pieces: [], indent, marker, align: "left", width: 0, h: size * LINE }); continue; }
        for (const token of tokens) {
            useFont(doc, token.run, size);
            let w = doc.widthOfString(token.text);
            if (token.space && !line.length) continue;
            if (x + w > avail && line.length && !token.space) { push(first); first = false; }
            if (token.space && x + w > avail) continue;
            // A single word longer than the box is split across lines.
            while (!token.space && w > avail) {
                let cut = token.text.length - 1;
                while (cut > 1 && doc.widthOfString(token.text.slice(0, cut)) > avail - x) cut--;
                line.push({ text: token.text.slice(0, cut), run: token.run, x, w: doc.widthOfString(token.text.slice(0, cut)) });
                x += line[line.length - 1].w; push(first); first = false;
                token.text = token.text.slice(cut); w = doc.widthOfString(token.text);
            }
            line.push({ text: token.text, run: token.run, x, w, space: token.space }); x += w;
        }
        push(first);
    }
    return lines;
}
const linesHeight = (lines) => lines.reduce((sum, l) => sum + l.h, 0);

function drawLines(doc, lines, x, y, width, size) {
    let top = y;
    for (const line of lines) {
        const offset = line.align === "center" ? (width - line.indent - line.width) / 2 : line.align === "right" ? width - line.indent - line.width : 0;
        if (line.marker) { doc.font(F("r")).fontSize(size).fillColor("#000").text(line.marker, x, top + (line.h - size * LINE), { lineBreak: false }); }
        for (const piece of line.pieces) {
            const px = x + line.indent + offset + piece.x;
            const s = size * (SCALE[piece.run.z] || 1);
            const baselineTop = top + (line.h - s * LINE);
            if (piece.run.h) doc.save().rect(px, baselineTop, piece.w, s * LINE).fill(piece.run.h).restore();
            useFont(doc, piece.run, size).fillColor(piece.run.c || "#000").text(piece.text, px, baselineTop, { lineBreak: false });
            if (piece.run.u) doc.save().lineWidth(0.5).strokeColor(piece.run.c || "#000").moveTo(px, baselineTop + s * 1.02).lineTo(px + piece.w, baselineTop + s * 1.02).stroke().restore();
            if (piece.run.s) doc.save().lineWidth(0.5).strokeColor(piece.run.c || "#000").moveTo(px, baselineTop + s * 0.6).lineTo(px + piece.w, baselineTop + s * 0.6).stroke().restore();
        }
        top += line.h;
    }
    return top;
}

const label = (t, extra = {}) => ({ list: "", align: "left", runs: [{ t, b: true, ...extra }] });
const join = (a, b) => [{ ...a[0], runs: [...a[0].runs, { t: " " }, ...((b && b[0] && b[0].runs) || [])] }, ...((b || []).slice(1))];

// Measures and places every block of the page for a given text size.
function plan(doc, record, size) {
    const width = PAGE.w - M.side * 2;
    const scale = width / WIDTHS.reduce((a, b) => a + b, 0);
    const cols = WIDTHS.map((w) => w * scale);
    const c = new Proxy(record.cells || {}, { get: (target, key) => target[key] || [] }); // missing cells print empty
    const inner = (w) => w - PAD.x * 2;
    const block = (paragraphs, w) => { const lines = layout(doc, paragraphs, inner(w), size); return { lines, h: linesHeight(lines) + PAD.y * 2 }; };

    const subjectLine = [{ list: "", align: "left", runs: [{ t: "Subject: ", b: true }, ...(c.subject[0]?.runs || []).map((r) => ({ ...r, u: true }))] }];
    const topicLine = [{ list: "", align: "left", runs: [{ t: "Topic: ", b: true }, ...(c.topic[0]?.runs || []).map((r) => ({ ...r }))] }, ...c.topic.slice(1)];
    const periodsLine = [{ list: "", align: "left", runs: [{ t: "Periods per week ", b: true }, ...(c.periods[0]?.runs || [])] }];
    const half = width * 0.38;
    const rowSubject = { a: block(subjectLine, half), b: block(topicLine, width - half), p: block(periodsLine, half) };
    rowSubject.h = Math.max(rowSubject.a.h + rowSubject.p.h - PAD.y * 2, rowSubject.b.h);
    const rowBrought = block(join([label("Topics brought forward (if any):", { b: false })], c.broughtForward), width);
    const headers = COLUMNS.map(([, name], i) => block([{ list: "", align: "center", runs: [{ t: name, b: true }] }], cols[i]));
    const headerH = Math.max(...headers.map((h) => h.h));
    const days = DAYS.map(([key, name]) => {
        const cells = COLUMNS.map(([column], i) => (i === 0 ? block([label(name, { b: false }), ...c[`${key}.period`]], cols[0]) : block(c[`${key}.${column}`], cols[i])));
        return { cells, h: Math.max(...cells.map((x) => x.h)) };
    });
    const rowExtra = block(join([{ list: "", align: "left", runs: [{ t: "Strategies for Learners requiring extra assistance:", i: true }] }], c.extraHelp), width);
    const teacher = block(join([label("Teacher Responsible for Preparing lesson Plan:", { b: false })], c.teacher), width);
    const attendeesTitle = block([label("Attendees of Coordination Meeting:", { b: false })], width);
    // Any number of attendees, four to a line: "1. Section Head   2. Ms. Ammara   3. Ms. Tahniyat"
    const names = record.attendees?.length ? record.attendees : ["", "", "", ""];
    const attendees = names.map((name, i) => block([{ list: "", align: "left", runs: [{ t: `${i + 1}. ` }, ...(name ? [{ t: name }] : [])] }], ATTENDEE_W(width)));
    const attendeeRows = [];
    for (let i = 0; i < attendees.length; i += 4) attendeeRows.push(Math.max(...attendees.slice(i, i + 4).map((a) => a.h)) - PAD.y * 2);
    const attendeesH = attendeeRows.reduce((a, b) => a + b, 0) + PAD.y * 2;
    const rowPeople = { h: teacher.h + attendeesTitle.h + attendeesH - PAD.y * 4 };
    const leftW = cols.slice(0, 3).reduce((a, b) => a + b, 0);
    const dateA = block(join([label("Date of submission of the Lesson Plan to the Sec Head:", { b: false })], c.submitDate), leftW);
    const dateB = block(join([label("Date of distribution of the finalized Lesson Plan to the Teachers:", { b: false })], c.distributeDate), width - leftW);
    const rowDates = { h: Math.max(dateA.h, dateB.h) };

    const fixed = rowSubject.h + rowBrought.h + headerH + rowExtra.h + rowPeople.h + rowDates.h;
    return { width, cols, rowSubject, rowBrought, headers, headerH, days, rowExtra, teacher, attendeesTitle, attendees, attendeeRows, attendeesH, rowPeople, leftW, dateA, dateB, rowDates, fixed, daysH: days.reduce((a, d) => a + d.h, 0) };
}

const ATTENDEE_W = (width) => (width - 18) / 4;
// Space above and below the table (title, header line, signatures, caption, footer).
const HEAD_H = 40;
const SIGN_H = 36;
const CAPTION_H = 14;
const FOOT_H = 34;

function choosePlan(doc, record) {
    pageFont = pageFontKey(record.font);
    const room = PAGE.h - M.top - M.bottom - HEAD_H - SIGN_H - (record.caption ? CAPTION_H : 0) - FOOT_H;
    for (const size of SIZES) {
        const p = plan(doc, record, size);
        if (p.fixed + p.daysH <= room) return { ...p, size, room, overflow: false };
    }
    const size = SIZES[SIZES.length - 1];
    return { ...plan(doc, record, size), size, room, overflow: true };
}

function underlineField(doc, x, y, labelText, value, width, size) {
    doc.font(F("b")).fontSize(size).fillColor("#000").text(labelText, x, y, { lineBreak: false });
    const lw = doc.widthOfString(labelText) + 3;
    doc.font(F("r")).fontSize(size).text(value || "", x + lw + 2, y, { lineBreak: false, width: width - lw, ellipsis: true });
    doc.save().lineWidth(0.6).moveTo(x + lw, y + size + 1.2).lineTo(x + width, y + size + 1.2).stroke().restore();
}

function drawWeek(doc, record, assets) {
    const p = choosePlan(doc, record);
    const { size, width, cols } = p;
    const x0 = M.side;
    const plain = (key) => (record.cells[key] || []).map((para) => para.runs.map((r) => r.t).join("")).join(" ").trim();

    // Watermark behind everything.
    if (assets.watermark) {
        const box = 300;
        doc.save(); // the picture arrives already faded (see watermark.fadeImage)
        try { doc.image(assets.watermark, (PAGE.w - box) / 2, (PAGE.h - box) / 2 + 10, { fit: [box, box], align: "center", valign: "center" }); } catch { /* unreadable picture: leave it out */ }
        doc.restore();
    }

    // Title and the Week / Class / Sections line.
    let y = M.top;
    doc.font(F("b")).fontSize(11).fillColor("#000");
    const titleW = doc.widthOfString(record.title);
    doc.text(record.title, (PAGE.w - titleW) / 2, y, { lineBreak: false });
    doc.save().lineWidth(0.8).moveTo((PAGE.w - titleW) / 2, y + 12.2).lineTo((PAGE.w + titleW) / 2, y + 12.2).stroke().restore();
    y += 22;
    underlineField(doc, x0 + 18, y, "Week:", plain("week"), 120, 8.5);
    underlineField(doc, x0 + width * 0.5 - 30, y, "Class:", plain("className"), 90, 8.5);
    underlineField(doc, x0 + width - 150, y, "No. of Sections:", plain("sections"), 150, 8.5);
    y = M.top + HEAD_H;

    // Table.
    const extra = Math.max(0, p.room - p.fixed - p.daysH);
    const dayBonus = extra / DAYS.length; // the day rows share the spare space, as in the printed form
    const top = y;
    const hline = (yy) => doc.moveTo(x0, yy).lineTo(x0 + width, yy).stroke();
    doc.lineWidth(0.6).strokeColor("#000");

    // Subject / Topic / Periods
    const half = width * 0.38;
    drawLines(doc, p.rowSubject.a.lines, x0 + PAD.x, y + PAD.y, half - PAD.x * 2, size);
    drawLines(doc, p.rowSubject.p.lines, x0 + PAD.x, y + p.rowSubject.a.h - PAD.y, half - PAD.x * 2, size);
    drawLines(doc, p.rowSubject.b.lines, x0 + half + PAD.x, y + PAD.y, width - half - PAD.x * 2, size);
    y += p.rowSubject.h; hline(y);
    drawLines(doc, p.rowBrought.lines, x0 + PAD.x, y + PAD.y, width - PAD.x * 2, size);
    y += p.rowBrought.h; hline(y);
    const gridTop = y;
    let x = x0;
    p.headers.forEach((h, i) => { drawLines(doc, h.lines, x + PAD.x, y + (p.headerH - h.h) / 2 + PAD.y, cols[i] - PAD.x * 2, size); x += cols[i]; });
    y += p.headerH; hline(y);
    for (const day of p.days) {
        x = x0;
        day.cells.forEach((cell, i) => { drawLines(doc, cell.lines, x + PAD.x, y + PAD.y, cols[i] - PAD.x * 2, size); x += cols[i]; });
        y += day.h + dayBonus; hline(y);
    }
    // Column lines across the header and day rows.
    x = x0;
    for (let i = 0; i < cols.length - 1; i++) { x += cols[i]; doc.moveTo(x, gridTop).lineTo(x, y).stroke(); }
    drawLines(doc, p.rowExtra.lines, x0 + PAD.x, y + PAD.y, width - PAD.x * 2, size);
    y += p.rowExtra.h; hline(y);
    let yy = drawLines(doc, p.teacher.lines, x0 + PAD.x, y + PAD.y, width - PAD.x * 2, size);
    yy = drawLines(doc, p.attendeesTitle.lines, x0 + PAD.x, yy, width - PAD.x * 2, size);
    let rowY = yy;
    p.attendeeRows.forEach((h, row) => {
        p.attendees.slice(row * 4, row * 4 + 4).forEach((a, i) => drawLines(doc, a.lines, x0 + PAD.x + 18 + i * ATTENDEE_W(width), rowY, ATTENDEE_W(width) - PAD.x * 2, size));
        rowY += h;
    });
    y += p.rowPeople.h; hline(y);
    drawLines(doc, p.dateA.lines, x0 + PAD.x, y + PAD.y, p.leftW - PAD.x * 2, size);
    drawLines(doc, p.dateB.lines, x0 + p.leftW + PAD.x, y + PAD.y, width - p.leftW - PAD.x * 2, size);
    doc.moveTo(x0 + p.leftW, y).lineTo(x0 + p.leftW, y + p.rowDates.h).stroke();
    y += p.rowDates.h;
    doc.rect(x0, top, width, y - top).stroke();

    // Signatures: only the e-signature sits on the line, kept to about two lines of text in height so it
    // never pushes the layout around.
    const signY = y + 10;
    const signLine = (lx, labelText, sig, lineW) => {
        doc.font(F("r")).fontSize(8.5).fillColor("#000").text(labelText, lx, signY + 14, { lineBreak: false });
        const sx = lx + doc.widthOfString(labelText) + 4;
        doc.save().lineWidth(0.6).moveTo(sx, signY + 23).lineTo(sx + lineW, signY + 23).stroke().restore();
        if (sig?.image) { try { doc.image(sig.image, sx + 4, signY + 1, { fit: [lineW - 8, 21], align: "center", valign: "bottom" }); } catch { /* skip */ } }
    };
    signLine(x0 + width * 0.12, "Sign: Subject Coordinator:", assets.coordinator, 150);
    signLine(x0 + width * 0.56, "SH Sign:", assets.sectionHead, 150);

    let fy = signY + SIGN_H;
    if (record.caption) {
        doc.font(F("i")).fontSize(8.5).fillColor("#000");
        const cw = doc.widthOfString(record.caption);
        doc.text(record.caption, (PAGE.w - cw) / 2, fy - 4, { lineBreak: false });
        doc.save().lineWidth(0.5).moveTo((PAGE.w - cw) / 2, fy + 5.5).lineTo((PAGE.w + cw) / 2, fy + 5.5).stroke().restore();
    }

    // Footer: verification QR (optional), guide name, page number.
    const footY = PAGE.h - M.bottom - 26;
    let textX = x0;
    if (assets.qr) { doc.image(assets.qr, x0, footY - 2, { width: 28, height: 28 }); textX += 32; }
    doc.font(F("r")).fontSize(7).fillColor("#000").text(record.footerText || "", textX, footY + 16, { lineBreak: false });
    doc.font(F("b")).fontSize(7).text(`Page ${record.pageNumber} of ${record.pageCount}`, x0 + width - 120, footY + 16, { width: 120, align: "right", lineBreak: false });
    if (record.status !== "approved") {
        doc.font(F("b")).fontSize(6.5).fillColor("#9a3412").text(record.status === "submitted" ? "SUBMITTED — AWAITING SECTION HEAD APPROVAL" : "DRAFT — NOT YET SIGNED", x0, footY + 16, { width, align: "center", lineBreak: false });
    }
    return { size, overflow: p.overflow, dayHeights: p.days.map((d) => d.h + dayBonus) };
}

// records: one per week (see coordRecord.buildRecord). Returns { buffer, sizes } with the text size used per page.
async function renderCoordinationPdf(records, { title = "Coordination record" } = {}) {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, autoFirstPage: false, info: { Title: title, Producer: "IlmiDunya" } });
    registerPdfFonts(doc);
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise((resolve) => doc.on("end", resolve));
    const sizes = [];
    for (const record of records) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 0 });
        sizes.push(drawWeek(doc, record, record.assets || {}));
    }
    if (!records.length) doc.addPage();
    doc.end();
    await done;
    return { buffer: Buffer.concat(chunks), sizes };
}

// Works out the text size that makes a week fit, without drawing it (used by the editor's fit meter).
function measureFit(record) {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, autoFirstPage: false });
    registerPdfFonts(doc);
    const p = choosePlan(doc, record);
    const used = (p.fixed + p.daysH) / p.room;
    return { size: p.size, overflow: p.overflow, fullness: Math.round(Math.min(1.5, p.overflow ? used : (p.fixed + p.daysH) / p.room) * 100) / 100 };
}

module.exports = { renderCoordinationPdf, measureFit, PAGE };
