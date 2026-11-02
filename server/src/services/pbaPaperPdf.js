const { internals, latin } = require("./paperPdf");
const { paragraphs } = require("./pbaContent");
const { imageSize } = require("./imageSize");

// The PBA paper as a PDF: a header with candidate lines and a roll number grid, sections and numbered questions with
// parts, code boxes, pictures, tables and labelling tables, and optional answer spaces. Also the answer key and the E-sheet.
const { SIZES, SCALES_SINGLE, FOOTER, INK, LINE, context, write, flow, room, box, watermark, newDocument, collect } = internals;
const MONO = "Courier";
const MONO_BOLD = "Courier-Bold";

const imageUrlsOf = papers => {
    const urls = new Set();
    const scan = blocks => { for (const block of blocks || []) { if (block.type === "image" && block.url) urls.add(block.url); if (block.type === "labelling") for (const item of block.items) if (item.image) urls.add(item.image); } };
    for (const paper of papers) for (const section of paper.sections) for (const question of section.questions) { scan(question.stem); for (const part of question.parts) { scan(part.blocks); scan(part.answer); } }
    return [...urls];
};

// ---- text with bold, italic and underline, laid out word by word ----------------------------------------------
function layoutRuns(ctx, runs, width, size) {
    const { doc, fonts } = ctx;
    const fontOf = run => (run.bold ? fonts.b : run.italic ? fonts.i : fonts.r);
    const tokens = runs.flatMap(run => latin(run.text).split(/(\s+)/).filter(Boolean).map(token => ({ token, run, font: fontOf(run) })));
    const lines = [];
    let current = { items: [], width: 0 };
    for (const { token, run, font } of tokens) {
        const space = /^\s+$/.test(token);
        const text = space ? " " : token;
        doc.font(font).fontSize(size);
        const w = doc.widthOfString(text);
        if (!space && current.items.length && current.width + w > width) { lines.push(current); current = { items: [], width: 0 }; }
        if (space && !current.items.length) continue;
        current.items.push({ text, font, underline: Boolean(run.underline), x: current.width, w });
        current.width += w;
    }
    if (current.items.length) lines.push(current);
    return lines;
}
function drawLine(ctx, line, x, y, size) {
    for (const item of line.items) ctx.doc.fillColor(INK).font(item.font).fontSize(size).text(item.text, x + item.x, y, { lineBreak: false, underline: item.underline && item.text.trim() !== "" });
}
const runsHeight = (ctx, runs, width, size) => Math.max(1, layoutRuns(ctx, runs, width, size).length) * size * 1.32;

// ---- blocks -----------------------------------------------------------------------------------------------------
function drawText(ctx, fl, block, x, width) {
    const size = ctx.body;
    const lead = size * 1.32;
    for (const item of paragraphs(block.text)) {
        const items = item.type === "p" ? [{ runs: item.runs }] : item.items;
        items.forEach((entry, index) => {
            const indent = item.type === "p" ? 0 : 14 * ctx.s;
            const lines = layoutRuns(ctx, entry.runs, width - indent, size);
            lines.forEach((line, li) => {
                room(fl, lead);
                if (li === 0 && item.type === "ul") ctx.doc.fillColor(INK).circle(x + 5 * ctx.s, fl.y + size * 0.55, 1.6 * ctx.s).fill();
                else if (li === 0 && item.type === "ol") write(ctx, `${entry.number ?? index + 1}.`, x + 2 * ctx.s, fl.y, indent, { size });
                drawLine(ctx, line, x + indent, fl.y, size);
                fl.y += lead;
            });
        });
        fl.y += 3 * ctx.s;
    }
}

