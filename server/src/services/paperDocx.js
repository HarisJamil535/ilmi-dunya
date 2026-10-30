const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, PageNumber, ImageRun, BorderStyle, VerticalAlign, TabStopType, HeightRule, HorizontalPositionRelativeFrom, HorizontalPositionAlign, VerticalPositionRelativeFrom, CharacterSet } = require("docx");

// Plain black-and-white Word version of the paper, matching the PDF: tables only for either/or questions,
// bubble columns for MCQs, and (for two groups on one sheet) a fixed-height table per half so the sheet tears in two.
const PAGES = { A4: { width: 11906, height: 16838 }, Letter: { width: 12240, height: 15840 } };
// Word font names; EB Garamond and Poppins are embedded because most computers do not have them.
// Calibri and Cambria come with Office (the PDF uses their open look-alikes, Carlito and Caladea).
const FONTS = {
    arial: { name: "Arial", size: 1 }, times: { name: "Times New Roman", size: 1.03 },
    garamond: { name: "EB Garamond", size: 1.1, embed: "EBGaramond-Regular" }, calibri: { name: "Calibri", size: 1.06 },
    cambria: { name: "Cambria", size: 1 }, poppins: { name: "Poppins", size: 0.92, embed: "Poppins-Regular" },
};
const fontOf = key => FONTS[key] || FONTS[{ sans: "arial", serif: "times" }[key]] || FONTS.arial;
const FONT_SIZE = { small: 0.92, normal: 1, large: 1.1, xl: 1.2 };
const SPACING = { compact: 0.65, normal: 1, relaxed: 1.45 };
const MARK_GREY = { light: "EBEBEB", medium: "DEDEDE", strong: "CFCFCF" };
const FOOTER_TEXT = "Prepared by IlmiDunya  ·  www.ilmidunya.org";
const embedded = key => { const font = fontOf(key); return font.embed ? [{ name: font.name, data: fs.readFileSync(path.join(__dirname, "../../assets/fonts", `${font.embed}.ttf`)), characterSet: CharacterSet.ANSI }] : []; };
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const DASHED = { style: BorderStyle.DASHED, size: 4, color: "000000" };

function kit(layout, scale) {
    const chosen = fontOf(layout.font);
    const font = chosen.name;
    const k = scale * (FONT_SIZE[layout.fontSize] || 1) * chosen.size;
    const body = Math.round(10.5 * k * 2);
    const cell = Math.round(9.5 * k * 2);
    const run = (value, options = {}) => new TextRun({ text: String(value ?? ""), font, size: cell, ...options });
    const para = (children, options = {}) => new Paragraph({ spacing: { after: 0, line: 240 }, children: Array.isArray(children) ? children : [run(children)], ...options });
    const pad = Math.round(50 * scale * (SPACING[layout.spacing] || 1));
    const tableCell = (children, width, options = {}) => new TableCell({
        borders: BORDERS, verticalAlign: VerticalAlign.CENTER, width: { size: width, type: WidthType.DXA },
        margins: { top: pad, bottom: pad, left: 70, right: 70 },
        children: Array.isArray(children) ? children : [para(children, { alignment: options.align || AlignmentType.LEFT })], ...options.cell,
    });
    return { font, body, cell, run, para, pad, tableCell, scale, titleStyle: layout.titleStyle || "bold" };
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
        k.para([k.run(section.title, { bold: true, size: k.body + 2, ...(k.titleStyle === "underline" ? { underline: {} } : {}) })], { alignment: AlignmentType.CENTER, spacing: { before: k.titleStyle === "boxed" ? 200 : 120, after: k.titleStyle === "boxed" ? 100 : 40 }, keepNext: true,
            ...(k.titleStyle === "boxed" ? { border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }, indent: { left: 2600, right: 2600 } } : {}) }),
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

const footer = (k, pages = true) => new Footer({ children: [k.para([k.run(FOOTER_TEXT, { size: 15, italics: true }), ...(pages ? [k.run("  ·  Page ", { size: 15, italics: true }), new TextRun({ children: [PageNumber.CURRENT], font: k.font, size: 15, italics: true }), k.run(" of ", { size: 15, italics: true }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: k.font, size: 15, italics: true })] : [])], { alignment: AlignmentType.CENTER })] });

// Header paragraphs take no height, so the page body (and each half of a shared sheet) starts where it should.
const TINY = { before: 0, after: 0, line: 20, lineRule: "exact" };
const pngSize = buffer => (/^\x89PNG/.test(buffer.subarray(0, 4).toString("binary")) ? { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) } : null);
// An image watermark lives in the page header as a picture behind the text, centred in each area (the whole page,
// or each half of a shared sheet). Text watermarks are added afterwards by finishDocx, the way Word itself writes them.
function markHeader(k, layout, dims, mark, areas) {
    const children = [];
    const wm = layout.watermark || {};
    for (const area of areas) {
        if (wm.kind === "image" && mark) {
            const size = pngSize(mark);
            if (!size) continue;
            const box = Math.min(dims.width, area.height) / 15 * 0.62;
            const ratio = Math.min(box / size.width, box / size.height);
            const width = Math.round(size.width * ratio);
            const height = Math.round(size.height * ratio);
            children.push(new Paragraph({ spacing: TINY, children: [new ImageRun({ type: "png", data: mark, transformation: { width, height }, floating: {
                horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
                verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round((area.top + area.height / 2) * 635 - (height * 9525) / 2) },
                behindDocument: true, allowOverlap: true } })] }));
        }
    }
    if (!children.length) children.push(new Paragraph({ spacing: TINY, children: [new TextRun({ text: "", size: 2 })] }));
    return new Header({ children });
}

