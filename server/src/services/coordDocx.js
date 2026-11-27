const { LineRuleType, Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ImageRun, TabStopType, PageOrientation, VerticalAlign, HeightRule, Header, Footer, TextWrappingType, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, HorizontalPositionAlign, VerticalPositionAlign, PageNumber, ShadingType } = require("docx");
const { DAYS, COLUMNS, WIDTHS } = require("./coordTemplate");
const { FONTS, fontKey } = require("./coordFonts");

// The same record as coordPdf, as an editable Word file: A4 landscape, one page per week, in the week's font.
// The text size chosen for the PDF (the size that makes the week fit on one page) is used here too.
let FONT = "Arial"; // set for each week before its page is built
const A4 = { w: 16838, h: 11906 };
const MARGIN = { top: 440, bottom: 300, side: 720 };
const TABLE_W = A4.w - MARGIN.side * 2;
const SCALE = { s: 0.86, m: 1, l: 1.2 };
const HIGHLIGHT = { "#fef08a": "yellow", "#bbf7d0": "green", "#bfdbfe": "cyan", "#fbcfe8": "magenta", "#fed7aa": "yellow" };
const LINE = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const ALL = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const half = (pt) => Math.round(pt * 2);
const isPng = (buffer) => /^\x89PNG/.test(buffer.subarray(0, 4).toString("binary"));
function imageSize(buffer) {
    try {
        if (isPng(buffer)) return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
        let i = 2;
        while (i < buffer.length) { // JPEG: find the frame header
            if (buffer[i] !== 0xff) { i++; continue; }
            const marker = buffer[i + 1];
            if (marker >= 0xc0 && marker <= 0xc3) return { w: buffer.readUInt16BE(i + 7), h: buffer.readUInt16BE(i + 5) };
            i += 2 + buffer.readUInt16BE(i + 2);
        }
    } catch { /* fall through */ }
    return { w: 1, h: 1 };
}
const fitBox = (buffer, maxW, maxH) => { const { w, h } = imageSize(buffer); const k = Math.min(maxW / w, maxH / h); return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }; };
const image = (buffer, maxW, maxH, extra = {}) => { try { return new ImageRun({ data: buffer, type: isPng(buffer) ? "png" : "jpg", transformation: fitBox(buffer, maxW, maxH), ...extra }); } catch { return null; } };

function runsOf(runs, size, base = {}) {
    return (runs || []).map((r0) => {
        const r = { ...base, ...r0 };
        return new TextRun({ text: r.t, font: r.f ? FONTS[r.f]?.word || FONT : FONT, size: half(size * (SCALE[r.z] || 1)), bold: Boolean(r.b), italics: Boolean(r.i), underline: r.u ? {} : undefined, strike: Boolean(r.s), color: r.c ? r.c.slice(1) : "000000", highlight: r.h ? HIGHLIGHT[r.h] : undefined });
    });
}
const spacing = { before: 0, after: 0, line: 240 };
// Exact line height, the same as the PDF layout (1.18 × text size), so Word breaks the page the same way.
const lineSpacing = (pt) => ({ before: 0, after: 0, line: Math.round(pt * 1.18 * 20), lineRule: LineRuleType.EXACT });
function paragraphs(list, size, { lead = null, align } = {}) {
    const out = [];
    let number = 0;
    (list || []).forEach((p, index) => {
        number = p.list === "ol" ? number + 1 : 0;
        const marker = p.list === "ul" ? "•\t" : p.list === "ol" ? `${number}.\t` : "";
        const indent = p.list ? { left: 220, hanging: 220 } : undefined;
        const children = [...(index === 0 && lead ? lead : []), ...(marker ? [new TextRun({ text: marker, font: FONT, size: half(size) })] : []), ...runsOf(p.runs, size)];
        const biggest = Math.max(1, ...(p.runs || []).map((r) => SCALE[r.z] || 1));
        out.push(new Paragraph({ children, spacing: lineSpacing(size * biggest), indent, tabStops: p.list ? [{ type: TabStopType.LEFT, position: 220 }] : undefined, alignment: { center: AlignmentType.CENTER, right: AlignmentType.RIGHT }[align || p.align] || AlignmentType.LEFT }));
    });
    if (!out.length) out.push(new Paragraph({ children: lead || [], spacing: lineSpacing(size), alignment: align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT }));
    return out;
}
const leadRun = (text, size, style = {}) => [new TextRun({ text, font: FONT, size: half(size), ...style })];
const cell = (children, width, extra = {}) => new TableCell({ children, width: { size: width, type: WidthType.DXA }, borders: ALL, margins: { top: 40, bottom: 40, left: 70, right: 70 }, ...extra });

