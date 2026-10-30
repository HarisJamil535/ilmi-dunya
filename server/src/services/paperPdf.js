const PDFDocument = require("pdfkit");

// Plain black-and-white exam papers on built-in PDF fonts (Helvetica or Times), laid out by hand so that
// tables never split a row, a paper can be squeezed into N pages, and two groups can share one sheet.
const SIZES = { A4: [595.28, 841.89], Letter: [612, 792] };
const FONTS = {
    sans: { r: "Helvetica", b: "Helvetica-Bold", i: "Helvetica-Oblique" },
    serif: { r: "Times-Roman", b: "Times-Bold", i: "Times-Italic" },
};
const INK = "#000000";
const LINE = 0.6;
const SCALES_SINGLE = [1, 0.97, 0.94, 0.91, 0.88, 0.86, 0.84];
const SCALES_TEAR = [1, 0.96, 0.92, 0.88, 0.85, 0.82, 0.8, 0.78];

// Built-in PDF fonts only draw Latin text; common maths symbols are spelled out and other scripts become "?".
const SYMBOLS = { "√": "sqrt", "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~", "∞": "infinity", "→": "->", "π": "pi", "θ": "theta", "α": "alpha", "β": "beta", "λ": "lambda", "μ": "mu", "Δ": "Delta", "ω": "omega", "“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-", "…": "..." };
const latin = value => String(value ?? "").replace(/[√≤≥≠≈∞→πθαβλμΔω“”‘’–—…]/g, char => SYMBOLS[char]).replace(/[^\x09\x0A\x20-\x7E -ÿ]/g, "?").replace(/[ \t]+/g, " ");
const hasNonLatin = value => /[^\x09\x0A\x20-\x7E -ÿ√≤≥≠≈∞→πθαβλμΔω“”‘’–—…]/.test(String(value ?? ""));

// ---- drawing helpers -------------------------------------------------------------------------------------------

function context(doc, layout, scale) {
    const fonts = FONTS[layout.font] || FONTS.sans;
    return { doc, fonts, s: scale, body: 10.5 * scale, cell: 9.5 * scale, pad: 3.2 * scale };
}

const measure = (ctx, value, width, font, size) => {
    ctx.doc.font(font).fontSize(size);
    return ctx.doc.heightOfString(latin(value) || " ", { width: Math.max(width, 4) });
};

function write(ctx, value, x, y, width, { font = ctx.fonts.r, size = ctx.cell, align = "left", underline = false } = {}) {
    ctx.doc.fillColor(INK).font(font).fontSize(size).text(latin(value), x, y, { width, align, underline, lineBreak: true });
}

// A flow tracks where the next block goes; it asks `onFull` for a new page, or records an overflow when it has none.
function flow(x, width, top, bottom, onFull) {
    return { x, w: width, y: top, top, bottom, onFull, overflow: 0 };
}
function room(fl, height, again) {
    if (fl.y + height <= fl.bottom) return;
    if (fl.onFull) { fl.onFull(); if (again) again(); } else fl.overflow = Math.max(fl.overflow, fl.y + height - fl.bottom);
}

function labelLine(ctx, label, x, y, width, value = "") {
    const { doc } = ctx;
    write(ctx, label, x, y, width, { font: ctx.fonts.b, size: ctx.cell });
    doc.font(ctx.fonts.b).fontSize(ctx.cell);
    const start = x + doc.widthOfString(latin(label)) + 3;
    if (value) write(ctx, value, start, y, x + width - start, { size: ctx.cell });
    doc.lineWidth(LINE).strokeColor(INK).moveTo(start, y + ctx.cell + 1.5).lineTo(x + width - 4, y + ctx.cell + 1.5).stroke();
}