function drawCode(ctx, fl, block, x, width) {
    const { doc } = ctx;
    const size = ctx.cell * 0.98;
    const pad = 6 * ctx.s;
    doc.font(MONO).fontSize(size);
    const charWidth = doc.widthOfString("M");
    const maxChars = Math.max(10, Math.floor((width - pad * 2) / charWidth));
    const rows = block.code.split("\n").flatMap(source => { const text = source.replace(/\t/g, "  "); if (text.length <= maxChars) return [text]; const out = []; for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars)); return out; });
    const lead = size * 1.4;
    const height = rows.length * lead + pad * 2;
    room(fl, Math.min(height, (fl.bottom - fl.top) * 0.9));
    box(ctx, x, fl.y, width, height);
    rows.forEach((row, i) => { doc.fillColor(INK).font(MONO).fontSize(size).text(row.replace(/[^\x20-\x7E]/g, "?"), x + pad, fl.y + pad + i * lead, { lineBreak: false }); });
    fl.y += height + 6 * ctx.s;
}

function drawImage(ctx, fl, block, x, width, images) {
    const buffer = images.get(block.url);
    const dims = buffer && imageSize(buffer);
    if (!dims) return;
    const share = { small: 0.26, medium: 0.42, large: 0.62 }[block.size] || 0.42;
    let w = Math.min(width * share, dims.width * 0.75);
    let h = w * dims.height / dims.width;
    if (h > 210 * ctx.s) { h = 210 * ctx.s; w = h * dims.width / dims.height; }
    room(fl, h + 8 * ctx.s);
    try { ctx.doc.image(buffer, x, fl.y, { width: w, height: h }); } catch { /* an unreadable picture is skipped */ }
    fl.y += h + 4 * ctx.s;
    if (block.caption) { write(ctx, block.caption, x, fl.y, width, { font: ctx.fonts.i, size: ctx.cell - 1 }); fl.y += (ctx.cell + 2) * ctx.s; }
    fl.y += 4 * ctx.s;
}

function drawTable(ctx, fl, block, x, width) {
    const cols = block.rows[0].length;
    const cellWidth = width / cols;
    const pad = ctx.pad;
    const rowHeight = (row, r) => Math.max(...row.map(cell => (cell ? runsHeight(ctx, [{ text: cell, bold: block.header && r === 0 }], cellWidth - pad * 2, ctx.cell) : 0)), row.every(cell => !cell) ? 28 * ctx.s : 15 * ctx.s) + pad * 2;
    // A table stays on one page when it can.
    room(fl, Math.min(block.rows.reduce((sum, row, r) => sum + rowHeight(row, r), 0), (fl.bottom - fl.top) * 0.9));
    block.rows.forEach((row, r) => {
        const head = block.header && r === 0;
        const h = rowHeight(row, r);
        room(fl, h);
        row.forEach((cell, c) => {
            box(ctx, x + c * cellWidth, fl.y, cellWidth, h);
            if (cell) layoutRuns(ctx, [{ text: cell, bold: head }], cellWidth - pad * 2, ctx.cell).forEach((line, li) => drawLine(ctx, line, x + c * cellWidth + pad, fl.y + pad + li * ctx.cell * 1.32, ctx.cell));
        });
        fl.y += h;
    });
    fl.y += 6 * ctx.s;
}

function drawLabelling(ctx, fl, block, x, width, images, reveal) {
    const widths = [0.3, 0.3, 0.4].map(share => share * width);
    const pad = ctx.pad;
    const head = ctx.cell + pad * 2 + 2;
    room(fl, Math.min(head + block.items.length * 60 * ctx.s, (fl.bottom - fl.top) * 0.9));
    block.columns.forEach((name, c) => { const cx = x + widths.slice(0, c).reduce((a, b) => a + b, 0); box(ctx, cx, fl.y, widths[c], head); write(ctx, name, cx, fl.y + pad + 1, widths[c], { font: ctx.fonts.b, align: "center" }); });
    fl.y += head;
    for (const item of block.items) {
        const buffer = item.image && images.get(item.image);
        const dims = buffer && imageSize(buffer);
        const h = Math.max(54 * ctx.s, dims ? Math.min(78 * ctx.s, widths[0] * 0.7 * dims.height / dims.width) + pad * 2 : 0);
        room(fl, h);
        widths.forEach((w, c) => box(ctx, x + widths.slice(0, c).reduce((a, b) => a + b, 0), fl.y, w, h));
        if (dims) { const maxW = widths[0] - pad * 2; const maxH = h - pad * 2; const scale = Math.min(maxW / dims.width, maxH / dims.height); try { ctx.doc.image(buffer, x + pad + (maxW - dims.width * scale) / 2, fl.y + pad + (maxH - dims.height * scale) / 2, { width: dims.width * scale, height: dims.height * scale }); } catch { /* skipped */ } }
        if (reveal) { write(ctx, item.name, x + widths[0] + pad, fl.y + pad, widths[1] - pad * 2); write(ctx, item.purpose, x + widths[0] + widths[1] + pad, fl.y + pad, widths[2] - pad * 2); }
        fl.y += h;
    }
    fl.y += 6 * ctx.s;
}

