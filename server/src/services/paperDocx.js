const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, PageNumber, ImageRun, BorderStyle, ShadingType, VerticalAlign, PageBreak, TabStopType } = require("docx");

const FONT = "Arial";
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "111111" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const WIDTH = 10400; // A4 with 0.5 inch margins, in twips

const run = (value, options = {}) => new TextRun({ text: String(value ?? ""), font: FONT, size: 19, ...options });
const para = (children, options = {}) => new Paragraph({ spacing: { after: 40 }, children: Array.isArray(children) ? children : [run(children)], ...options });
const centered = (value, options = {}) => para([run(value, options)], { alignment: AlignmentType.CENTER });
const cell = (children, options = {}) => new TableCell({ borders: BORDERS, verticalAlign: VerticalAlign.CENTER, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: Array.isArray(children) ? children : [para(children)], ...options });
const lines = value => String(value ?? "").split("\n").map(line => para(line));

function imageRun(buffer, size) {
    try { return new ImageRun({ data: buffer, transformation: { width: size, height: size }, type: /^\x89PNG/.test(buffer.subarray(0, 4).toString("binary")) ? "png" : "jpg" }); } catch { return null; }
}

function headerBlock(paper, logo) {
    const h = paper.header;
    const left = [];
    if (logo) { const image = imageRun(logo, 64); if (image) left.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [image] })); }
    if (h.schoolName) left.push(centered(h.schoolName, { bold: true, size: 22 }));
    if (h.examName) left.push(centered(h.examName));
    if (h.subjectTitle) left.push(centered(h.subjectTitle, { bold: true, size: 30 }));
    if (h.className) left.push(centered(h.className, { bold: true, size: 22 }));
    if (h.paperCode) left.push(centered(h.paperCode, { size: 17 }));
    if (h.schemeNote) left.push(centered(h.schemeNote, { size: 17 }));
    left.push(centered(`Total Marks: ${paper.totalMarks}`, { bold: true }));
    if (h.timeAllowed) left.push(centered(`Time allowed: ${h.timeAllowed}`));
    if (h.date) left.push(centered(`Date: ${h.date}`));
    const right = [];
    if (h.showRollBoxes) {
        right.push(para([run("Roll Number", { bold: true })]));
        right.push(new Table({ width: { size: h.rollBoxCount * 380, type: WidthType.DXA }, columnWidths: Array(h.rollBoxCount).fill(380), rows: [new TableRow({ height: { value: 380, rule: "atLeast" }, children: Array.from({ length: h.rollBoxCount }, () => cell("", { width: { size: 380, type: WidthType.DXA } })) })] }));
        right.push(para(""));
    }
    if (h.instructions.length) {
        right.push(para([run("Instructions", { bold: true, size: 17 })]));
        const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
        h.instructions.forEach((line, i) => right.push(para([run(`${roman[i]}. `, { bold: true, size: 17 }), run(line, { size: 17 })])));
    }
    if (h.showSignatures) right.push(para([run("\nCandidate Sign. ______________      Invigilator Sign. ______________", { bold: true, size: 17 })], { spacing: { before: 200 } }));
    return new Table({
        width: { size: WIDTH, type: WidthType.DXA }, columnWidths: [3600, 5900, 900],
        rows: [new TableRow({ children: [
            new TableCell({ borders: NO_BORDERS, width: { size: 3600, type: WidthType.DXA }, children: left }),
            new TableCell({ borders: NO_BORDERS, width: { size: 5900, type: WidthType.DXA }, children: right.length ? right : [para("")] }),
            new TableCell({ borders: NO_BORDERS, width: { size: 900, type: WidthType.DXA }, children: [centered("Version", { size: 17 }), centered(paper.version, { bold: true, size: 64 })] }),
        ] })],
    });
}

function sectionTitle(section) {
    const out = [new Paragraph({ spacing: { before: 200, after: 60 }, shading: { type: ShadingType.CLEAR, fill: "E9E9E9", color: "auto" }, children: [run(`${section.name.toUpperCase()} (Marks ${section.marks})  -  ${section.heading}`, { bold: true, size: 21 })] }),
        para([run(section.attemptLine, { italics: true, size: 18, color: "555555" })])];
    if (section.instructions) out.push(para(section.instructions));
    return out;
}

function mcqTable(section) {
    const columns = Math.min(6, Math.max(4, ...section.items.filter(item => item.type === "mcq").map(item => item.options.length)));
    const qWidth = columns === 4 ? 4400 : 3600;
    const oWidth = Math.floor((WIDTH - qWidth) / columns);
    const widths = [qWidth, ...Array(columns).fill(oWidth)];
    const shaded = { type: ShadingType.CLEAR, fill: "E9E9E9", color: "auto" };
    const rows = [new TableRow({ tableHeader: true, children: ["Question", ...Array.from({ length: columns }, (_, c) => String.fromCharCode(65 + c))].map((label, i) => cell([centered(label, { bold: true })], { width: { size: widths[i], type: WidthType.DXA }, shading: shaded })) })];
    let scenarioNo = 0;
    for (const item of section.items) {
        if (item.type === "scenario") {
            scenarioNo += 1;
            rows.push(new TableRow({ cantSplit: true, children: [
                cell([centered(`SCENARIO #${scenarioNo}`, { bold: true }), centered(`(FOR QUESTIONS ${item.from}-${item.to})`, { bold: true })], { width: { size: 2000, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "F6F6F6", color: "auto" } }),
                cell([...(item.title ? [para([run(item.title, { bold: true })])] : []), ...lines(item.text)], { columnSpan: columns, width: { size: WIDTH - 2000, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "F6F6F6", color: "auto" } }),
            ] }));
            continue;
        }
        rows.push(new TableRow({ cantSplit: true, children: [
            cell(`${item.no}. ${item.text}`, { width: { size: qWidth, type: WidthType.DXA } }),
            ...Array.from({ length: columns }, (_, c) => cell(item.options[c]?.text || "", { width: { size: oWidth, type: WidthType.DXA } })),
        ] }));
    }
    return new Table({ width: { size: WIDTH, type: WidthType.DXA }, columnWidths: widths, rows });
}