function weekBlocks(record, size, assets, first) {
    const c = new Proxy(record.cells || {}, { get: (t, k) => t[k] || [] });
    const plain = (key) => c[key].map((p) => p.runs.map((r) => r.t).join("")).join(" ").trim();
    const blocks = [];
    blocks.push(new Paragraph({ pageBreakBefore: !first, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun({ text: record.title, font: FONT, size: 22, bold: true, underline: {} })] }));
    const field = (label, value) => [new TextRun({ text: `${label} `, font: FONT, size: 17, bold: true }), new TextRun({ text: value ? ` ${value}   ` : "            ", font: FONT, size: 17, underline: {} })];
    blocks.push(new Paragraph({ spacing: { before: 0, after: 100 }, indent: { left: 360 }, tabStops: [{ type: TabStopType.CENTER, position: Math.round(TABLE_W / 2) }, { type: TabStopType.RIGHT, position: TABLE_W - 200 }],
        children: [...field("Week:", plain("week")), new TextRun({ text: "\t", font: FONT }), ...field("Class:", plain("className")), new TextRun({ text: "\t", font: FONT }), ...field("No. of Sections:", plain("sections"))] }));

    const span = WIDTHS.length;
    const leftW = WIDTHS.slice(0, 3).reduce((a, b) => a + b, 0);
    const subjectW = Math.round(TABLE_W * 0.38);
    const rows = [];
    // Subject / Periods per week | Topic
    rows.push(new TableRow({ children: [new TableCell({
        columnSpan: span, borders: ALL, width: { size: TABLE_W, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 70, right: 70 },
        children: [
            new Paragraph({ spacing, tabStops: [{ type: TabStopType.LEFT, position: subjectW }], children: [...leadRun("Subject: ", size, { bold: true }), ...runsOf(c.subject[0]?.runs, size, { u: true }), new TextRun({ text: "\t", font: FONT }), ...leadRun("Topic: ", size, { bold: true }), ...runsOf(c.topic[0]?.runs, size)] }),
            ...(c.topic.length > 1 ? paragraphs(c.topic.slice(1), size) : []),
            new Paragraph({ spacing, children: [...leadRun("Periods per week ", size, { bold: true }), ...runsOf(c.periods[0]?.runs, size)] }),
        ],
    })] }));
    rows.push(new TableRow({ children: [cell(paragraphs(c.broughtForward, size, { lead: leadRun("Topics brought forward (if any): ", size) }), TABLE_W, { columnSpan: span })] }));
    rows.push(new TableRow({ tableHeader: false, children: COLUMNS.map(([, name], i) => cell([new Paragraph({ spacing, alignment: AlignmentType.CENTER, children: leadRun(name, size, { bold: true }) })], WIDTHS[i], { verticalAlign: VerticalAlign.CENTER })) }));
    for (const [index, [key, name]] of DAYS.entries()) {
        // The PDF layout measured each day row; Word gets slightly less so its own line breaks cannot push the page over.
        const measured = record.dayHeights?.[index];
        rows.push(new TableRow({
            height: { value: measured ? Math.round(measured * 20 * 0.95) : 700, rule: HeightRule.ATLEAST }, cantSplit: true,
            children: COLUMNS.map(([column], i) => cell(i === 0 ? [new Paragraph({ spacing, children: leadRun(name, size) }), ...paragraphs(c[`${key}.period`], size).filter((_, j, all) => all.length && c[`${key}.period`].length)] : paragraphs(c[`${key}.${column}`], size), WIDTHS[i])),
        }));
    }
    rows.push(new TableRow({ children: [cell(paragraphs(c.extraHelp, size, { lead: leadRun("Strategies for Learners requiring extra assistance: ", size, { italics: true }) }), TABLE_W, { columnSpan: span })] }));
    // Attendees on one line (up to six); longer lists are split into even lines.
    const names = record.attendees?.length ? record.attendees : ["", "", "", ""];
    const attendeeLines = [];
    const per = names.length <= 4 ? 4 : names.length <= 6 ? names.length : Math.ceil(names.length / Math.ceil(names.length / 6));
    const step = Math.round((TABLE_W - 440) / per);
    const signing = Boolean(record.attendeeSignatures?.length);
    for (let i = 0; i < names.length; i += per) {
        // Five or more people with signatures: a borderless row of cells, the name with the signature under it.
        if (signing && per > 4) {
            const colW = Math.floor((TABLE_W - 440) / per);
            attendeeLines.push(new Table({ width: { size: colW * per, type: WidthType.DXA }, columnWidths: Array(per).fill(colW), indent: { size: 300, type: WidthType.DXA }, borders: { ...NO_BORDERS, insideHorizontal: NONE, insideVertical: NONE }, rows: [new TableRow({ children: Array.from({ length: per }, (_, j) => {
                const name = names[i + j];
                const sig = record.attendeeSignatures[i + j];
                const pic = sig?.image ? image(sig.image, Math.round(colW / 20) - 16, 22) : null;
                return new TableCell({ borders: NO_BORDERS, width: { size: colW, type: WidthType.DXA }, margins: { left: 40, right: 80 }, children: name === undefined ? [new Paragraph({ children: [] })] : [
                    new Paragraph({ spacing: lineSpacing(size), children: leadRun(`${i + j + 1}. ${name}`, size) }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20, after: 20 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "9CA3AF", space: 1 } }, children: pic ? [pic] : [new TextRun({ text: " ", font: FONT, size: 30 })] }),
                ] });
            }) })] }));
            continue;
        }
        attendeeLines.push(new Paragraph({ spacing: lineSpacing(size), indent: { left: 300 }, tabStops: Array.from({ length: per - 1 }, (_, n) => ({ type: TabStopType.LEFT, position: step * (n + 1) })),
            children: names.slice(i, i + per).flatMap((name, j) => {
                // Department attendees sign beside their name (blank line until they do).
                const sig = record.attendeeSignatures?.length ? record.attendeeSignatures[i + j] : undefined;
                const mark = sig === undefined ? [] : sig?.image ? [new TextRun({ text: " ", font: FONT }), image(sig.image, per > 4 ? 56 : 80, 18)].filter(Boolean) : [new TextRun({ text: per > 4 ? "  ________" : "  ____________", font: FONT, color: "9CA3AF", size: size * 2 })];
                return [...(j > 0 ? [new TextRun({ text: "\t", font: FONT })] : []), ...leadRun(`${i + j + 1}. ${name}`, size), ...mark];
            }) }));
    }
    rows.push(new TableRow({ children: [cell([
        ...paragraphs(c.teacher, size, { lead: leadRun("Teacher Responsible for Preparing lesson Plan: ", size) }),
        new Paragraph({ spacing: lineSpacing(size), children: leadRun("Attendees of Coordination Meeting:", size) }),
        ...attendeeLines,
    ], TABLE_W, { columnSpan: span })] }));
    rows.push(new TableRow({ children: [
        cell(paragraphs(c.submitDate, size, { lead: leadRun("Date of submission of the Lesson Plan to the Sec Head: ", size) }), leftW, { columnSpan: 3 }),
        cell(paragraphs(c.distributeDate, size, { lead: leadRun("Date of distribution of the finalized Lesson Plan to the Teachers: ", size) }), TABLE_W - leftW, { columnSpan: 3 }),
    ] }));
    blocks.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: WIDTHS, rows, layout: "fixed" }));

    // Signatures: only the e-signature on the line, about two lines of text tall so the layout stays put.
    const sigCell = (label, sig, k = 1) => {
        const pic = sig?.image ? image(sig.image, Math.round(150 * k), 28) : null;
        return [
            new TableCell({ borders: NO_BORDERS, width: { size: Math.round(2600 * k), type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing, children: leadRun(label, 8.5) })] }),
            new TableCell({ borders: { ...NO_BORDERS, bottom: LINE }, width: { size: Math.round(3000 * k), type: WidthType.DXA }, verticalAlign: VerticalAlign.BOTTOM, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: pic ? [pic] : [] })] }),
            new TableCell({ borders: NO_BORDERS, width: { size: Math.round(1500 * k), type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
        ];
    };
    blocks.push(new Paragraph({ spacing: { before: 0, after: 0, line: 160 }, children: [] }));
    const signers = [["Sign: Subject Coordinator:", assets.coordinator], ["SH Sign:", assets.sectionHead], ...(assets.principal ? [["Principal Sign:", assets.principal]] : [])];
    const scale = signers.length === 3 ? 14200 / 21300 : 1;
    blocks.push(new Table({ width: { size: 14200, type: WidthType.DXA }, columnWidths: signers.flatMap(() => [2600, 3000, 1500].map((w) => Math.round(w * scale))), borders: { ...NO_BORDERS, insideHorizontal: NONE, insideVertical: NONE }, rows: [
        new TableRow({ height: { value: 520, rule: HeightRule.ATLEAST }, children: signers.flatMap(([label, sig]) => sigCell(label, sig, scale)) }),
    ] }));
    if (record.caption) blocks.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 0 }, children: [new TextRun({ text: record.caption, font: FONT, size: 17, italics: true, underline: {} })] }));
    return blocks;
}