function drawBlocks(ctx, fl, blocks, x, width, images, reveal = false) {
    for (const block of blocks || []) {
        if (block.type === "text") drawText(ctx, fl, block, x, width);
        else if (block.type === "code") drawCode(ctx, fl, block, x, width);
        else if (block.type === "image") drawImage(ctx, fl, block, x, width, images);
        else if (block.type === "table") drawTable(ctx, fl, block, x, width);
        else if (block.type === "labelling") drawLabelling(ctx, fl, block, x, width, images, reveal);
    }
}

// Room for the student to write: ruled lines, or an empty box.
function drawSpace(ctx, fl, space, x, width) {
    if (!space || space.mode === "none" || !space.size) return;
    const { doc } = ctx;
    if (space.mode === "lines") {
        const lead = 17 * ctx.s;
        for (let i = 0; i < space.size; i++) { room(fl, lead); doc.lineWidth(0.4).strokeColor(INK).moveTo(x, fl.y + lead - 3).lineTo(x + width, fl.y + lead - 3).stroke(); fl.y += lead; }
        fl.y += 4 * ctx.s;
    } else {
        const h = space.size * 14 * ctx.s;
        room(fl, h);
        box(ctx, x, fl.y, width, h);
        fl.y += h + 6 * ctx.s;
    }
}