function header(ctx, fl, paper, { group = "", logo = null } = {}) {
    const h = paper.header;
    const gap = 15.5 * ctx.s;
    if (!fl.compactHeader) {
        labelLine(ctx, "Name of Candidate:", fl.x, fl.y, fl.w * 0.6);
        labelLine(ctx, "Class/Section:", fl.x + fl.w * 0.62, fl.y, fl.w * 0.38);
        fl.y += gap;
        labelLine(ctx, "Roll No:", fl.x, fl.y, fl.w * 0.3);
        labelLine(ctx, "Date:", fl.x + fl.w * 0.32, fl.y, fl.w * 0.28, h.date);
        labelLine(ctx, "Sign. of Invigilator:", fl.x + fl.w * 0.62, fl.y, fl.w * 0.38);
        fl.y += gap + 3 * ctx.s;
    }
    const top = fl.y;
    const inset = logo ? 56 * ctx.s : 0;
    if (logo) { try { ctx.doc.image(logo, fl.x, top - 2, { fit: [48 * ctx.s, 48 * ctx.s] }); } catch { /* an unreadable logo is skipped */ } }
    const centre = (value, font, size, space = 1.5) => {
        if (!value) return;
        const height = measure(ctx, value, fl.w - inset * 2, font, size);
        write(ctx, value, fl.x + inset, fl.y, fl.w - inset * 2, { font, size, align: "center", underline: false });
        fl.y += height + space * ctx.s;
    };
    if (group) { write(ctx, group, fl.x + inset, fl.y, fl.w - inset * 2, { font: ctx.fonts.b, size: ctx.body + 2, align: "center", underline: true }); fl.y += ctx.body + 6 * ctx.s; }
    centre(h.schoolName, ctx.fonts.b, ctx.body + 3);
    centre(h.examName, ctx.fonts.b, ctx.body + 0.5);
    fl.y = Math.max(fl.y, top + (logo ? 48 * ctx.s : 0)) + 2 * ctx.s;
    const third = fl.w / 3;
    const subject = [h.subjectTitle, h.className].filter(Boolean).join(" - ") + (paper.versionCount > 1 && paper.layout.mode !== "tear" ? `   Paper: ${paper.version}` : "");
    const times = paper.timeLines || [];
    times.forEach((line, i) => write(ctx, line, fl.x, fl.y + i * (ctx.cell + 2.5 * ctx.s), third * 1.2, { font: ctx.fonts.b, size: ctx.cell }));
    write(ctx, subject, fl.x + third * 0.7, fl.y, third * 1.6, { font: ctx.fonts.b, size: ctx.cell, align: "center" });
    write(ctx, `Total Marks: ${paper.totalMarks}`, fl.x + third * 2, fl.y, third, { font: ctx.fonts.b, size: ctx.cell, align: "right" });
    fl.y += Math.max(1, times.length) * (ctx.cell + 2.5 * ctx.s) + 5 * ctx.s;
}

function sectionHead(ctx, fl, section) {
    const titleH = measure(ctx, section.title, fl.w, ctx.fonts.b, ctx.body + 1);
    const promptH = measure(ctx, section.prompt, fl.w, ctx.fonts.b, ctx.body);
    room(fl, titleH + promptH + 24 * ctx.s);
    fl.y += 3 * ctx.s;
    write(ctx, section.title, fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body + 1, align: "center" });
    fl.y += titleH + 3 * ctx.s;
    write(ctx, section.prompt, fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body });
    fl.y += promptH + 4 * ctx.s;
}

const box = (ctx, x, y, w, h) => ctx.doc.lineWidth(LINE).strokeColor(INK).rect(x, y, w, h).stroke();