// `sheet` is one paper, or both groups when the layout shares a sheet. `scale` is the size the PDF fitted at.
const SHAPETYPE = '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>';
const MARK_OPACITY = { light: ".3", medium: ".45", strong: ".6" };
const xml = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Last touches the docx library cannot make: tell Word to use the embedded font, and add a text watermark
// as Word's own WordArt shape (pale, behind the text, centred and turned) in each area of the page.
async function finishDocx(buffer, { layout, dims, font, areas, embeds }) {
    const wm = layout.watermark || {};
    const wantText = wm.kind === "text" && wm.text;
    if (!wantText && !embeds) return buffer;
    const zip = await JSZip.loadAsync(buffer);
    if (embeds) {
        const settings = await zip.file("word/settings.xml").async("string");
        zip.file("word/settings.xml", settings.includes("embedTrueTypeFonts") ? settings : settings.replace("<w:displayBackgroundShape/>", "<w:displayBackgroundShape/><w:embedTrueTypeFonts/>"));
    }
    if (wantText) {
        const words = xml(wm.text.toUpperCase());
        const pageW = dims.width / 20;
        const shapes = areas.map((area, i) => {
            const half = areas.length > 1;
            const w = pageW * (half ? 0.62 : 0.82);
            const h = Math.min(half ? 70 : 140, w / Math.max(2.5, wm.text.length * 0.62));
            const cx = pageW / 2;
            const cy = (area.top + area.height / 2) / 20;
            return `<v:shape id="IlmiDunyaWatermark${i + 1}" o:spid="_x0000_s${2050 + i}" type="#_x0000_t136" style="position:absolute;margin-left:${(cx - w / 2).toFixed(1)}pt;margin-top:${(cy - h / 2).toFixed(1)}pt;width:${w.toFixed(1)}pt;height:${h.toFixed(1)}pt;rotation:${half ? 340 : 315};z-index:-251657216;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" o:allowincell="f" fillcolor="silver" stroked="f"><v:fill opacity="${MARK_OPACITY[wm.strength] || ".3"}"/><v:textpath style="font-family:&quot;${xml(font)}&quot;;font-size:1pt;font-weight:bold" string="${words}"/><w10:wrap anchorx="page" anchory="page"/></v:shape>`;
        });
        // One paragraph per shape; the shape type is declared once, in the first.
        const paragraph = shapes.map((shape, i) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:noProof/><w:sz w:val="2"/></w:rPr><w:pict>${i === 0 ? SHAPETYPE : ""}${shape}</w:pict></w:r></w:p>`).join("");
        for (const name of Object.keys(zip.files).filter(file => /^word\/header\d+\.xml$/.test(file))) {
            const header = await zip.file(name).async("string");
            zip.file(name, header.replace(/(<w:hdr[^>]*>)/, `$1${paragraph}`));
        }
    }
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function renderPaperDocx(sheet, { logo = null, mark = null, scale = 1 } = {}) {
    const papers = Array.isArray(sheet) ? sheet : [sheet];
    const layout = papers[0].layout;
    const dims = PAGES[layout.paper] || PAGES.A4;
    const k = kit(layout, scale);
    const meta = { creator: "IlmiDunya Paper Maker", title: papers[0].header.subjectTitle || "Question Paper", fonts: embedded(layout.font), styles: { default: { document: { run: { font: k.font, size: k.cell } } } } };

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
                blocks.push(k.para([k.run(FOOTER_TEXT, { size: 13, italics: true })], { alignment: AlignmentType.CENTER, spacing: { before: 120 } }));
                return new TableRow({ height: { value: rowHeight, rule: HeightRule.EXACT }, cantSplit: true, children: [new TableCell({ borders, width: { size: width, type: WidthType.DXA }, margins: { top: 60, bottom: 0, left: 120, right: 120 }, children: blocks })] });
            });
            return [new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [width], rows }), new Paragraph({ spacing: { after: 0, line: 20 }, children: [new TextRun({ text: "", size: 2 })] })];
        };
        const properties = { page: { size: { width: dims.width, height: dims.height }, margin: { top: margin, bottom: margin, left: 600, right: 600, header: 0, footer: 0 } } };
        const halves = [{ top: margin, height: rowHeight }, { top: margin + rowHeight, height: rowHeight }];
        const headers = { default: markHeader(k, layout, dims, mark, halves) };
        const file = await Packer.toBuffer(new Document({ ...meta, sections: [{ properties, headers, children: side("front") }, { properties, headers, children: side("back") }] }));
        return finishDocx(file, { layout, dims, font: k.font, areas: halves, embeds: meta.fonts.length > 0 });
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
    const page = [{ top: 0, height: dims.height }];
    const headers = { default: markHeader(k, layout, dims, mark, page) };
    const file = await Packer.toBuffer(new Document({ ...meta, sections: [{ properties, headers, footers: { default: footer(k, true) }, children }] }));
    return finishDocx(file, { layout, dims, font: k.font, areas: page, embeds: meta.fonts.length > 0 });
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
    const fonts = embedded(layout.font);
    const file = await Packer.toBuffer(new Document({ creator: "IlmiDunya Paper Maker", title: "Answer Key", fonts, styles: { default: { document: { run: { font: k.font, size: k.cell } } } }, sections: [{ properties, footers: { default: footer(k, false) }, children }] }));
    return finishDocx(file, { layout: { watermark: {} }, dims, font: k.font, areas: [], embeds: fonts.length > 0 });
}

module.exports = { renderPaperDocx, renderKeyDocx };