// ---- the header ------------------------------------------------------------------------------------------------
function drawHeader(ctx, fl, paper, logo, { compact = false } = {}) {
    const { doc } = ctx;
    const h = paper.header;
    const roll = paper.layout.rollNumber;
    const digits = paper.layout.rollDigits;
    const fields = h.candidateFields;
    const rollW = roll ? fl.w * 0.3 : 0;
    const leftW = fl.w * (roll ? 0.36 : 0.4);
    const midW = fl.w - leftW - rollW;
    const cell = 9.2 * ctx.s;
    const rollH = roll ? (14 + 14 + 10 * cell) * ctx.s / ctx.s : 0;
    const heightLeft = Math.max(fields.length, 1) * 25 * ctx.s;
    const midLines = [h.schoolName, h.examName, h.paperTitle, h.session].filter(Boolean);
    // Long titles wrap inside the middle column, so each line is measured to keep the lines apart.
    const midSize = i => (i === 0 ? ctx.body + 1.5 : ctx.body);
    const midHeights = midLines.map((line, i) => { doc.font(ctx.fonts.b).fontSize(midSize(i)); return doc.heightOfString(latin(line), { width: midW - 12 }) + 4 * ctx.s; });
    const heightMid = (logo ? 46 : 0) * ctx.s + midHeights.reduce((sum, value) => sum + value, 0) + 10 * ctx.s;
    const H = Math.max(heightLeft, heightMid, rollH + 8 * ctx.s, 70 * ctx.s);
    room(fl, H + 60 * ctx.s);
    const top = fl.y;
    doc.lineWidth(LINE + 0.2).strokeColor(INK).rect(fl.x, top, fl.w, H).stroke();
    doc.moveTo(fl.x + leftW, top).lineTo(fl.x + leftW, top + H).stroke();
    if (roll) doc.moveTo(fl.x + leftW + midW, top).lineTo(fl.x + leftW + midW, top + H).stroke();
    // candidate lines
    const rowH = H / Math.max(fields.length, 1);
    fields.forEach((field, i) => {
        const y = top + i * rowH + rowH / 2 - ctx.cell / 2;
        write(ctx, `${field}:`, fl.x + 6, y, leftW - 10, { font: ctx.fonts.b, size: ctx.cell });
        doc.font(ctx.fonts.b).fontSize(ctx.cell);
        const start = fl.x + 6 + doc.widthOfString(latin(`${field}:`)) + 4;
        const value = field.toLowerCase() === "date" ? h.date : "";
        if (value) write(ctx, value, start, y, fl.x + leftW - 6 - start, { size: ctx.cell });
        doc.lineWidth(LINE).strokeColor(INK).moveTo(start, y + ctx.cell + 2).lineTo(fl.x + leftW - 6, y + ctx.cell + 2).stroke();
    });
    // school, exam and paper title
    let y = top + 6 * ctx.s;
    if (logo) { try { doc.image(logo, fl.x + leftW + midW / 2 - 21 * ctx.s, y, { fit: [42 * ctx.s, 42 * ctx.s] }); } catch { /* skipped */ } y += 46 * ctx.s; }
    midLines.forEach((line, i) => { write(ctx, line, fl.x + leftW + 6, y, midW - 12, { font: ctx.fonts.b, size: midSize(i), align: "center" }); y += midHeights[i]; });
    // roll number: boxes to write in, then a column of bubbles for each digit
    if (roll) {
        const rx = fl.x + leftW + midW;
        write(ctx, "Roll Number", rx, top + 3, rollW, { font: ctx.fonts.b, size: ctx.cell - 1, align: "center" });
        const colW = (rollW - 10) / digits;
        for (let c = 0; c < digits; c++) doc.lineWidth(LINE).strokeColor(INK).rect(rx + 5 + c * colW, top + 14, colW, 13).stroke();
        for (let d = 0; d < 10; d++) for (let c = 0; c < digits; c++) {
            const cx = rx + 5 + c * colW + colW / 2; const cy = top + 14 + 13 + 6 + d * cell;
            doc.lineWidth(0.4).strokeColor(INK).circle(cx, cy, Math.min(colW, cell) / 2 - 0.9).stroke();
            write(ctx, String(d), cx - 5, cy - 2.2, 10, { size: 4.2, align: "center" });
        }
    }
    fl.y = top + H + 6 * ctx.s;
    if (compact) return;
    write(ctx, `Total Marks: ${paper.totalMarks}`, fl.x, fl.y, fl.w / 2, { font: ctx.fonts.b, size: ctx.body });
    if (h.timeAllowed) write(ctx, `Time: ${h.timeAllowed}`, fl.x + fl.w / 2, fl.y, fl.w / 2, { font: ctx.fonts.b, size: ctx.body, align: "right" });
    fl.y += ctx.body + 4 * ctx.s;
    doc.lineWidth(LINE).strokeColor(INK).moveTo(fl.x, fl.y).lineTo(fl.x + fl.w, fl.y).stroke();
    fl.y += 5 * ctx.s;
    if (h.note) { const lines = layoutRuns(ctx, [{ text: h.note, bold: true }], fl.w, ctx.body); lines.forEach(line => { drawLine(ctx, line, fl.x, fl.y, ctx.body); fl.y += ctx.body * 1.32; }); fl.y += 4 * ctx.s; }
}

function sectionTitle(ctx, fl, section) {
    // The title never sits alone at the bottom of a page.
    room(fl, 130 * ctx.s);
    fl.y += 4 * ctx.s;
    write(ctx, section.title, fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body + 1, align: "center", underline: ctx.titleStyle === "underline" || ctx.titleStyle === "bold" });
    fl.y += ctx.body + 7 * ctx.s;
    if (section.note) { write(ctx, section.note, fl.x, fl.y, fl.w, { font: ctx.fonts.i, size: ctx.cell }); fl.y += ctx.cell * 1.5 + 2 * ctx.s; }
}