function mcqTable(ctx, fl, section, bubbles) {
    const { doc } = ctx;
    const numW = 21 * ctx.s + 3;
    const bubW = bubbles ? 14.5 * ctx.s : 0;
    const qW = fl.w * 0.35;
    const optW = (fl.w - numW - qW - bubW * 4) / 4;
    const cols = [numW, qW, optW, optW, optW, optW];
    const xs = cols.reduce((list, width, i) => [...list, i ? list[i - 1] + cols[i - 1] : fl.x], []);
    const headerRow = () => {
        const h = ctx.cell + ctx.pad * 2 + 1;
        room(fl, h + 30 * ctx.s);
        cols.forEach((width, i) => box(ctx, xs[i], fl.y, width, h));
        write(ctx, "Question", xs[1], fl.y + ctx.pad + 0.5, qW, { font: ctx.fonts.b, align: "center" });
        ["A", "B", "C", "D"].forEach((letter, i) => write(ctx, letter, xs[2 + i], fl.y + ctx.pad + 0.5, optW, { font: ctx.fonts.b, align: "center" }));
        if (bubbles) ["A", "B", "C", "D"].forEach((letter, i) => { const x = fl.x + fl.w - bubW * 4 + bubW * i; box(ctx, x, fl.y, bubW, h); write(ctx, letter, x, fl.y + ctx.pad + 0.5, bubW, { font: ctx.fonts.b, size: ctx.cell - 1, align: "center" }); });
        fl.y += h;
    };
    headerRow();
    let scenarioNo = 0;
    for (const item of section.items) {
        if (item.type === "scenario") {
            scenarioNo += 1;
            const label = `Scenario ${scenarioNo} (Questions ${item.from}-${item.to}): `;
            const body = `${item.title && item.title !== "Scenario" ? `${item.title}. ` : ""}${item.text}`;
            const h = measure(ctx, label + body, fl.w - 8, ctx.fonts.r, ctx.cell) + ctx.pad * 2;
            room(fl, h + 30 * ctx.s, headerRow);
            box(ctx, fl.x, fl.y, fl.w, h);
            write(ctx, label, fl.x + 4, fl.y + ctx.pad, fl.w - 8, { font: ctx.fonts.b });
            const labelW = doc.font(ctx.fonts.b).fontSize(ctx.cell).widthOfString(latin(label));
            // The label and text share one paragraph: draw the body after the label on the first line.
            doc.font(ctx.fonts.r).fontSize(ctx.cell).fillColor(INK);
            doc.text(latin(body), fl.x + 4 + labelW, fl.y + ctx.pad, { width: fl.w - 8 - labelW, lineBreak: true, indent: 0, continued: false });
            fl.y += h;
            continue;
        }
        const qH = measure(ctx, item.text, qW - ctx.pad * 2, ctx.fonts.r, ctx.cell);
        const oH = Math.max(0, ...item.options.map(option => measure(ctx, option.text, optW - ctx.pad * 2, ctx.fonts.r, ctx.cell)));
        const h = Math.max(qH, oH, ctx.cell * 1.15) + ctx.pad * 2;
        room(fl, h, headerRow);
        cols.forEach((width, i) => box(ctx, xs[i], fl.y, width, h));
        write(ctx, String(item.no), xs[0], fl.y + (h - ctx.cell) / 2, numW, { font: ctx.fonts.b, align: "center" });
        write(ctx, item.text, xs[1] + ctx.pad, fl.y + (h - qH) / 2, qW - ctx.pad * 2);
        item.options.slice(0, 4).forEach((option, i) => {
            const height = measure(ctx, option.text, optW - ctx.pad * 2, ctx.fonts.r, ctx.cell);
            write(ctx, option.text, xs[2 + i] + ctx.pad, fl.y + (h - height) / 2, optW - ctx.pad * 2, { align: "center" });
        });
        if (bubbles) for (let i = 0; i < 4; i++) {
            const x = fl.x + fl.w - bubW * 4 + bubW * i;
            box(ctx, x, fl.y, bubW, h);
            doc.lineWidth(LINE).strokeColor(INK).circle(x + bubW / 2, fl.y + h / 2, 3.6 * ctx.s).stroke();
        }
        fl.y += h;
    }
    fl.y += 5 * ctx.s;
}

const labelText = item => `(${item.label})`;
function labelWidth(ctx, section) {
    ctx.doc.font(ctx.fonts.b).fontSize(ctx.cell);
    return Math.max(24 * ctx.s, ...section.items.map(item => ctx.doc.widthOfString(labelText(item)))) + 10 * ctx.s;
}

