const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, PageNumber, ImageRun, BorderStyle, VerticalAlign, TabStopType, HeightRule } = require("docx");

// Plain black-and-white Word version of the paper, matching the PDF: tables only for either/or questions,
// bubble columns for MCQs, and (for two groups on one sheet) a fixed-height table per half so the sheet tears in two.
const PAGES = { A4: { width: 11906, height: 16838 }, Letter: { width: 12240, height: 15840 } };
const FONTS = { sans: "Arial", serif: "Times New Roman" };
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const DASHED = { style: BorderStyle.DASHED, size: 4, color: "000000" };

function kit(layout, scale) {
    const font = FONTS[layout.font] || FONTS.sans;
    const body = Math.round(10.5 * scale * 2);
    const cell = Math.round(9.5 * scale * 2);
    const run = (value, options = {}) => new TextRun({ text: String(value ?? ""), font, size: cell, ...options });
    const para = (children, options = {}) => new Paragraph({ spacing: { after: 0, line: 240 }, children: Array.isArray(children) ? children : [run(children)], ...options });
    const pad = Math.round(50 * scale);
    const tableCell = (children, width, options = {}) => new TableCell({
        borders: BORDERS, verticalAlign: VerticalAlign.CENTER, width: { size: width, type: WidthType.DXA },
        margins: { top: pad, bottom: pad, left: 70, right: 70 },
        children: Array.isArray(children) ? children : [para(children, { alignment: options.align || AlignmentType.LEFT })], ...options.cell,
    });
    return { font, body, cell, run, para, pad, tableCell, scale };
}

function imageRun(buffer, size) {
    try { return new ImageRun({ data: buffer, transformation: { width: size, height: size }, type: /^\x89PNG/.test(buffer.subarray(0, 4).toString("binary")) ? "png" : "jpg" }); } catch { return null; }
}

function headerBlocks(k, paper, width, { group = "", logo = null } = {}) {
    const h = paper.header;
    const out = [];
    const line = (parts, tabs) => k.para(parts, { spacing: { before: 60, after: 60, line: 260 }, tabStops: tabs });
    out.push(line([k.run("Name of Candidate: ", { bold: true }), k.run("_".repeat(34)), k.run("\tClass/Section: ", { bold: true }), k.run("_".repeat(14))], [{ type: TabStopType.LEFT, position: Math.round(width * 0.62) }]));
    out.push(line([k.run("Roll No: ", { bold: true }), k.run("_".repeat(14)), k.run("\tDate: ", { bold: true }), k.run(h.date || "_".repeat(14)), k.run("\tSign. of Invigilator: ", { bold: true }), k.run("_".repeat(14))], [{ type: TabStopType.LEFT, position: Math.round(width * 0.32) }, { type: TabStopType.LEFT, position: Math.round(width * 0.62) }]));
    const centre = (value, size, extra = {}) => value ? k.para([k.run(value, { bold: true, size, ...extra })], { alignment: AlignmentType.CENTER, spacing: { before: 20, after: 20, line: 260 } }) : null;
    const lines = [group ? centre(group, k.body + 4, { underline: {} }) : null, centre(h.schoolName, k.body + 6), centre(h.examName, k.body + 1)].filter(Boolean);
    const image = logo ? imageRun(logo, 46) : null;
    if (image) {
        out.push(new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [900, width - 900], borders: { ...NO_BORDERS, insideHorizontal: NONE, insideVertical: NONE }, rows: [new TableRow({ children: [
            new TableCell({ borders: NO_BORDERS, width: { size: 900, type: WidthType.DXA }, children: [new Paragraph({ children: [image] })] }),
            new TableCell({ borders: NO_BORDERS, width: { size: width - 900, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: lines }),
        ] })] }));
    } else out.push(...lines);
    const subject = [h.subjectTitle, h.className].filter(Boolean).join(" - ") + (paper.versionCount > 1 && paper.layout.mode !== "tear" ? `   Paper: ${paper.version}` : "");
    const times = paper.timeLines || [];
    out.push(k.para([k.run(times[0] || "", { bold: true }), k.run(`\t${subject}\t`, { bold: true }), k.run(`Total Marks: ${paper.totalMarks}`, { bold: true })], { spacing: { before: 80, after: times.length > 1 ? 0 : 80 }, tabStops: [{ type: TabStopType.CENTER, position: Math.round(width / 2) }, { type: TabStopType.RIGHT, position: width }] }));
    times.slice(1).forEach((line, i, rest) => out.push(k.para([k.run(line, { bold: true })], { spacing: { after: i === rest.length - 1 ? 80 : 0 } })));
    return out;
}