const GUTTER = 36;
function drawQuestion(ctx, fl, question, images, { reveal = false } = {}) {
    const indent = 40 * ctx.s;
    const inner = fl.w - indent - GUTTER * ctx.s;
    room(fl, 70 * ctx.s);
    write(ctx, `${question.label}:`, fl.x, fl.y, indent, { font: ctx.fonts.b, size: ctx.body });
    write(ctx, `[${question.marks}]`, fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body, align: "right" });
    // With no text of its own, the question's parts start on the next line.
    if (!question.stem.length) fl.y += ctx.body * 1.5;
    drawBlocks(ctx, fl, question.stem, fl.x + indent, inner, images, reveal);
    for (const part of question.parts) {
        room(fl, 40 * ctx.s);
        const start = fl.y;
        write(ctx, `${part.label}.`, fl.x + indent, start, 20 * ctx.s, { font: ctx.fonts.b, size: ctx.body });
        write(ctx, `(${part.marks})`, fl.x, start, fl.w, { size: ctx.body, align: "right" });
        drawBlocks(ctx, fl, part.blocks, fl.x + indent + 20 * ctx.s, inner - 20 * ctx.s, images, reveal);
        drawSpace(ctx, fl, part.space, fl.x + indent + 20 * ctx.s, inner - 20 * ctx.s);
    }
    fl.y += 6 * ctx.s;
}

// ---- the three documents ---------------------------------------------------------------------------------------
function drawPaper(doc, size, paper, assets, scale, mode) {
    const layout = paper.layout;
    const ctx = context(doc, layout, scale);
    const margin = (layout.paper === "A4" ? 36 : 34) * Math.max(scale, 0.92);
    const fl = flow(margin, size.width - margin * 2, margin, size.height - margin - 16, null);
    doc.on("pageAdded", () => watermark(ctx, { x: 0, y: 0, w: size.width, h: size.height }, layout, assets.mark));
    doc.addPage();
    fl.onFull = () => { doc.addPage(); fl.y = margin; };
    if (mode === "key") {
        write(ctx, "ANSWER KEY", fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body + 6, align: "center" });
        fl.y += ctx.body + 12 * ctx.s;
        write(ctx, [paper.header.schoolName, paper.header.paperTitle, paper.header.session, paper.versionCount > 1 ? `Paper ${paper.version}` : ""].filter(Boolean).join("  |  "), fl.x, fl.y, fl.w, { size: ctx.cell, align: "center" });
        fl.y += ctx.cell + 6 * ctx.s;
        write(ctx, "For teachers only. Do not give this to students.", fl.x, fl.y, fl.w, { font: ctx.fonts.i, size: ctx.cell - 1, align: "center" });
        fl.y += ctx.cell + 10 * ctx.s;
        for (const section of paper.sections) {
            sectionTitle(ctx, fl, section);
            for (const question of section.questions) {
                room(fl, 50 * ctx.s);
                write(ctx, `${question.label}:`, fl.x, fl.y, 44 * ctx.s, { font: ctx.fonts.b, size: ctx.body });
                write(ctx, `[${question.marks}]`, fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body, align: "right" });
                fl.y += ctx.body * 1.4;
                for (const part of question.parts.length ? question.parts : []) {
                    room(fl, 30 * ctx.s);
                    write(ctx, `${part.label}.`, fl.x + 40 * ctx.s, fl.y, 20 * ctx.s, { font: ctx.fonts.b, size: ctx.body });
                    write(ctx, `(${part.marks})`, fl.x, fl.y, fl.w, { size: ctx.body, align: "right" });
                    if (part.answer.length) drawBlocks(ctx, fl, part.answer, fl.x + 60 * ctx.s, fl.w - 60 * ctx.s - GUTTER * ctx.s, assets.images, true);
                    else { write(ctx, "No model answer added.", fl.x + 60 * ctx.s, fl.y, fl.w / 2, { font: ctx.fonts.i, size: ctx.cell }); fl.y += ctx.cell * 1.6; }
                }
                // Labelling pictures in the question itself carry their answers.
                const labelling = question.stem.filter(block => block.type === "labelling");
                if (labelling.length && !question.parts.some(part => part.answer.length)) drawBlocks(ctx, fl, labelling, fl.x + 40 * ctx.s, fl.w - 40 * ctx.s - GUTTER * ctx.s, assets.images, true);
                fl.y += 8 * ctx.s;
            }
        }
    } else if (mode === "esheet") {
        drawHeader(ctx, fl, paper, assets.logo);
        write(ctx, "E-SHEET: write the answers in the boxes below", fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body + 1, align: "center", underline: true });
        fl.y += ctx.body + 10 * ctx.s;
        for (const section of paper.sections) {
            sectionTitle(ctx, fl, section);
            for (const question of section.questions) {
                room(fl, 60 * ctx.s);
                write(ctx, `${question.label}:`, fl.x, fl.y, 44 * ctx.s, { font: ctx.fonts.b, size: ctx.body });
                write(ctx, `[${question.marks}]`, fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body, align: "right" });
                fl.y += ctx.body * 1.5;
                const parts = question.parts.length ? question.parts : [{ label: "", marks: question.marks, space: { mode: "box", size: 8 } }];
                for (const part of parts) {
                    const lines = part.space?.mode === "lines" ? part.space.size * 17 : part.space?.mode === "box" ? part.space.size * 14 : 7 * 17;
                    const h = lines * ctx.s;
                    room(fl, h + 20 * ctx.s);
                    if (part.label) write(ctx, `${part.label}.  (${part.marks})`, fl.x + 6, fl.y, fl.w / 2, { font: ctx.fonts.b, size: ctx.cell });
                    fl.y += part.label ? (ctx.cell + 3) * ctx.s : 0;
                    box(ctx, fl.x, fl.y, fl.w, h);
                    fl.y += h + 8 * ctx.s;
                }
            }
        }
    } else {
        drawHeader(ctx, fl, paper, assets.logo);
        for (const section of paper.sections) {
            sectionTitle(ctx, fl, section);
            for (const question of section.questions) drawQuestion(ctx, fl, question, assets.images);
        }
    }
    const count = doc.bufferedPageRange().count;
    const h = paper.header;
    for (let i = 0; i < count; i++) {
        doc.switchToPage(i);
        const y = size.height - margin + 2;
        if (h.className && mode !== "key") write(ctx, `Class: ${h.className}`, margin, y, size.width / 3, { font: ctx.fonts.b, size: ctx.cell - 1 });
        write(ctx, `Page ${i + 1} of ${count}`, 0, y, size.width, { font: ctx.fonts.b, size: ctx.cell - 1, align: "center" });
        if (h.subjectTitle && mode !== "key") write(ctx, `Subject: ${h.subjectTitle}`, size.width - margin - size.width / 3, y, size.width / 3, { font: ctx.fonts.b, size: ctx.cell - 1, align: "right" });
        write(ctx, FOOTER, 0, y + ctx.cell + 1, size.width, { font: ctx.fonts.i, size: 6.5, align: "center" });
    }
    return { pages: count };
}