function writtenTable(ctx, fl, section) {
    const labelW = labelWidth(ctx, section);
    const marksW = 19 * ctx.s + 2;
    const orW = 24 * ctx.s + 2;
    const textW = (fl.w - labelW - marksW * 2 - orW) / 2;
    const xs = [fl.x, fl.x + labelW, fl.x + labelW + textW, fl.x + labelW + textW + marksW, fl.x + labelW + textW + marksW + orW, fl.x + labelW + textW * 2 + marksW + orW];
    const widths = [labelW, textW, marksW, orW, textW, marksW];
    for (const item of section.items) {
        const [a, b] = item.alternatives;
        const aH = measure(ctx, a.text, textW - ctx.pad * 2, ctx.fonts.r, ctx.cell);
        const bH = b ? measure(ctx, b.text, textW - ctx.pad * 2, ctx.fonts.r, ctx.cell) : 0;
        const h = Math.max(aH, bH, ctx.cell * 1.3) + ctx.pad * 2.4;
        room(fl, h);
        widths.forEach((width, i) => box(ctx, xs[i], fl.y, width, h));
        const mid = (size = ctx.cell) => fl.y + (h - size) / 2 + 0.5;
        write(ctx, labelText(item), xs[0], mid(), labelW, { font: ctx.fonts.b, align: "center" });
        write(ctx, a.text, xs[1] + ctx.pad, fl.y + (h - aH) / 2, textW - ctx.pad * 2);
        write(ctx, String(item.marks), xs[2], mid(), marksW, { align: "center" });
        write(ctx, "OR", xs[3], mid(), orW, { font: ctx.fonts.b, align: "center" });
        write(ctx, b.text, xs[4] + ctx.pad, fl.y + (h - bH) / 2, textW - ctx.pad * 2);
        write(ctx, String(item.marks), xs[5], mid(), marksW, { align: "center" });
        fl.y += h;
    }
    fl.y += 5 * ctx.s;
}

// Questions without a choice are plain numbered lines with the marks at the right.
function writtenLines(ctx, fl, section) {
    const labelW = labelWidth(ctx, section);
    const marksW = 30 * ctx.s;
    const textW = fl.w - labelW - marksW;
    for (const item of section.items) {
        const h = measure(ctx, item.alternatives[0].text, textW, ctx.fonts.r, ctx.body);
        room(fl, h + 6 * ctx.s);
        write(ctx, labelText(item), fl.x, fl.y, labelW, { font: ctx.fonts.b, size: ctx.body });
        write(ctx, item.alternatives[0].text, fl.x + labelW, fl.y, textW, { size: ctx.body });
        write(ctx, `[${item.marks}]`, fl.x + fl.w - marksW, fl.y, marksW, { font: ctx.fonts.b, size: ctx.body, align: "right" });
        fl.y += h + 5.5 * ctx.s;
    }
    fl.y += 3 * ctx.s;
}

function drawSection(ctx, fl, section, layout) {
    sectionHead(ctx, fl, section);
    if (section.kind === "mcq") mcqTable(ctx, fl, section, layout.bubbles);
    else if (section.choice) writtenTable(ctx, fl, section);
    else writtenLines(ctx, fl, section);
}

// ---- whole documents -------------------------------------------------------------------------------------------

function newDocument(layout, info) {
    const [width, height] = SIZES[layout.paper] || SIZES.A4;
    const doc = new PDFDocument({ autoFirstPage: false, size: [width, height], margins: { top: 0, bottom: 0, left: 0, right: 0 }, bufferPages: true, info });
    return { doc, width, height };
}

function collect(doc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.end();
    });
}

