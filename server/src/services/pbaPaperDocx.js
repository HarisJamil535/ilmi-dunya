const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, PageNumber, ImageRun, VerticalAlign, TabStopType, HeightRule, BorderStyle } = require("docx");
const { internals } = require("./paperDocx");
const { paragraphs } = require("./pbaContent");
const { imageSize } = require("./imageSize");

// The PBA paper as an editable Word file, in the same structure as the PDF.
const { kit, markHeader, finishDocx, embedded, PAGES, FOOTER_TEXT, BORDERS, NO_BORDERS } = internals;
const CIRCLED = ["⓪", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
const PX = 96 / 72;
const MONO = "Courier New";

const pic = (buffer, widthPt, heightPt) => { const dims = imageSize(buffer); if (!dims) return null; try { return new ImageRun({ type: dims.type === "png" ? "png" : "jpg", data: buffer, transformation: { width: Math.round(widthPt * PX), height: Math.round(heightPt * PX) } }); } catch { return null; } };

function runsOf(k, runs, extra = {}) {
    return runs.map(run => k.run(run.text, { bold: run.bold, italics: run.italic, underline: run.underline ? {} : undefined, size: k.body, ...extra }));
}

// Blocks become paragraphs and tables. `lead` puts the question or part label (and its marks) on the first line of text.
function blockElements(k, blocks, { indent, width, images, reveal = false, lead = null }) {
    const out = [];
    let pending = lead;
    const tabs = [{ type: TabStopType.LEFT, position: indent }, { type: TabStopType.RIGHT, position: width }];
    const emitLead = () => { if (pending) { out.push(new Paragraph({ spacing: { before: 100, after: 40 }, tabStops: tabs, indent: { left: indent, hanging: indent }, children: [k.run(pending.label, { bold: true, size: k.body }), k.run("\t"), k.run(pending.marks ? `\t${pending.marks}` : "", { bold: pending.boldMarks, size: k.body })] })); pending = null; } };
    for (const block of blocks || []) {
        if (block.type === "text") {
            for (const item of paragraphs(block.text)) {
                const items = item.type === "p" ? [{ runs: item.runs }] : item.items;
                items.forEach((entry, index) => {
                    const prefix = item.type === "ul" ? "•\t" : item.type === "ol" ? `${entry.number ?? index + 1}.\t` : "";
                    if (pending && item.type === "p") {
                        const lead2 = pending; pending = null;
                        out.push(new Paragraph({ spacing: { before: 100, after: 40 }, tabStops: tabs, indent: { left: indent, hanging: indent }, children: [k.run(lead2.label, { bold: true, size: k.body }), k.run("\t"), ...runsOf(k, entry.runs), k.run(lead2.marks ? `\t${lead2.marks}` : "", { bold: lead2.boldMarks, size: k.body })] }));
                    } else {
                        emitLead();
                        out.push(new Paragraph({ spacing: { before: 20, after: 40 }, indent: { left: indent + (prefix ? 300 : 0), hanging: prefix ? 300 : 0 }, tabStops: [{ type: TabStopType.LEFT, position: indent + 300 }], children: [...(prefix ? [k.run(prefix, { size: k.body })] : []), ...runsOf(k, entry.runs)] }));
                    }
                });
            }
        } else {
            emitLead();
            if (block.type === "code") {
                const w = width - indent - 600;
                out.push(new Table({ width: { size: w, type: WidthType.DXA }, columnWidths: [w], indent: { size: indent, type: WidthType.DXA }, rows: [new TableRow({ cantSplit: true, children: [new TableCell({ borders: BORDERS, width: { size: w, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: block.code.split("\n").map(line => new Paragraph({ spacing: { after: 0, line: 252 }, children: [new TextRun({ text: line, font: MONO, size: Math.max(14, k.cell - 2) })] })) })] })] }));
                out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
            } else if (block.type === "image") {
                const buffer = images.get(block.url); const dims = buffer && imageSize(buffer);
                if (dims) { const share = { small: 130, medium: 210, large: 320 }[block.size] || 210; const w = Math.min(share, dims.width * 0.75); const run = pic(buffer, w, w * dims.height / dims.width); if (run) out.push(new Paragraph({ indent: { left: indent }, spacing: { after: 60 }, children: [run] })); }
                if (block.caption) out.push(new Paragraph({ indent: { left: indent }, children: [k.run(block.caption, { italics: true, size: k.cell - 2 })] }));
            } else if (block.type === "table") {
                const w = width - indent - 600; const cols = block.rows[0].length; const cw = Math.floor(w / cols);
                out.push(new Table({ width: { size: cw * cols, type: WidthType.DXA }, columnWidths: Array(cols).fill(cw), indent: { size: indent, type: WidthType.DXA }, rows: block.rows.map((row, r) => new TableRow({ cantSplit: true, height: row.every(cell => !cell) ? { value: 560, rule: HeightRule.ATLEAST } : undefined, children: row.map(cell => new TableCell({ borders: BORDERS, width: { size: cw, type: WidthType.DXA }, margins: { top: 50, bottom: 50, left: 90, right: 90 }, children: [new Paragraph({ spacing: { after: 0 }, children: [k.run(cell, { bold: block.header && r === 0 })] })] })) })) }));
                out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
            } else if (block.type === "labelling") {
                const w = width - indent - 600; const widths = [0.3, 0.3, 0.4].map(share => Math.floor(share * w));
                const head = new TableRow({ tableHeader: true, children: block.columns.map((c, i) => new TableCell({ borders: BORDERS, width: { size: widths[i], type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [k.run(c, { bold: true })] })] })) });
                const rows = block.items.map(item => {
                    const buffer = item.image && images.get(item.image); const dims = buffer && imageSize(buffer);
                    let run = null; if (dims) { const maxW = 90; const maxH = 66; const s = Math.min(maxW / dims.width, maxH / dims.height); run = pic(buffer, dims.width * s, dims.height * s); }
                    const text = value => new TableCell({ borders: BORDERS, width: { size: widths[1], type: WidthType.DXA }, children: [new Paragraph({ children: [k.run(reveal ? value : "")] })] });
                    return new TableRow({ cantSplit: true, height: { value: 1150, rule: HeightRule.ATLEAST }, children: [new TableCell({ borders: BORDERS, width: { size: widths[0], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: run ? [run] : [] })] }), text(item.name), new TableCell({ borders: BORDERS, width: { size: widths[2], type: WidthType.DXA }, children: [new Paragraph({ children: [k.run(reveal ? item.purpose : "")] })] })] });
                });
                out.push(new Table({ width: { size: w, type: WidthType.DXA }, columnWidths: widths, indent: { size: indent, type: WidthType.DXA }, rows: [head, ...rows] }));
                out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
            }
        }
    }
    emitLead();
    return out;
}

