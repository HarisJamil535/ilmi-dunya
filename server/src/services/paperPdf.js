const PDFDocument = require("pdfkit");

const PAGE = { width: 595.28, height: 841.89, margin: 36 };
const W = PAGE.width - PAGE.margin * 2;
const BOTTOM = PAGE.height - 56;
const INK = "#111111";
const GREY = "#555555";
const LIGHT = "#e9e9e9";

// Built-in PDF fonts only draw Latin text; common maths symbols are spelled out and other scripts become "?".
const SYMBOLS = { "√": "sqrt", "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~", "∞": "infinity", "→": "->", "π": "pi", "θ": "theta", "α": "alpha", "β": "beta", "λ": "lambda", "μ": "mu", "Δ": "Delta", "ω": "omega", "“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-", "…": "..." };
const latin = value => String(value ?? "").replace(/[√≤≥≠≈∞→πθαβλμΔω“”‘’–—…]/g, char => SYMBOLS[char]).replace(/[^\x09\x0A\x20-\x7E -ÿ]/g, "?").replace(/[ \t]+/g, " ");
const hasNonLatin = value => /[^\x09\x0A\x20-\x7E -ÿ√≤≥≠≈∞→πθαβλμΔω“”‘’–—…]/.test(String(value ?? ""));

class Sheet {
    constructor(info) {
        this.doc = new PDFDocument({ autoFirstPage: false, size: "A4", margins: { top: PAGE.margin, bottom: 40, left: PAGE.margin, right: PAGE.margin }, bufferPages: true, info });
        this.y = PAGE.margin;
        this.pageVersions = [];
        this.version = "";
        this.code = "";
    }
    newPage() {
        this.doc.addPage();
        this.pageVersions.push(this.version);
        this.y = PAGE.margin;
    }
    ensure(height) {
        if (this.y + height > BOTTOM) { this.newPage(); return true; }
        return false;
    }
    text(value, x, y, options = {}) {
        this.doc.text(latin(value), x, y, { lineBreak: options.width !== undefined, ...options });
    }
    height(value, width, font = "Helvetica", size = 9.5) {
        this.doc.font(font).fontSize(size);
        return this.doc.heightOfString(latin(value) || " ", { width });
    }
}

function rollBoxes(sheet, x, y, count) {
    const size = 15;
    sheet.doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
    sheet.text("Roll Number", x, y, { width: count * size, align: "center" });
    for (let i = 0; i < count; i++) sheet.doc.lineWidth(0.8).strokeColor(INK).rect(x + i * size, y + 13, size, size + 3).stroke();
}

async function header(sheet, paper, logo) {
    const { doc } = sheet;
    const h = paper.header;
    const left = PAGE.margin;
    const leftWidth = 200;
    let ly = sheet.y;
    if (logo) { try { doc.image(logo, left + (leftWidth - 70) / 2, ly, { fit: [70, 70], align: "center" }); ly += 76; } catch { /* unreadable logo is skipped */ } }
    doc.fillColor(INK);
    const centered = (value, font, size, gap = 2) => {
        if (!value) return;
        doc.font(font).fontSize(size);
        const height = doc.heightOfString(latin(value), { width: leftWidth, align: "center" });
        doc.text(latin(value), left, ly, { width: leftWidth, align: "center" });
        ly += height + gap;
    };
    centered(h.schoolName, "Helvetica-Bold", 11);
    centered(h.examName, "Helvetica", 9.5);
    centered(h.subjectTitle, "Helvetica-Bold", 15, 3);
    centered(h.className, "Helvetica-Bold", 11);
    centered(h.paperCode, "Helvetica", 8.5);
    centered(h.schemeNote, "Helvetica", 8.5, 4);
    centered(`Total Marks: ${paper.totalMarks}`, "Helvetica-Bold", 10);
    centered(h.timeAllowed ? `Time allowed: ${h.timeAllowed}` : "", "Helvetica", 9.5);
    centered(h.date ? `Date: ${h.date}` : "", "Helvetica", 9.5);

    const rightX = left + leftWidth + 14;
    let ry = sheet.y;
    if (h.showRollBoxes) { rollBoxes(sheet, rightX, ry, h.rollBoxCount); ry += 36; }
    // The version letter sits in the top-right corner.
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    sheet.text("Version", PAGE.width - PAGE.margin - 60, sheet.y, { width: 60, align: "center" });
    doc.font("Helvetica-Bold").fontSize(34);
    sheet.text(paper.version, PAGE.width - PAGE.margin - 60, sheet.y + 11, { width: 60, align: "center" });
    const textWidth = PAGE.width - PAGE.margin - rightX;
    if (h.instructions.length) {
        const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
        doc.font("Helvetica-Bold").fontSize(8.5);
        sheet.text("Instructions", rightX, ry, { lineBreak: false });
        ry += 12;
        h.instructions.forEach((line, i) => {
            doc.font("Helvetica-Bold").fontSize(8.5);
            const label = `${roman[i]}.`;
            sheet.text(label, rightX, ry, { lineBreak: false });
            doc.font("Helvetica").fontSize(8.5);
            const height = doc.heightOfString(latin(line), { width: textWidth - 22 });
            doc.text(latin(line), rightX + 22, ry, { width: textWidth - 22 });
            ry += height + 2.5;
        });
    }
    if (h.showSignatures) {
        const y = Math.max(ry + 14, ly) + 4;
        doc.lineWidth(0.7).strokeColor(INK);
        doc.moveTo(rightX, y + 14).lineTo(rightX + 120, y + 14).stroke();
        doc.moveTo(PAGE.width - PAGE.margin - 120, y + 14).lineTo(PAGE.width - PAGE.margin, y + 14).stroke();
        doc.font("Helvetica-Bold").fontSize(9);
        sheet.text("Candidate Sign.", rightX, y + 17, { lineBreak: false });
        sheet.text("Invigilator Sign.", PAGE.width - PAGE.margin - 120, y + 17, { lineBreak: false });
        ry = y + 30;
    }
    sheet.y = Math.max(ly, ry) + 8;
    doc.lineWidth(1.2).strokeColor(INK).moveTo(PAGE.margin, sheet.y).lineTo(PAGE.width - PAGE.margin, sheet.y).stroke();
    sheet.y += 10;
}