// Draws at the largest size that fits the pages the teacher asked for.
async function renderPbaPdf(paper, { logo = null, mark = null, images = new Map(), mode = "paper", title = "PBA Paper", keep = true } = {}) {
    const layout = paper.layout;
    const scales = layout.pages && mode === "paper" ? SCALES_SINGLE : [1];
    const assets = { logo, mark, images };
    let last = null;
    for (const scale of scales) {
        const { doc, width, height } = newDocument(layout, { Title: latin(title), Author: "IlmiDunya Paper Maker", Creator: "IlmiDunya" });
        const result = drawPaper(doc, { width, height }, paper, assets, scale, mode);
        const fits = !layout.pages || mode !== "paper" || result.pages <= layout.pages;
        last = { doc, scale, fits, pages: result.pages };
        if (fits) break;
        if (scale !== scales[scales.length - 1]) last.doc.end();
    }
    const buffer = keep ? await collect(last.doc) : null;
    if (!keep) last.doc.end();
    return { buffer, info: { pages: last.pages, scale: last.scale, fits: last.fits, wanted: layout.pages || 0 } };
}

const measurePba = async (paper, options) => (await renderPbaPdf(paper, { ...options, keep: false })).info;

module.exports = { renderPbaPdf, measurePba, imageUrlsOf, SIZES };