function writtenBlocks(section) {
    const out = [];
    for (const item of section.items) {
        item.alternatives.forEach((alt, i) => {
            out.push(new Paragraph({
                spacing: { before: i === 0 ? 120 : 0, after: 60 }, tabStops: [{ type: TabStopType.RIGHT, position: WIDTH }], indent: { left: 640, hanging: 640 },
                children: [run(i === 0 ? `Q.${item.no}\t` : "\t", { bold: true, size: 21 }), run(`${item.alternatives.length > 1 ? `(${String.fromCharCode(97 + i)}) ` : ""}${alt.text}`, { size: 21 }), ...(i === 0 ? [run(`\t[${item.marks}]`, { bold: true, size: 21 })] : [])],
            }));
            if (i < item.alternatives.length - 1) out.push(centered("OR", { bold: true, color: "555555" }));
        });
    }
    return out;
}

const footer = (paper, withVersion = true) => new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: WIDTH }], border: { top: BORDER }, children: [
    run(paper.header.paperCode || paper.header.examName || "", { bold: true, size: 17 }),
    run(`   ${paper.header.footerNote || "Prepared with IlmiDunya Paper Maker"}`, { size: 15, color: "555555" }),
    run(`\t${withVersion ? `Version ${paper.version}  |  ` : ""}Page `, { bold: true, size: 17 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17, bold: true }), run(" of ", { bold: true, size: 17 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 17, bold: true }),
] })] });

const page = { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 900, left: 750, right: 750 } };

async function renderPaperDocx(paper, { logo = null } = {}) {
    const children = [headerBlock(paper, logo), para("")];
    for (const section of paper.sections) {
        children.push(...sectionTitle(section));
        if (section.kind === "mcq") children.push(mcqTable(section), para(""));
        else children.push(...writtenBlocks(section));
    }
    const doc = new Document({ creator: "IlmiDunya Paper Maker", title: `${paper.header.subjectTitle || "Question Paper"} - Version ${paper.version}`, styles: { default: { document: { run: { font: FONT, size: 19 } } } }, sections: [{ properties: { page }, footers: { default: footer(paper) }, children }] });
    return Packer.toBuffer(doc);
}

async function renderKeyDocx(papers, { logo = null } = {}) {
    const first = papers[0];
    const children = [];
    if (logo) { const image = imageRun(logo, 50); if (image) children.push(new Paragraph({ children: [image] })); }
    children.push(para([run("ANSWER KEY", { bold: true, size: 36 })]));
    children.push(para([run([first.header.schoolName, first.header.examName, [first.header.subjectTitle, first.header.className].filter(Boolean).join(" - ")].filter(Boolean).join("   |   "))]));
    children.push(para([run("FOR TEACHERS ONLY - do not distribute to students", { bold: true, color: "B00020", size: 18 })]));
    papers.forEach((paper, index) => {
        children.push(new Paragraph({ pageBreakBefore: index > 0, spacing: { before: 240, after: 100 }, shading: { type: ShadingType.CLEAR, fill: "111111", color: "auto" }, children: [run(`VERSION ${paper.version}`, { bold: true, color: "FFFFFF", size: 24 })] }));
        for (const section of paper.sections.filter(entry => entry.kind === "mcq")) {
            const cells = section.items.filter(item => item.type === "mcq");
            children.push(para([run(`${section.name} - ${section.heading} (${cells.length} questions x ${section.marksEach} marks)`, { bold: true, size: 21 })], { spacing: { before: 120 } }));
            const perRow = 10;
            const width = Math.floor(WIDTH / perRow);
            const rows = [];
            for (let i = 0; i < cells.length; i += perRow) {
                const row = cells.slice(i, i + perRow);
                rows.push(new TableRow({ children: Array.from({ length: perRow }, (_, c) => row[c]
                    ? cell([centered(String(row[c].no), { size: 15, color: "555555" }), centered(row[c].answer, { bold: true, size: 26 })], { width: { size: width, type: WidthType.DXA } })
                    : new TableCell({ borders: NO_BORDERS, width: { size: width, type: WidthType.DXA }, children: [para("")] })) }));
            }
            children.push(new Table({ width: { size: width * perRow, type: WidthType.DXA }, columnWidths: Array(perRow).fill(width), rows }));
        }
        const written = paper.sections.filter(entry => entry.kind !== "mcq");
        if (index === 0 && written.length) children.push(para([run(`Marking scheme: ${written.map(section => `${section.name} - ${section.attempt} x ${section.marksEach} = ${section.marks}`).join("; ")}.`, { italics: true, color: "555555", size: 18 })], { spacing: { before: 160 } }));
    });
    const doc = new Document({ creator: "IlmiDunya Paper Maker", title: "Answer Key", styles: { default: { document: { run: { font: FONT, size: 19 } } } }, sections: [{ properties: { page }, footers: { default: footer({ header: { paperCode: first.header.paperCode || first.header.examName, footerNote: "Answer key - IlmiDunya Paper Maker" } }, false) }, children }] });
    return Packer.toBuffer(doc);
}

module.exports = { renderPaperDocx, renderKeyDocx, PageBreak };