function sectionBar(sheet, section, letter) {
    const { doc } = sheet;
    const title = `${section.name.toUpperCase()} (Marks ${section.marks})  -  ${section.heading}`;
    const lineHeight = sheet.height(section.attemptLine, W - 16, "Helvetica-Oblique", 9) + (section.instructions ? sheet.height(section.instructions, W - 16, "Helvetica", 9) + 3 : 0);
    sheet.ensure(40 + lineHeight);
    doc.rect(PAGE.margin, sheet.y, W, 20).fill(LIGHT);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.5);
    sheet.text(title, PAGE.margin + 8, sheet.y + 5.5, { width: W - 16, lineBreak: false });
    sheet.y += 25;
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY);
    sheet.text(section.attemptLine, PAGE.margin + 8, sheet.y, { width: W - 16 });
    sheet.y += sheet.height(section.attemptLine, W - 16, "Helvetica-Oblique", 9) + 3;
    if (section.instructions) {
        doc.font("Helvetica").fontSize(9).fillColor(INK);
        sheet.text(section.instructions, PAGE.margin + 8, sheet.y, { width: W - 16 });
        sheet.y += sheet.height(section.instructions, W - 16) + 3;
    }
    sheet.y += 4;
    void letter;
}

function mcqTable(sheet, section) {
    const { doc } = sheet;
    const columns = Math.min(6, Math.max(4, ...section.items.filter(item => item.type === "mcq").map(item => item.options.length)));
    const qWidth = columns === 4 ? 232 : 200;
    const oWidth = (W - qWidth) / columns;
    const pad = 3.5;
    const head = () => {
        doc.rect(PAGE.margin, sheet.y, W, 17).fillAndStroke(LIGHT, INK);
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
        sheet.text("Question", PAGE.margin, sheet.y + 4.5, { width: qWidth, align: "center", lineBreak: false });
        for (let c = 0; c < columns; c++) sheet.text(String.fromCharCode(65 + c), PAGE.margin + qWidth + c * oWidth, sheet.y + 4.5, { width: oWidth, align: "center", lineBreak: false });
        sheet.y += 17;
    };
    const rowHeightFor = item => {
        const q = sheet.height(`${item.no}. ${item.text}`, qWidth - pad * 2);
        const o = Math.max(...item.options.map(option => sheet.height(option.text, oWidth - pad * 2)), 0);
        return Math.max(q, o) + pad * 2;
    };
    const drawGrid = (y, height) => {
        doc.lineWidth(0.6).strokeColor(INK).rect(PAGE.margin, y, W, height).stroke();
        let x = PAGE.margin + qWidth;
        for (let c = 0; c <= columns; c++) { doc.moveTo(x, y).lineTo(x, y + height).stroke(); x += oWidth; }
    };
    head();
    const items = section.items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type === "scenario") {
            const labelWidth = 120;
            const passage = `${item.title ? `${item.title}\n` : ""}${item.text}`;
            const height = Math.max(sheet.height(passage, W - labelWidth - pad * 2, "Helvetica", 9), 26) + pad * 2;
            const next = items[i + 1];
            if (sheet.y + height + (next ? rowHeightFor(next) : 0) > BOTTOM) { sheet.newPage(); head(); }
            const y = sheet.y;
            doc.rect(PAGE.margin, y, W, height).fillAndStroke("#f6f6f6", INK);
            doc.moveTo(PAGE.margin + labelWidth, y).lineTo(PAGE.margin + labelWidth, y + height).strokeColor(INK).stroke();
            doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
            const label = `SCENARIO #${items.slice(0, i).filter(entry => entry.type === "scenario").length + 1}\n(FOR QUESTIONS ${item.from}-${item.to})`;
            const labelHeight = doc.heightOfString(label, { width: labelWidth - 8, align: "center" });
            doc.text(label, PAGE.margin + 4, y + (height - labelHeight) / 2, { width: labelWidth - 8, align: "center" });
            doc.font("Helvetica").fontSize(9);
            doc.text(latin(passage), PAGE.margin + labelWidth + pad, y + pad, { width: W - labelWidth - pad * 2 });
            sheet.y += height;
            continue;
        }
        const height = rowHeightFor(item);
        if (sheet.y + height > BOTTOM) { sheet.newPage(); head(); }
        const y = sheet.y;
        drawGrid(y, height);
        doc.fillColor(INK).font("Helvetica").fontSize(9.5);
        doc.text(latin(`${item.no}. ${item.text}`), PAGE.margin + pad, y + pad, { width: qWidth - pad * 2 });
        item.options.forEach((option, c) => doc.text(latin(option.text), PAGE.margin + qWidth + c * oWidth + pad, y + pad, { width: oWidth - pad * 2 }));
        sheet.y += height;
    }
    sheet.y += 12;
}

