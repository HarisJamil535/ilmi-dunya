const PDFDocument = require("pdfkit");
const { DAYS, COLUMNS, WIDTHS } = require("./coordTemplate");

// The Weekly Subject Coordination Meeting Record on one A4 landscape page per week.
// Text is laid out word by word with real font measurements, so the same code decides both where every
// line breaks and how big the text can be: the text size is lowered step by step until the week fits on
// one page (it never spills onto a second page).
const { fontKey: pageFontKey, registerPdfFonts } = require("./coordFonts");
const { printLabels, dayName, columnName, isRtlText } = require("./coordLang");
const PAGE = { w: 841.89, h: 595.28 };
const M = { top: 22, side: 36, bottom: 18 };
const SIZES = [9.5, 9, 8.5, 8, 7.5, 7, 6.75, 6.5, 6.25, 6, 5.75, 5.5, 5.25, 5];
const PAD = { x: 3.5, y: 2.5 };
const LINE = 1.18;
const SCALE = { s: 0.86, m: 1, l: 1.2 };

// The page font is set per week before it is laid out; a run may choose its own font (run.f).
let pageFont = "arial";
// Urdu records: right to left, Nastaleeq. Nastaleeq needs taller lines and reads best a little larger.
let rtl = false;
let L = printLabels("en");
let lang = "en";
const LINE_UR = 1.85;
const UR_SCALE = 1.12;
const lineFactor = () => (rtl ? LINE_UR : LINE);
const styleOf = (run) => (run.b && run.i ? "bi" : run.b ? "b" : run.i ? "i" : "r");
const F = (style) => `${pageFont}-${style}`;
const useFont = (doc, run, size) => {
    const family = run.f || pageFont;
    const style = family === "urdu" ? (run.b ? "b" : "r") : styleOf(run);
    return doc.font(`${family}-${style}`).fontSize(size * (SCALE[run.z] || 1) * (family === "urdu" ? UR_SCALE : 1));
};

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
            for (const part of run.t.split(/(\s+)/)) if (part) tokens.push({ text: part, run: rtl && !run.f ? { ...style, f: isRtlText(part) || /^\s+$/.test(part) ? "urdu" : "arial" } : style, space: /^\s+$/.test(part) });
        }
        const height = (pieces) => Math.max(size, ...pieces.map((x) => size * (SCALE[x.run.z] || 1))) * lineFactor();
        let line = []; let x = 0;
        const push = (first) => {
            while (line.length && line[line.length - 1].space) line.pop();
            lines.push({ pieces: line, indent, marker: first ? marker : "", align: p.align || "left", width: x, h: height(line.length ? line : [{ run: base }]) });
            line = []; x = 0;
        };
        let first = true;
        if (!tokens.length) { lines.push({ pieces: [], indent, marker, align: "left", width: 0, h: size * lineFactor() }); continue; }
        for (const token of tokens) {
            useFont(doc, token.run, size);
            let w = doc.widthOfString(token.text);
            if (token.space && !line.length) continue;
            if (x + w > avail && line.length && !token.space) { push(first); first = false; }
            if (token.space && x + w > avail) continue;
            // A single word longer than the box is split across lines.
            // A word wider than the box (a long pasted link or code) is cut into pieces that fit. The cut is
            // estimated from the average letter width and then fine-tuned, and only short pieces are measured:
            // measuring the whole long word again and again used seconds and hundreds of megabytes.
            if (!token.space && w > avail) {
                let rest = token.text;
                const perChar = w / rest.length;
                while (rest) {
                    const room = Math.max(perChar, avail - x);
                    let cut = Math.max(1, Math.min(rest.length, Math.floor(room / perChar)));
                    while (cut > 1 && doc.widthOfString(rest.slice(0, cut)) > room) cut--;
                    while (cut < rest.length && doc.widthOfString(rest.slice(0, cut + 1)) <= room) cut++;
                    const piece = rest.slice(0, cut);
                    rest = rest.slice(cut);
                    if (!rest) { token.text = piece; w = doc.widthOfString(piece); break; }
                    line.push({ text: piece, run: token.run, x, w: doc.widthOfString(piece) });
                    x += line[line.length - 1].w; push(first); first = false;
                }
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
        // Right to left: the page is mirrored when drawn, which puts words in Urdu order. A run of English
        // words (a link, "AFL", a date) inside Urdu must still read left to right, so it is flipped back.
        if (rtl) {
            const pieces = line.pieces;
            for (let i = 0; i < pieces.length;) {
                if (pieces[i].space || pieces[i].run.f !== "arial") { i++; continue; }
                let j = i;
                while (j + 1 < pieces.length && (pieces[j + 1].run.f === "arial" || (pieces[j + 1].space && pieces[j + 2]?.run.f === "arial"))) j++;
                const gs = pieces[i].x, ge = pieces[j].x + pieces[j].w;
                for (let k = i; k <= j; k++) pieces[k].vx = ge - (pieces[k].x - gs) - pieces[k].w;
                i = j + 1;
            }
        }
        const offset = line.align === "center" ? (width - line.indent - line.width) / 2 : line.align === "right" ? width - line.indent - line.width : 0;
        if (line.marker) { doc.font(rtl ? "arial-r" : F("r")).fontSize(size).fillColor("#000").text(line.marker, x, top + (line.h - size * lineFactor()), { lineBreak: false }); }
        for (const piece of line.pieces) {
            const px = x + line.indent + offset + (piece.vx ?? piece.x);
            const s = size * (SCALE[piece.run.z] || 1);
            const baselineTop = top + (line.h - s * lineFactor());
            if (piece.run.h) doc.save().rect(px, baselineTop, piece.w, s * lineFactor()).fill(piece.run.h).restore();
            useFont(doc, piece.run, size).fillColor(piece.run.c || "#000").text(piece.text, px, baselineTop, { lineBreak: false });
            const under = rtl ? s * 1.62 : s * 1.02;
            if (piece.run.u) doc.save().lineWidth(0.5).strokeColor(piece.run.c || "#000").moveTo(px, baselineTop + under).lineTo(px + piece.w, baselineTop + under).stroke().restore();
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

    const subjectLine = [{ list: "", align: "left", runs: [{ t: `${L.subject} `, b: true }, ...(c.subject[0]?.runs || []).map((r) => ({ ...r, u: true }))] }];
    const topicLine = [{ list: "", align: "left", runs: [{ t: `${L.topic} `, b: true }, ...(c.topic[0]?.runs || []).map((r) => ({ ...r }))] }, ...c.topic.slice(1)];
    const periodsLine = [{ list: "", align: "left", runs: [{ t: `${L.periods} `, b: true }, ...(c.periods[0]?.runs || [])] }];
    const half = width * 0.38;
    const rowSubject = { a: block(subjectLine, half), b: block(topicLine, width - half), p: block(periodsLine, half) };
    rowSubject.h = Math.max(rowSubject.a.h + rowSubject.p.h - PAD.y * 2, rowSubject.b.h);
    const rowBrought = block(join([label(L.broughtForward, { b: false })], c.broughtForward), width);
    const headers = COLUMNS.map(([column], i) => block([{ list: "", align: "center", runs: [{ t: columnName(lang, column), b: true }] }], cols[i]));
    const headerH = Math.max(...headers.map((h) => h.h));
    const days = DAYS.map(([key]) => {
        const name = dayName(lang, key);
        const cells = COLUMNS.map(([column], i) => (i === 0 ? block([label(name, { b: false }), ...c[`${key}.period`]], cols[0]) : block(c[`${key}.${column}`], cols[i])));
        return { cells, h: Math.max(...cells.map((x) => x.h)) };
    });
    const rowExtra = block(join([{ list: "", align: "left", runs: [{ t: L.extraHelp, i: !rtl }] }], c.extraHelp), width);
    const teacher = block(join([label(L.teacher, { b: false })], c.teacher), width);
    const attendeesTitle = block([label(L.attendees, { b: false })], width);
    // Any number of attendees, four to a line: "1. Section Head   2. Ms. Ammara   3. Ms. Tahniyat"
    const names = record.attendees?.length ? record.attendees : ["", "", "", ""];
    // Department attendees sign beside their name: the name takes the left part of its column and a
    // signature line the right part, so the layout is the same before and after people sign.
    const signing = Boolean(record.attendeeSignatures?.length);
    const per = perLine(names.length);
    // Up to four people: the signature sits beside each name. Five or more: under each name, so the
    // whole list still fits on one line.
    const stacked = signing && per > 4;
    const nameW = signing && !stacked ? ATTENDEE_W(width, per) * NAME_SHARE : ATTENDEE_W(width, per);
    const attendees = names.map((name, i) => block([{ list: "", align: "left", runs: [{ t: rtl ? `${i + 1}۔ ` : `${i + 1}. ` }, ...(name ? [{ t: rtl && name === "Section Head" ? L.sectionHead : name }] : [])] }], nameW));
    const attendeeRows = [];
    for (let i = 0; i < attendees.length; i += per) attendeeRows.push(stacked ? Math.max(...attendees.slice(i, i + per).map((a) => a.h - PAD.y * 2)) + size * SIGN_LINES : Math.max(signing ? size * SIGN_LINES : 0, ...attendees.slice(i, i + per).map((a) => a.h - PAD.y * 2)));
    const attendeesH = attendeeRows.reduce((a, b) => a + b, 0) + PAD.y * 2;
    const rowPeople = { h: teacher.h + attendeesTitle.h + attendeesH - PAD.y * 4 };
    const leftW = cols.slice(0, 3).reduce((a, b) => a + b, 0);
    const dateA = block(join([label(L.submitDate, { b: false })], c.submitDate), leftW);
    const dateB = block(join([label(L.distributeDate, { b: false })], c.distributeDate), width - leftW);
    const rowDates = { h: Math.max(dateA.h, dateB.h) };

    const fixed = rowSubject.h + rowBrought.h + headerH + rowExtra.h + rowPeople.h + rowDates.h;
    return { width, cols, rowSubject, rowBrought, headers, headerH, days, rowExtra, teacher, attendeesTitle, attendees, attendeeRows, attendeesH, rowPeople, leftW, dateA, dateB, rowDates, fixed, daysH: days.reduce((a, d) => a + d.h, 0) };
}

// All attendees on one line (up to six); a longer list is split into even lines.
const perLine = (n) => (n <= 4 ? 4 : n <= 6 ? n : Math.ceil(n / Math.ceil(n / 6)));
const ATTENDEE_W = (width, per = 4) => (width - 18) / per;
const NAME_SHARE = 0.56; // of an attendee's column; the rest holds their signature
const SIGN_LINES = 2.4; // an attendee row is at least this many text sizes tall when people sign
// Space above and below the table (title, header line, signatures, caption, footer).
const HEAD_H = 40;
const SIGN_H = 36;
const CAPTION_H = 14;
const FOOT_H = 34;

function choosePlan(doc, record) {
    lang = record.lang === "ur" ? "ur" : "en";
    rtl = lang === "ur";
    L = printLabels(lang);
    pageFont = rtl ? "urdu" : pageFontKey(record.font);
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
    const ly = y + size * (rtl ? 1.45 : 1) + 1.2;
    doc.save().lineWidth(0.6).moveTo(x + lw, ly).lineTo(x + width, ly).stroke().restore();
}

// Draws an Urdu page: every position is mirrored (x -> page width - x - width), so the same layout code
// produces a right-to-left page. Text keeps its own direction: Urdu words are shaped right to left by the
// font, a phrase of several Urdu words is drawn word by word from the right, English stays left to right.
const URDU_LIFT = 0.56; // Nastaleeq has a very tall ascent; this lifts it to sit like the other fonts
const LATIN_DROP = 0.6; // English and numbers among Urdu sit on the Urdu baseline
const flipBrackets = (word) => word.replace(/[()[\]{}]/g, (c) => ({ "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{" }[c]));
// In Urdu text a range of numbers ("2026-2027") reads right to left: 2026 on the right, as Word shows it.
const flipRange = (text) => (/^\d+(?:-\d+)+$/.test(text) ? text.split("-").reverse().join("-") : text);
const isUrduFont = (doc) => /nastaliq/i.test(doc._font?.name || "");
function mirrorPage(doc) {
    const W = PAGE.w;
    const orig = { text: doc.text, moveTo: doc.moveTo, lineTo: doc.lineTo, rect: doc.rect, image: doc.image };
    // English words and numbers inside Urdu are drawn in Arial (the Nastaleeq font would run them right to left).
    const latinFont = () => (/bold/i.test(doc._font?.name || "") ? "arial-b" : "arial-r");
    const withLatin = (fn) => {
        if (!isUrduFont(doc)) return fn(0);
        const font = doc._font, size = doc._fontSize;
        doc.font(latinFont()).fontSize(size / UR_SCALE * (size > 0 ? 1 : 1));
        try { return fn(0); } finally { doc._font = font; doc._fontSize = size; }
    };
    // Brackets in Urdu words take their mirrored shape, as Word and browsers show them.
    const textAt = (str, x, y, opts) => orig.text.call(doc, isRtlText(str) ? flipBrackets(str) : str, x, y, opts);
    // A phrase with several words, right to left; runs of English words keep their own order.
    const phrase = (str, right, y) => {
        const tokens = String(str).split(/(\s+)/).filter(Boolean);
        const items = [];
        for (const t of tokens) {
            const latin = !/^\s+$/.test(t) && !isRtlText(t);
            const last = items[items.length - 1];
            if (last && last.latin && (latin || (/^\s+$/.test(t)))) { last.text += t; continue; }
            items.push({ text: t, latin });
        }
        let cursor = right;
        for (const item of items) {
            const text = item.latin ? item.text.replace(/\s+$/, "") : item.text;
            const trailing = item.latin ? item.text.slice(text.length) : "";
            const lift = isUrduFont(doc) ? doc._fontSize * URDU_LIFT : 0;
            if (item.latin) {
                const w = withLatin(() => { const lw = doc.widthOfString(text); textAt(flipRange(text), cursor - lw, y + lift + doc._fontSize * LATIN_DROP, { lineBreak: false }); return lw; });
                cursor -= w + (trailing ? doc.widthOfString(trailing) : 0);
                continue;
            }
            const w = doc.widthOfString(text);
            if (!/^\s+$/.test(text)) textAt(text, cursor - w, y, { lineBreak: false });
            cursor -= w;
        }
    };
    const phraseWidth = (str) => String(str).split(/(\s+)/).filter(Boolean).reduce((sum, t) => sum + (!/^\s+$/.test(t) && !isRtlText(t) ? withLatin(() => doc.widthOfString(t)) : doc.widthOfString(t)), 0);
    doc.text = function text(str, x, y, opts = {}) {
        if (typeof x !== "number") return orig.text.call(doc, str, x, y, opts);
        const s = String(str ?? "");
        const lift = isUrduFont(doc) ? doc._fontSize * URDU_LIFT : 0;
        const natural = isUrduFont(doc) && isRtlText(s) && /\s/.test(s.trim()) ? phraseWidth(s) : doc.widthOfString(s);
        const boxW = opts.width ?? natural;
        const X = W - x - boxW;
        const align = opts.align === "right" ? "left" : opts.align === "center" ? "center" : "right";
        if (isRtlText(s) && /\s/.test(s.trim())) {
            const used = Math.min(natural, boxW);
            const left = opts.width === undefined ? X : align === "left" ? X : align === "center" ? X + (boxW - used) / 2 : X + boxW - used;
            phrase(s, left + used, y - lift);
            return doc;
        }
        if (lift && !isRtlText(s)) {
            // A number or English text on its own (e.g. "6", "Ms. Malaika"): Arial, measured in Arial.
            return withLatin(() => {
                const lw = doc.widthOfString(s);
                const X2 = opts.width === undefined ? W - x - lw : X;
                return textAt(flipRange(s), X2, y + doc._fontSize * LATIN_DROP, opts.width === undefined ? opts : { ...opts, align });
            });
        }
        const yy = lift ? y - lift : y + doc._fontSize * LATIN_DROP; // English in Arial on an Urdu page
        if (opts.width === undefined) return textAt(lift ? s : flipRange(s), X, yy, opts);
        return textAt(s, X, yy, { ...opts, align });
    };
    doc.moveTo = function moveTo(x, y) { return orig.moveTo.call(doc, W - x, y); };
    doc.lineTo = function lineTo(x, y) { return orig.lineTo.call(doc, W - x, y); };
    doc.rect = function rect(x, y, w, h) { return orig.rect.call(doc, W - x - w, y, w, h); };
    doc.image = function image(src, x, y, opts = {}) {
        const w = opts.fit ? opts.fit[0] : opts.width || 0;
        return orig.image.call(doc, src, W - x - w, y, opts);
    };
    return () => Object.assign(doc, orig);
}

function drawWeek(doc, record, assets) {
    const restore = record.lang === "ur" ? mirrorPage(doc) : null;
    try { return drawWeekPage(doc, record, assets); } finally { restore?.(); }
}

function drawWeekPage(doc, record, assets) {
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
    const titleLine = y + (rtl ? 17.5 : 12.2);
    doc.save().lineWidth(0.8).moveTo((PAGE.w - titleW) / 2, titleLine).lineTo((PAGE.w + titleW) / 2, titleLine).stroke().restore();
    y += 22;
    underlineField(doc, x0 + 18, y, L.week, plain("week"), rtl ? 230 : 120, 8.5);
    underlineField(doc, x0 + width * 0.5 - 30, y, L.className, plain("className"), 90, 8.5);
    underlineField(doc, x0 + width - 150, y, L.sections, plain("sections"), 150, 8.5);
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
        const per = perLine(p.attendees.length), colW = ATTENDEE_W(width, per);
        p.attendees.slice(row * per, row * per + per).forEach((a, i) => {
            const colX = x0 + PAD.x + 18 + i * colW;
            const index = row * per + i;
            if (!record.attendeeSignatures?.length) return drawLines(doc, a.lines, colX, rowY, colW - PAD.x * 2, size);
            const textH = a.h - PAD.y * 2;
            const stacked = per > 4;
            if (stacked) drawLines(doc, a.lines, colX, rowY, colW - PAD.x, size);
            else drawLines(doc, a.lines, colX, rowY + Math.max(0, h - textH), colW * NAME_SHARE - PAD.x, size);
            const sx = stacked ? colX + 8 : colX + colW * NAME_SHARE, sw = stacked ? colW - PAD.x * 2 - 16 : colW * (1 - NAME_SHARE) - PAD.x * 2;
            doc.save().lineWidth(0.4).strokeColor("#9ca3af").moveTo(sx, rowY + h).lineTo(sx + sw, rowY + h).stroke().restore();
            const sig = record.attendeeSignatures[index];
            const top = stacked ? rowY + h - size * SIGN_LINES : rowY;
            if (sig?.image) { try { doc.image(sig.image, sx, top + 1, { fit: [sw, rowY + h - top - 1], align: "center", valign: "bottom" }); } catch { /* skip */ } }
        });
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
    if (assets.principal) {
        signLine(x0 + width * 0.02, L.signCoordinator, assets.coordinator, 130);
        signLine(x0 + width * 0.40, L.signSectionHead, assets.sectionHead, 130);
        signLine(x0 + width * 0.68, L.signPrincipal, assets.principal, 130);
    } else {
        signLine(x0 + width * 0.12, L.signCoordinator, assets.coordinator, 150);
        signLine(x0 + width * 0.56, L.signSectionHead, assets.sectionHead, 150);
    }

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
    doc.font(F("b")).fontSize(7).text(L.page(record.pageNumber, record.pageCount), x0 + width - 120, footY + 16, { width: 120, align: "right", lineBreak: false });
    if (record.status !== "approved") {
        doc.font(F("b")).fontSize(6.5).fillColor("#9a3412").text(record.status === "submitted" ? L.submitted : L.draft, x0, footY + 16, { width, align: "center", lineBreak: false });
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
// Results are remembered for identical content, so many people opening the same week cost one layout.
const fitCache = new Map();
function measureFit(record) {
    const key = require("node:crypto").createHash("sha1").update(JSON.stringify([record.cells, record.font, record.attendees, record.title, record.caption, record.lang])).digest("base64");
    if (fitCache.has(key)) return fitCache.get(key);
    const result = measureFitNow(record);
    fitCache.set(key, result);
    if (fitCache.size > 400) fitCache.delete(fitCache.keys().next().value);
    return result;
}
// One document is kept just for measuring text: creating a new one for every check kept about 4 MB each in memory.
let measuringDoc = null;
function measureFitNow(record) {
    if (!measuringDoc) { measuringDoc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, autoFirstPage: false }); registerPdfFonts(measuringDoc); }
    const p = choosePlan(measuringDoc, record);
    const used = (p.fixed + p.daysH) / p.room;
    return { size: p.size, overflow: p.overflow, fullness: Math.round(Math.min(1.5, p.overflow ? used : used) * 100) / 100 };
}

module.exports = { renderCoordinationPdf, measureFit, PAGE };