function spaceElements(space, indent, width) {
    if (!space || space.mode === "none" || !space.size) return [];
    if (space.mode === "lines") return Array.from({ length: space.size }, () => new Paragraph({ spacing: { before: 280, after: 0 }, indent: { left: indent }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 1 } }, children: [] }));
    const w = width - indent - 300;
    return [new Table({ width: { size: w, type: WidthType.DXA }, columnWidths: [w], indent: { size: indent, type: WidthType.DXA }, rows: [new TableRow({ cantSplit: true, height: { value: space.size * 280, rule: HeightRule.EXACT }, children: [new TableCell({ borders: BORDERS, width: { size: w, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] })] })] }), new Paragraph({ spacing: { after: 80 }, children: [] })];
}

function headerElements(k, paper, width, logo) {
    const h = paper.header; const roll = paper.layout.rollNumber; const digits = paper.layout.rollDigits;
    const fields = h.candidateFields;
    const left = fields.map(field => new Paragraph({ spacing: { before: 120, after: 120 }, children: [k.run(`${field}: `, { bold: true }), k.run(field.toLowerCase() === "date" && h.date ? h.date : "_".repeat(18))] }));
    const image = logo ? (() => { const dims = imageSize(logo); return dims ? pic(logo, 44, 44 * dims.height / dims.width) : null; })() : null;
    const mid = [...(image ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [image] })] : []), ...[h.schoolName, h.examName, h.paperTitle, h.session].filter(Boolean).map((line, i) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 }, children: [k.run(line, { bold: true, size: i === 0 ? k.body + 3 : k.body })] }))];
    const leftW = Math.floor(width * (roll ? 0.36 : 0.4)); const rollW = roll ? Math.floor(width * 0.3) : 0; const midW = width - leftW - rollW;
    const cells = [
        new TableCell({ borders: BORDERS, width: { size: leftW, type: WidthType.DXA }, margins: { left: 100, right: 60 }, children: left }),
        new TableCell({ borders: BORDERS, width: { size: midW, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: mid }),
    ];
    if (roll) {
        const col = Math.floor((rollW - 120) / digits);
        const grid = new Table({ width: { size: col * digits, type: WidthType.DXA }, columnWidths: Array(digits).fill(col), rows: [
            new TableRow({ height: { value: 300, rule: HeightRule.EXACT }, children: Array.from({ length: digits }, () => new TableCell({ borders: BORDERS, width: { size: col, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] })) }),
            ...CIRCLED.map(sign => new TableRow({ height: { value: 215, rule: HeightRule.EXACT }, children: Array.from({ length: digits }, () => new TableCell({ borders: NO_BORDERS, width: { size: col, type: WidthType.DXA }, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, line: 200, lineRule: "exact" }, children: [new TextRun({ text: sign, size: 14, font: "Arial" })] })] })) })),
        ] });
        cells.push(new TableCell({ borders: BORDERS, width: { size: rollW, type: WidthType.DXA }, margins: { left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [k.run("Roll Number", { bold: true, size: k.cell - 2 })] }), grid] }));
    }
    const out = [new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: roll ? [leftW, midW, rollW] : [leftW, midW], rows: [new TableRow({ cantSplit: true, children: cells })] })];
    out.push(new Paragraph({ spacing: { before: 100, after: 40 }, tabStops: [{ type: TabStopType.RIGHT, position: width }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 3 } }, children: [k.run(`Total Marks: ${paper.totalMarks}`, { bold: true, size: k.body }), k.run(h.timeAllowed ? `\tTime: ${h.timeAllowed}` : "", { bold: true, size: k.body })] }));
    if (h.note) out.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [k.run(h.note, { bold: true, size: k.body })] }));
    return out;
}