function writtenSection(sheet, section) {
    const { doc } = sheet;
    const numberWidth = 34;
    const marksWidth = 40;
    const textWidth = W - numberWidth - marksWidth;
    for (const item of section.items) {
        const parts = item.alternatives.map((alt, i) => ({ label: item.alternatives.length > 1 ? `(${String.fromCharCode(97 + i)}) ` : "", text: alt.text }));
        const heights = parts.map(part => sheet.height(`${part.label}${part.text}`, textWidth, "Helvetica", 10.5));
        const total = heights.reduce((sum, value) => sum + value, 0) + (parts.length > 1 ? 18 : 0) + 8;
        sheet.ensure(Math.min(total, 160));
        const top = sheet.y;
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.5);
        sheet.text(`Q.${item.no}`, PAGE.margin, top, { lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(10);
        sheet.text(`[${item.marks}]`, PAGE.width - PAGE.margin - marksWidth, top, { width: marksWidth, align: "right", lineBreak: false });
        let y = top;
        parts.forEach((part, i) => {
            doc.font("Helvetica").fontSize(10.5).fillColor(INK);
            doc.text(latin(`${part.label}${part.text}`), PAGE.margin + numberWidth, y, { width: textWidth });
            y += heights[i];
            if (i < parts.length - 1) {
                doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREY);
                sheet.text("OR", PAGE.margin + numberWidth, y + 4, { width: textWidth, align: "center", lineBreak: false });
                y += 18;
            }
        });
        sheet.y = y + 10;
    }
}

function footers(sheet, paper) {
    const { doc } = sheet;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0;
        const y = PAGE.height - 34;
        doc.lineWidth(0.6).strokeColor(INK).moveTo(PAGE.margin, y - 8).lineTo(PAGE.width - PAGE.margin, y - 8).stroke();
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
        sheet.text(paper.header.paperCode || paper.header.examName || "", PAGE.margin, y, { width: 260, lineBreak: false });
        doc.font("Helvetica").fontSize(8).fillColor(GREY);
        sheet.text(paper.header.footerNote || "Prepared with IlmiDunya Paper Maker", PAGE.margin + 120, y + 1, { width: 280, align: "center", lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
        sheet.text(`${sheet.pageVersions[i] ? `Version ${sheet.pageVersions[i]}  |  ` : ""}Page ${i + 1} of ${range.count}`, PAGE.width - PAGE.margin - 160, y, { width: 160, align: "right", lineBreak: false });
    }
}

function finish(sheet) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        sheet.doc.on("data", chunk => chunks.push(chunk));
        sheet.doc.on("end", () => resolve(Buffer.concat(chunks)));
        sheet.doc.on("error", reject);
        sheet.doc.end();
    });
}