function headerWith(watermark, opacityNote) {
    if (!watermark) return new Header({ children: [new Paragraph({ children: [] })] });
    const size = fitBox(watermark, 400, 400);
    const pic = image(watermark, 400, 400, {
        floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
            behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE },
        },
    });
    void size; void opacityNote;
    return new Header({ children: [new Paragraph({ children: pic ? [pic] : [] })] });
}

function footerFor(record, qr) {
    const children = [];
    if (qr) { const pic = image(qr, 40, 40); if (pic) children.push(pic, new TextRun({ text: "  ", font: FONT })); }
    children.push(new TextRun({ text: record.footerText || "", font: FONT, size: 14 }));
    if (record.status !== "approved") children.push(new TextRun({ text: `\t${record.status === "submitted" ? "SUBMITTED — AWAITING SECTION HEAD APPROVAL" : "DRAFT — NOT YET SIGNED"}`, font: FONT, size: 13, bold: true, color: "9A3412" }));
    else children.push(new TextRun({ text: "\t", font: FONT }));
    children.push(new TextRun({ text: "\tPage ", font: FONT, size: 14, bold: true }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, bold: true }), new TextRun({ text: " of ", font: FONT, size: 14, bold: true }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, bold: true }));
    return new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.CENTER, position: Math.round(TABLE_W / 2) }, { type: TabStopType.RIGHT, position: TABLE_W }], children })] });
}

// The watermark picture must already be faded (see fadeImage), because Word has no simple opacity setting
// for pictures written this way.
async function renderCoordinationDocx(records, { sizes = [], watermark = null, title = "Coordination record" } = {}) {
    const sections = records.map((record, i) => {
        const size = sizes[i]?.size || 9;
        FONT = FONTS[fontKey(record.font)].word;
        return {
            properties: { page: { size: { width: A4.h, height: A4.w, orientation: PageOrientation.LANDSCAPE }, margin: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.side, right: MARGIN.side, header: 200, footer: 160 } } },
            headers: { default: headerWith(watermark) },
            footers: { default: footerFor(record, record.assets?.qr) },
            children: weekBlocks({ ...record, dayHeights: sizes[i]?.dayHeights }, size, record.assets || {}, true),
        };
    });
    const doc = new Document({ creator: "IlmiDunya", title, styles: { default: { document: { run: { font: FONTS[fontKey(records[0]?.font)].word, size: 18 } } } }, sections: sections.length ? sections : [{ children: [new Paragraph("")] }] });
    void ShadingType;
    return Packer.toBuffer(doc);
}

module.exports = { renderCoordinationDocx, imageSize };