function sectionHead(k, section, newPage = false) {
    return [
        ...(newPage ? [k.para([k.run("Name of Candidate: ", { bold: true }), k.run("_".repeat(34)), k.run("    Roll No: ", { bold: true }), k.run("_".repeat(14))], { pageBreakBefore: true, spacing: { after: 100 } })] : []),
        k.para([k.run(section.title, { bold: true, size: k.body + 2 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, keepNext: true }),
        k.para([k.run(section.prompt, { bold: true, size: k.body })], { spacing: { after: 60 }, keepNext: true }),
    ];
}

function mcqTable(k, section, width, bubbles) {
    const bub = bubbles ? Math.round(300 * k.scale + 60) : 0;
    const num = 440;
    const q = Math.round(width * 0.35);
    const opt = Math.floor((width - num - q - bub * 4) / 4);
    const widths = [num, q, opt, opt, opt, opt, ...(bubbles ? [bub, bub, bub, bub] : [])];
    const head = ["", "Question", "A", "B", "C", "D", ...(bubbles ? ["A", "B", "C", "D"] : [])];
    const rows = [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((label, i) => k.tableCell(label, widths[i], { align: AlignmentType.CENTER, cell: { children: [k.para([k.run(label, { bold: true, size: i > 5 ? k.cell - 2 : k.cell })], { alignment: AlignmentType.CENTER })] } })) })];
    let scenarioNo = 0;
    for (const item of section.items) {
        if (item.type === "scenario") {
            scenarioNo += 1;
            const body = `${item.title && item.title !== "Scenario" ? `${item.title}. ` : ""}${item.text}`;
            rows.push(new TableRow({ cantSplit: true, children: [new TableCell({ borders: BORDERS, columnSpan: widths.length, width: { size: width, type: WidthType.DXA }, margins: { top: k.pad, bottom: k.pad, left: 70, right: 70 }, children: [k.para([k.run(`Scenario ${scenarioNo} (Questions ${item.from}-${item.to}): `, { bold: true }), k.run(body)])] })] }));
            continue;
        }
        rows.push(new TableRow({ cantSplit: true, children: [
            k.tableCell(String(item.no), widths[0], { align: AlignmentType.CENTER, cell: { children: [k.para([k.run(String(item.no), { bold: true })], { alignment: AlignmentType.CENTER })] } }),
            k.tableCell(item.text, widths[1]),
            ...[0, 1, 2, 3].map(i => k.tableCell(item.options[i]?.text || "", widths[2 + i], { align: AlignmentType.CENTER })),
            ...(bubbles ? [0, 1, 2, 3].map(i => k.tableCell("○", widths[6 + i], { align: AlignmentType.CENTER })) : []),
        ] }));
    }
    return new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: widths, rows });
}