// One printed paper (one version).
async function renderPaperPdf(paper, { logo = null, title = "Question Paper" } = {}) {
    const sheet = new Sheet({ Title: latin(`${title} - Version ${paper.version}`), Author: "IlmiDunya Paper Maker", Creator: "IlmiDunya" });
    sheet.version = paper.version;
    sheet.newPage();
    await header(sheet, paper, logo);
    for (const section of paper.sections) {
        sectionBar(sheet, section);
        if (section.kind === "mcq") mcqTable(sheet, section);
        else writtenSection(sheet, section);
    }
    footers(sheet, paper);
    return finish(sheet);
}

// The answer key for every version, one block per version.
async function renderKeyPdf(papers, { title = "Answer Key", logo = null } = {}) {
    const sheet = new Sheet({ Title: latin(`${title} - Answer Key`), Author: "IlmiDunya Paper Maker", Creator: "IlmiDunya" });
    const first = papers[0];
    sheet.version = "";
    sheet.newPage();
    const { doc } = sheet;
    if (logo) { try { doc.image(logo, PAGE.margin, sheet.y, { fit: [46, 46] }); } catch { /* skipped */ } }
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(16);
    sheet.text("ANSWER KEY", PAGE.margin + (logo ? 56 : 0), sheet.y, { lineBreak: false });
    doc.font("Helvetica").fontSize(10);
    sheet.text([first.header.schoolName, first.header.examName, [first.header.subjectTitle, first.header.className].filter(Boolean).join(" - ")].filter(Boolean).join("   |   "), PAGE.margin + (logo ? 56 : 0), sheet.y + 22, { width: W - 60, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#b00020");
    sheet.text("FOR TEACHERS ONLY - do not distribute to students", PAGE.margin + (logo ? 56 : 0), sheet.y + 36, { lineBreak: false });
    sheet.y += logo ? 60 : 56;
    for (const paper of papers) {
        const keyed = paper.sections.filter(section => section.kind === "mcq");
        sheet.ensure(60);
        doc.rect(PAGE.margin, sheet.y, W, 20).fill(INK);
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11);
        sheet.text(`VERSION ${paper.version}`, PAGE.margin + 8, sheet.y + 5, { lineBreak: false });
        sheet.y += 28;
        for (const section of keyed) {
            doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
            sheet.text(`${section.name} - ${section.heading} (${section.items.filter(item => item.type === "mcq").length} questions x ${section.marksEach} marks)`, PAGE.margin, sheet.y, { lineBreak: false });
            sheet.y += 16;
            const cells = section.items.filter(item => item.type === "mcq");
            const perRow = 10;
            const cell = W / perRow;
            for (let i = 0; i < cells.length; i += perRow) {
                sheet.ensure(40);
                const row = cells.slice(i, i + perRow);
                row.forEach((item, c) => {
                    const x = PAGE.margin + c * cell;
                    doc.lineWidth(0.6).strokeColor(INK).rect(x, sheet.y, cell, 30).stroke();
                    doc.fillColor(GREY).font("Helvetica").fontSize(8);
                    sheet.text(String(item.no), x, sheet.y + 3.5, { width: cell, align: "center", lineBreak: false });
                    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12);
                    sheet.text(item.answer, x, sheet.y + 13.5, { width: cell, align: "center", lineBreak: false });
                });
                sheet.y += 34;
            }
            sheet.y += 6;
        }
        if (!keyed.length) { doc.fillColor(GREY).font("Helvetica").fontSize(10); sheet.text("This paper has no MCQ section.", PAGE.margin, sheet.y, { lineBreak: false }); sheet.y += 18; }
        const written = paper.sections.filter(section => section.kind !== "mcq");
        if (written.length && paper === papers[0]) {
            doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(9);
            sheet.text(`Marking scheme: ${written.map(section => `${section.name} - ${section.attempt} x ${section.marksEach} = ${section.marks}`).join("; ")}.`, PAGE.margin, sheet.y, { width: W });
            sheet.y += 24;
        }
        sheet.y += 10;
    }
    footers(sheet, { header: { paperCode: first.header.paperCode || first.header.examName, footerNote: "Answer key - IlmiDunya Paper Maker" } });
    return finish(sheet);
}

module.exports = { renderPaperPdf, renderKeyPdf, latin, hasNonLatin };