function drawSingle(doc, size, paper, logo, scale) {
    const layout = paper.layout;
    const ctx = context(doc, layout, scale);
    const margin = (layout.paper === "A4" ? 38 : 36) * Math.max(scale, 0.9);
    const fl = flow(margin, size.width - margin * 2, margin, size.height - margin - 14, null);
    doc.addPage();
    fl.onFull = () => { doc.addPage(); fl.y = margin; };
    header(ctx, fl, paper, { logo });
    let subjective = false;
    for (const section of paper.sections) {
        if (section.kind !== "mcq" && !subjective) {
            subjective = true;
            if (layout.subjectiveNewPage && fl.y > margin + 1) {
                doc.addPage(); fl.y = margin;
                labelLine(ctx, "Name of Candidate:", fl.x, fl.y, fl.w * 0.6);
                labelLine(ctx, "Roll No:", fl.x + fl.w * 0.62, fl.y, fl.w * 0.38);
                fl.y += 20 * ctx.s;
            }
        }
        drawSection(ctx, fl, section, layout);
    }
    const count = doc.bufferedPageRange().count;
    if (count > 1) for (let i = 0; i < count; i++) {
        doc.switchToPage(i);
        write(ctx, `Page ${i + 1} of ${count}`, 0, size.height - margin + 2, size.width, { size: 8, align: "center" });
    }
    return { pages: count, overflow: 0 };
}

// Two groups share a sheet: Group A in the top half and Group B in the bottom half of both sides, so the sheet tears in two.
// Each side is sized on its own, so a long front does not shrink the back.
function drawSide(doc, size, papers, logo, scale, side) {
    const layout = papers[0].layout;
    const ctx = context(doc, layout, scale);
    const margin = 30 * Math.max(scale, 0.85);
    const half = size.height / 2;
    let overflow = 0;
    doc.addPage();
    papers.slice(0, 2).forEach((paper, index) => {
        const fl = flow(margin, size.width - margin * 2, index * half + 14 * scale, (index + 1) * half - 10, null);
        const group = `Group ${paper.version}`;
        if (side === "front") header(ctx, fl, paper, { group, logo });
        else { write(ctx, group, fl.x, fl.y, fl.w, { font: ctx.fonts.b, size: ctx.body + 2, align: "center", underline: true }); fl.y += ctx.body + 8 * scale; }
        for (const section of paper.sections.filter(entry => (entry.kind === "mcq") === (side === "front"))) drawSection(ctx, fl, section, layout);
        overflow = Math.max(overflow, fl.overflow);
    });
    const cut = layout.cutLine === "both" || (layout.cutLine === "back" && side === "back");
    if (cut) doc.lineWidth(0.5).strokeColor(INK).dash(4, { space: 3 }).moveTo(18, half).lineTo(size.width - 18, half).stroke().undash();
    return overflow;
}

function sideScale(papers, logo, side) {
    const layout = papers[0].layout;
    for (const scale of SCALES_TEAR) {
        const { doc, width, height } = newDocument(layout, {});
        const overflow = drawSide(doc, { width, height }, papers, logo, scale, side);
        doc.end();
        if (!overflow) return { scale, overflow: 0 };
        if (scale === SCALES_TEAR[SCALES_TEAR.length - 1]) return { scale, overflow };
    }
}

// Draws the paper at the largest size that fits the pages the teacher asked for.
async function layoutAndRender(papers, { logo = null, title = "Question Paper", keep = true } = {}) {
    const layout = papers[0].layout;
    const meta = { Title: latin(title), Author: "IlmiDunya Paper Maker", Creator: "IlmiDunya" };
    if (layout.mode === "tear" && papers.length >= 2) {
        const front = sideScale(papers, logo, "front");
        const back = sideScale(papers, logo, "back");
        const info = { mode: "tear", pages: 2, scale: Math.min(front.scale, back.scale), fits: !front.overflow && !back.overflow, wanted: 2, overflow: Math.ceil(Math.max(front.overflow, back.overflow)), sides: { front: front.scale, back: back.scale } };
        if (!keep) return { buffer: null, info };
        const { doc, width, height } = newDocument(layout, meta);
        drawSide(doc, { width, height }, papers, logo, front.scale, "front");
        drawSide(doc, { width, height }, papers, logo, back.scale, "back");
        return { buffer: await collect(doc), info };
    }
    const scales = layout.pages ? SCALES_SINGLE : [1];
    let last = null;
    for (const scale of scales) {
        const { doc, width, height } = newDocument(layout, meta);
        const result = drawSingle(doc, { width, height }, papers[0], logo, scale);
        const fits = !layout.pages || result.pages <= layout.pages;
        last = { doc, scale, fits, pages: result.pages };
        if (fits) break;
        if (scale !== scales[scales.length - 1]) last.doc.end();
    }
    const buffer = keep ? await collect(last.doc) : null;
    if (!keep) last.doc.end();
    return { buffer, info: { mode: "single", pages: last.pages, scale: last.scale, fits: last.fits, wanted: layout.pages || 0, overflow: 0 } };
}