function writtenTable(k, section, width) {
    const label = section.items.some(item => item.label.length > 3) ? 760 : 620;
    const marks = 420;
    const or = 520;
    const text = Math.floor((width - label - marks * 2 - or) / 2);
    const widths = [label, text, marks, or, text, marks];
    return new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: widths, rows: section.items.map(item => {
        const [a, b] = item.alternatives;
        const bold = value => k.para([k.run(value, { bold: true })], { alignment: AlignmentType.CENTER });
        return new TableRow({ cantSplit: true, children: [
            k.tableCell([bold(`(${item.label})`)], widths[0]), k.tableCell(a.text, widths[1]),
            k.tableCell(String(item.marks), widths[2], { align: AlignmentType.CENTER }), k.tableCell([bold("OR")], widths[3]),
            k.tableCell(b.text, widths[4]), k.tableCell(String(item.marks), widths[5], { align: AlignmentType.CENTER }),
        ] });
    }) });
}

function writtenLines(k, section, width) {
    return section.items.map(item => new Paragraph({
        spacing: { before: 40, after: 60 }, tabStops: [{ type: TabStopType.RIGHT, position: width }], indent: { left: 640, hanging: 640 },
        children: [k.run(`(${item.label})\t`, { bold: true, size: k.body }), k.run(item.alternatives[0].text, { size: k.body }), k.run(`\t[${item.marks}]`, { bold: true, size: k.body })],
    }));
}

function sectionBlocks(k, section, width, layout, newPage = false) {
    const blocks = sectionHead(k, section, newPage);
    if (section.kind === "mcq") blocks.push(mcqTable(k, section, width, layout.bubbles));
    else if (section.choice) blocks.push(writtenTable(k, section, width));
    else blocks.push(...writtenLines(k, section, width));
    blocks.push(k.para("", { spacing: { after: 40 } }));
    return blocks;
}

const footer = (k, show) => new Footer({ children: [show ? k.para([k.run("Page ", { size: 16 }), new TextRun({ children: [PageNumber.CURRENT], font: k.font, size: 16 }), k.run(" of ", { size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: k.font, size: 16 })], { alignment: AlignmentType.CENTER }) : k.para("")] });

// `sheet` is one paper, or both groups when the layout shares a sheet. `scale` is the size the PDF fitted at.
async function renderPaperDocx(sheet, { logo = null, scale = 1 } = {}) {
    const papers = Array.isArray(sheet) ? sheet : [sheet];
    const layout = papers[0].layout;
    const dims = PAGES[layout.paper] || PAGES.A4;
    const k = kit(layout, scale);
    const meta = { creator: "IlmiDunya Paper Maker", title: papers[0].header.subjectTitle || "Question Paper", styles: { default: { document: { run: { font: k.font, size: k.cell } } } } };

    if (layout.mode === "tear" && papers.length >= 2) {
        const margin = 300;
        const width = dims.width - 1200;
        const rowHeight = Math.floor((dims.height - margin * 2 - 60) / 2);
        const inner = width - 240;
        const side = name => {
            const rows = papers.slice(0, 2).map((paper, index) => {
                const blocks = name === "front" ? headerBlocks(k, paper, inner, { group: `Group ${paper.version}`, logo }) : [k.para([k.run(`Group ${paper.version}`, { bold: true, size: k.body + 4, underline: {} })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } })];
                for (const section of paper.sections.filter(entry => (entry.kind === "mcq") === (name === "front"))) blocks.push(...sectionBlocks(k, section, inner, layout));
                const cut = index === 1 && (layout.cutLine === "both" || (layout.cutLine === "back" && name === "back"));
                const borders = { ...NO_BORDERS, ...(cut ? { top: DASHED } : {}) };
                return new TableRow({ height: { value: rowHeight, rule: HeightRule.EXACT }, cantSplit: true, children: [new TableCell({ borders, width: { size: width, type: WidthType.DXA }, margins: { top: 60, bottom: 0, left: 120, right: 120 }, children: blocks })] });
            });
            return [new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [width], rows }), new Paragraph({ spacing: { after: 0, line: 20 }, children: [new TextRun({ text: "", size: 2 })] })];
        };
        const properties = { page: { size: { width: dims.width, height: dims.height }, margin: { top: margin, bottom: margin, left: 600, right: 600, header: 0, footer: 0 } } };
        return Packer.toBuffer(new Document({ ...meta, sections: [{ properties, children: side("front") }, { properties, children: side("back") }] }));
    }

    const paper = papers[0];
    const width = dims.width - 1440;
    const children = [...headerBlocks(k, paper, width, { logo })];
    let subjective = false;
    for (const section of paper.sections) {
        const first = section.kind !== "mcq" && !subjective;
        if (first) subjective = true;
        children.push(...sectionBlocks(k, section, width, layout, first && layout.subjectiveNewPage));
    }
    const properties = { page: { size: { width: dims.width, height: dims.height }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } };
    return Packer.toBuffer(new Document({ ...meta, sections: [{ properties, footers: { default: footer(k, true) }, children }] }));
}