const sectionHead = (k, section) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 }, keepNext: true, children: [k.run(section.title, { bold: true, underline: {}, size: k.body + 2 })] });

function pbaFooter(k, paper, mode) {
    const h = paper.header; const width = 10400;
    const bold = { bold: true, size: 15 };
    return new Footer({ children: [
        new Paragraph({ tabStops: [{ type: TabStopType.CENTER, position: Math.round(width / 2) }, { type: TabStopType.RIGHT, position: width }], children: [k.run(h.className && mode !== "key" ? `Class: ${h.className}` : "", bold), k.run("\tPage ", bold), new TextRun({ children: [PageNumber.CURRENT], font: k.font, ...bold }), k.run(" of ", bold), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: k.font, ...bold }), k.run(h.subjectTitle && mode !== "key" ? `\tSubject: ${h.subjectTitle}` : "", bold)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [k.run(FOOTER_TEXT, { size: 13, italics: true })] }),
    ] });
}

async function renderPbaDocx(paper, { logo = null, mark = null, images = new Map(), scale = 1, mode = "paper" } = {}) {
    const layout = paper.layout;
    const dims = PAGES[layout.paper] || PAGES.A4;
    const k = kit(layout, scale);
    const width = dims.width - 1440;
    const children = [];
    const stem = 640;
    const common = { images, width };
    if (mode === "key") {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [k.run("ANSWER KEY", { bold: true, size: 36 })] }));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [k.run([paper.header.schoolName, paper.header.paperTitle, paper.header.session, paper.versionCount > 1 ? `Paper ${paper.version}` : ""].filter(Boolean).join("  |  "))] }));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [k.run("For teachers only. Do not give this to students.", { italics: true, size: 18 })] }));
        for (const section of paper.sections) {
            children.push(sectionHead(k, section));
            for (const question of section.questions) {
                children.push(new Paragraph({ spacing: { before: 120 }, tabStops: [{ type: TabStopType.RIGHT, position: width }], keepNext: true, children: [k.run(`${question.label}:`, { bold: true, size: k.body }), k.run(`\t[${question.marks}]`, { bold: true, size: k.body })] }));
                for (const part of question.parts) {
                    if (part.answer.length) children.push(...blockElements(k, part.answer, { ...common, indent: stem, reveal: true, lead: { label: `${part.label}.`, marks: `(${part.marks})` } }));
                    else children.push(new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: width }], indent: { left: stem }, children: [k.run(`${part.label}.  `, { bold: true }), k.run("No model answer added.", { italics: true }), k.run(`\t(${part.marks})`)] }));
                }
                const labelling = question.stem.filter(block => block.type === "labelling");
                if (labelling.length && !question.parts.some(part => part.answer.length)) children.push(...blockElements(k, labelling, { ...common, indent: stem, reveal: true }));
            }
        }
    } else if (mode === "esheet") {
        children.push(...headerElements(k, paper, width, logo));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 }, children: [k.run("E-SHEET: write the answers in the boxes below", { bold: true, underline: {}, size: k.body + 2 })] }));
        for (const section of paper.sections) {
            children.push(sectionHead(k, section));
            for (const question of section.questions) {
                children.push(new Paragraph({ spacing: { before: 120 }, keepNext: true, tabStops: [{ type: TabStopType.RIGHT, position: width }], children: [k.run(`${question.label}:`, { bold: true, size: k.body }), k.run(`\t[${question.marks}]`, { bold: true, size: k.body })] }));
                const parts = question.parts.length ? question.parts : [{ label: "", marks: question.marks, space: { mode: "box", size: 8 } }];
                for (const part of parts) {
                    const lines = part.space?.mode === "lines" ? part.space.size * 17 : part.space?.mode === "box" ? part.space.size * 14 : 7 * 17;
                    if (part.label) children.push(new Paragraph({ keepNext: true, spacing: { before: 60, after: 20 }, children: [k.run(`${part.label}.  (${part.marks})`, { bold: true })] }));
                    children.push(new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [width], rows: [new TableRow({ cantSplit: true, height: { value: Math.round(lines * 20), rule: HeightRule.EXACT }, children: [new TableCell({ borders: BORDERS, width: { size: width, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] })] })] }));
                    children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
                }
            }
        }
    } else {
        children.push(...headerElements(k, paper, width, logo));
        for (const section of paper.sections) {
            children.push(sectionHead(k, section));
            for (const question of section.questions) {
                const lead = { label: `${question.label}:`, marks: `[${question.marks}]`, boldMarks: true };
                if (question.stem.length) children.push(...blockElements(k, question.stem, { ...common, indent: stem, lead }));
                else children.push(new Paragraph({ spacing: { before: 100 }, keepNext: true, tabStops: [{ type: TabStopType.RIGHT, position: width }], children: [k.run(lead.label, { bold: true, size: k.body }), k.run(`\t${lead.marks}`, { bold: true, size: k.body })] }));
                for (const part of question.parts) {
                    children.push(...blockElements(k, part.blocks, { ...common, indent: stem, lead: { label: `${part.label}.`, marks: `(${part.marks})` } }));
                    children.push(...spaceElements(part.space, stem, width));
                }
            }
        }
    }
    const meta = { creator: "IlmiDunya Paper Maker", title: paper.header.paperTitle || "PBA Paper", fonts: embedded(layout.font), styles: { default: { document: { run: { font: k.font, size: k.cell } } } } };
    const page = [{ top: 0, height: dims.height }];
    const properties = { page: { size: { width: dims.width, height: dims.height }, margin: { top: 720, bottom: 900, left: 720, right: 720 } } };
    const file = await Packer.toBuffer(new Document({ ...meta, sections: [{ properties, headers: { default: markHeader(k, layout, dims, mark, page) }, footers: { default: pbaFooter(k, paper, mode) }, children }] }));
    return finishDocx(file, { layout, dims, font: k.font, areas: page, embeds: meta.fonts.length > 0 });
}

module.exports = { renderPbaDocx };