// How the paper fits, without keeping the file (used for the live "fits on N pages" check).
const measureLayout = async (papers, options) => (await layoutAndRender(papers, { ...options, keep: false })).info;
const renderPaperPdf = (papers, options) => layoutAndRender(Array.isArray(papers) ? papers : [papers], options);

// The answer key for every version, plain and black-and-white.
async function renderKeyPdf(papers, { title = "Answer Key", logo = null } = {}) {
    const first = papers[0];
    const { doc, width, height } = newDocument(first.layout, { Title: latin(`${title} - Answer Key`), Author: "IlmiDunya Paper Maker", Creator: "IlmiDunya" });
    const ctx = context(doc, first.layout, 1);
    const margin = 40;
    const fl = flow(margin, width - margin * 2, margin, height - margin, null);
    fl.onFull = () => { doc.addPage(); fl.y = margin; };
    doc.addPage();
    const inset = logo ? 56 : 0;
    if (logo) { try { doc.image(logo, margin, fl.y, { fit: [46, 46] }); } catch { /* skipped */ } }
    write(ctx, "ANSWER KEY", margin + inset, fl.y, fl.w - inset, { font: ctx.fonts.b, size: 16 });
    write(ctx, [first.header.schoolName, first.header.examName, [first.header.subjectTitle, first.header.className].filter(Boolean).join(" - ")].filter(Boolean).join("   |   "), margin + inset, fl.y + 22, fl.w - inset, { size: 10 });
    write(ctx, "For teachers only. Do not give this to students.", margin + inset, fl.y + 36, fl.w - inset, { font: ctx.fonts.i, size: 9 });
    fl.y += logo ? 64 : 58;
    for (const paper of papers) {
        room(fl, 70);
        write(ctx, papers.length > 1 ? `${first.layout.mode === "tear" ? "Group" : "Version"} ${paper.version}` : "MCQ answers", margin, fl.y, fl.w, { font: ctx.fonts.b, size: 12, underline: true });
        fl.y += 20;
        const keyed = paper.sections.filter(section => section.kind === "mcq");
        for (const section of keyed) {
            const cells = section.items.filter(item => item.type === "mcq");
            write(ctx, `${section.name}: ${cells.length} questions, ${section.marksEach} ${section.marksEach === 1 ? "mark" : "marks"} each`, margin, fl.y, fl.w, { font: ctx.fonts.b, size: 10 });
            fl.y += 16;
            const perRow = 10;
            const cell = fl.w / perRow;
            for (let i = 0; i < cells.length; i += perRow) {
                room(fl, 40);
                cells.slice(i, i + perRow).forEach((item, c) => {
                    const x = margin + c * cell;
                    box(ctx, x, fl.y, cell, 30);
                    write(ctx, String(item.no), x, fl.y + 3.5, cell, { size: 8, align: "center" });
                    write(ctx, item.answer, x, fl.y + 13.5, cell, { font: ctx.fonts.b, size: 12, align: "center" });
                });
                fl.y += 34;
            }
            fl.y += 6;
        }
        if (!keyed.length) { write(ctx, "This paper has no MCQ section.", margin, fl.y, fl.w, { size: 10 }); fl.y += 18; }
        const written = paper.sections.filter(section => section.kind !== "mcq");
        if (written.length && paper === first) {
            write(ctx, `Marking scheme: ${written.map(section => `${section.name} - ${section.attempt} x ${section.marksEach} = ${section.marks}`).join("; ")}.`, margin, fl.y, fl.w, { font: ctx.fonts.i, size: 9 });
            fl.y += 24;
        }
        fl.y += 10;
    }
    return collect(doc);
}

module.exports = { renderPaperPdf, renderKeyPdf, measureLayout, latin, hasNonLatin };