async function renderKeyDocx(papers, { logo = null } = {}) {
    const first = papers[0];
    const layout = first.layout;
    const dims = PAGES[layout.paper] || PAGES.A4;
    const k = kit(layout, 1);
    const width = dims.width - 1440;
    const children = [];
    const image = logo ? imageRun(logo, 46) : null;
    if (image) children.push(new Paragraph({ children: [image] }));
    children.push(k.para([k.run("ANSWER KEY", { bold: true, size: 36 })]));
    children.push(k.para([k.run([first.header.schoolName, first.header.examName, [first.header.subjectTitle, first.header.className].filter(Boolean).join(" - ")].filter(Boolean).join("   |   "), { size: 20 })]));
    children.push(k.para([k.run("For teachers only. Do not give this to students.", { italics: true, size: 18 })], { spacing: { after: 120 } }));
    papers.forEach((paper, index) => {
        children.push(new Paragraph({ pageBreakBefore: index > 0 && papers.length > 1, spacing: { before: 200, after: 80 }, children: [k.run(papers.length > 1 ? `${layout.mode === "tear" ? "Group" : "Version"} ${paper.version}` : "MCQ answers", { bold: true, size: 24, underline: {} })] }));
        for (const section of paper.sections.filter(entry => entry.kind === "mcq")) {
            const cells = section.items.filter(item => item.type === "mcq");
            children.push(k.para([k.run(`${section.name}: ${cells.length} questions, ${section.marksEach} ${section.marksEach === 1 ? "mark" : "marks"} each`, { bold: true, size: 20 })], { spacing: { before: 100, after: 60 } }));
            const perRow = 10;
            const cellWidth = Math.floor(width / perRow);
            const rows = [];
            for (let i = 0; i < cells.length; i += perRow) {
                const row = cells.slice(i, i + perRow);
                rows.push(new TableRow({ cantSplit: true, children: Array.from({ length: perRow }, (_, c) => row[c]
                    ? k.tableCell([k.para([k.run(String(row[c].no), { size: 15 })], { alignment: AlignmentType.CENTER }), k.para([k.run(row[c].answer, { bold: true, size: 26 })], { alignment: AlignmentType.CENTER })], cellWidth)
                    : new TableCell({ borders: NO_BORDERS, width: { size: cellWidth, type: WidthType.DXA }, children: [k.para("")] })) }));
            }
            children.push(new Table({ width: { size: cellWidth * perRow, type: WidthType.DXA }, columnWidths: Array(perRow).fill(cellWidth), rows }));
        }
        const written = paper.sections.filter(entry => entry.kind !== "mcq");
        if (index === 0 && written.length) children.push(k.para([k.run(`Marking scheme: ${written.map(section => `${section.name} - ${section.attempt} x ${section.marksEach} = ${section.marks}`).join("; ")}.`, { italics: true, size: 18 })], { spacing: { before: 160 } }));
    });
    const properties = { page: { size: { width: dims.width, height: dims.height }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } };
    return Packer.toBuffer(new Document({ creator: "IlmiDunya Paper Maker", title: "Answer Key", styles: { default: { document: { run: { font: k.font, size: k.cell } } } }, sections: [{ properties, children }] }));
}

module.exports = { renderPaperDocx, renderKeyDocx };
