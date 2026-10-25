const path = require("node:path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { latin, stamp } = require("./resultCardPdf");
const { formatDate, formatTime, formatDateTime, formatDuration } = require("./pakistanTime");

const LOGO = path.join(__dirname, "../../assets/logo.png");
const C = {
    ink: "#1B1038", deep: "#2A1866", brand: "#623FCD", soft: "#F4F1FD", line: "#E2DCF5", text: "#16151F", muted: "#636279",
    gold: "#B8901F", goldSoft: "#FBF6E6", pass: "#047857", passSoft: "#E8F7F0", fail: "#B91C1C", failSoft: "#FDECEC", zebra: "#FAF9FE",
    silver: "#7C8696", bronze: "#A86B32",
};
const PAGE = { width: 595.28, height: 841.89, margin: 40 };
const W = PAGE.width - PAGE.margin * 2;
const TOP = 62;
const BOTTOM = PAGE.height - 60;
const GRADES = [["A+", 80, "Exceptional"], ["A", 70, "Excellent"], ["B", 60, "Very good"], ["C", 50, "Good"], ["D", 40, "Fair"], ["E", 33, "Satisfactory"], ["F", 0, "Needs improvement"]];

const pct = value => `${Math.round((Number(value) || 0) * 10) / 10}%`;
const num = value => String(Math.round((Number(value) || 0) * 100) / 100);
const ordinal = n => `${n}${["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th"}`;
const scoreColor = value => (value >= 70 ? C.pass : value >= 50 ? C.brand : value >= 33 ? C.gold : C.fail);

function remarkFor(average) {
    if (average >= 80) return "Outstanding. Consistently excellent understanding of the syllabus.";
    if (average >= 70) return "Excellent work with a strong grasp of most concepts.";
    if (average >= 60) return "Very good progress. A little more practice on weaker topics will lift results further.";
    if (average >= 50) return "Good effort. Regular revision of weaker chapters is recommended.";
    if (average >= 33) return "Satisfactory. More practice and review of explanations is needed.";
    return "Needs attention. Revisit the explanations for each topic and retry the tests.";
}

// A sheet of A4 with the IlmiDunya frame, watermark and running headers, plus a cursor for laying out content.
class Sheet {
    constructor(meta) {
        this.meta = meta;
        this.doc = new PDFDocument({
            size: "A4", margins: { top: TOP, bottom: 40, left: PAGE.margin, right: PAGE.margin }, bufferPages: true, autoFirstPage: false,
            info: { Title: latin(meta.documentTitle), Author: "IlmiDunya", Subject: meta.documentTitle, Creator: "IlmiDunya", Keywords: `IlmiDunya, ${meta.reference}` },
        });
        this.y = TOP;
        this.headerFor = null;
        this.pageReferences = [];
    }

    page(mainHeader) {
        const { doc } = this;
        doc.addPage();
        this.pageReferences.push(this.currentReference || this.meta.reference);
        doc.save().opacity(0.035).image(LOGO, PAGE.width / 2 - 150, PAGE.height / 2 - 128, { fit: [300, 255] }).restore();
        if (mainHeader) { this.y = mainHeader(); return; }
        // Continuation pages carry a slim band so a loose page still says what it belongs to.
        const band = doc.linearGradient(0, 0, PAGE.width, 0);
        band.stop(0, C.ink).stop(1, C.deep);
        doc.rect(0, 0, PAGE.width, 36).fill(band);
        doc.rect(0, 36, PAGE.width, 1.6).fill(C.gold);
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10).text("IlmiDunya", PAGE.margin, 13, { lineBreak: false });
        doc.fillColor("#CFC4F5").font("Helvetica").fontSize(8).text(latin(this.headerFor || this.meta.runningTitle), PAGE.margin + 62, 14.5, { width: W - 200, height: 10, ellipsis: true, lineBreak: false });
        doc.text(`Ref ${this.currentReference || this.meta.reference}`, PAGE.width - PAGE.margin - 160, 14.5, { width: 160, align: "right", lineBreak: false });
        this.y = TOP;
    }

    ensure(height) {
        if (this.y + height <= BOTTOM) return false;
        this.page();
        return true;
    }

    // Large title band for the first page of a report or of a student's card.
    hero(title, subtitle, reference) {
        const { doc } = this;
        const band = doc.linearGradient(0, 0, PAGE.width, 120);
        band.stop(0, C.ink).stop(0.65, C.deep).stop(1, "#4B2BB0");
        doc.rect(0, 0, PAGE.width, 118).fill(band);
        doc.rect(0, 118, PAGE.width, 2.5).fill(C.gold);
        // Fine guilloche-style arcs in the corner for a printed-certificate feel.
        doc.save().lineWidth(0.5).strokeOpacity(0.18);
        for (let r = 40; r <= 160; r += 12) doc.circle(PAGE.width - 30, -10, r).stroke("#FFFFFF");
        doc.restore();
        doc.roundedRect(PAGE.margin, 28, 60, 60, 14).fill("#FFFFFF");
        doc.image(LOGO, PAGE.margin + 7, 35, { fit: [46, 46], align: "center", valign: "center" });
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(25).text("IlmiDunya", PAGE.margin + 74, 33, { lineBreak: false });
        doc.fillColor("#D8CCFF").font("Helvetica").fontSize(9).text("Pakistan's online learning and assessment platform", PAGE.margin + 74, 63, { lineBreak: false });
        doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(7.5).text("WWW.ILMIDUNYA.ORG", PAGE.margin + 74, 77, { characterSpacing: 1.6, lineBreak: false });
        const right = { width: 230, align: "right", lineBreak: false };
        const x = PAGE.width - PAGE.margin - 230;
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(15).text(title, x, 34, { ...right, characterSpacing: 0.6 });
        doc.fillColor("#D8CCFF").font("Helvetica").fontSize(8.5).text(latin(subtitle), x, 55, { ...right, height: 11, ellipsis: true });
        doc.text(`Reference  ${reference}`, x, 70, right).text(`Issued  ${formatDate(this.meta.issuedAt)}`, x, 83, right);
        return 138;
    }

    section(title, note) {
        const { doc } = this;
        this.ensure(56);
        doc.rect(PAGE.margin, this.y + 1, 4, 12).fill(C.gold);
        doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(10.5).text(title.toUpperCase(), PAGE.margin + 11, this.y + 2, { characterSpacing: 1, lineBreak: false });
        if (note) doc.fillColor(C.muted).font("Helvetica").fontSize(7.5).text(latin(note), PAGE.margin + 220, this.y + 4, { width: W - 220, align: "right", height: 10, ellipsis: true, lineBreak: false });
        this.y += 22;
    }

    // Two-column label/value card.
    details(pairs) {
        const { doc } = this;
        const rows = Math.ceil(pairs.length / 2);
        const height = 14 + rows * 30;
        this.ensure(height + 10);
        doc.roundedRect(PAGE.margin, this.y, W, height, 10).fillAndStroke(C.soft, C.line);
        pairs.forEach(([label, value], index) => {
            const x = PAGE.margin + 16 + (index % 2) * (W / 2);
            const top = this.y + 10 + Math.floor(index / 2) * 30;
            doc.fillColor(C.muted).font("Helvetica").fontSize(7).text(label.toUpperCase(), x, top, { characterSpacing: 0.8, lineBreak: false });
            doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10).text(latin(value || "—"), x, top + 10, { width: W / 2 - 30, height: 12, ellipsis: true, lineBreak: false });
        });
        this.y += height + 16;
    }

    tiles(items, perRow = 4) {
        const { doc } = this;
        const gap = 8;
        const width = (W - gap * (perRow - 1)) / perRow;
        for (let start = 0; start < items.length; start += perRow) {
            this.ensure(58);
            items.slice(start, start + perRow).forEach(([value, label, color], index) => {
                const x = PAGE.margin + index * (width + gap);
                doc.roundedRect(x, this.y, width, 50, 9).fillAndStroke("#FFFFFF", C.line);
                doc.roundedRect(x, this.y, 4, 50, 2).fill(color || C.brand);
                doc.fillColor(color || C.ink).font("Helvetica-Bold").fontSize(15).text(latin(value), x + 13, this.y + 9, { width: width - 18, height: 18, ellipsis: true, lineBreak: false });
                doc.fillColor(C.muted).font("Helvetica").fontSize(7).text(label.toUpperCase(), x + 13, this.y + 32, { width: width - 18, characterSpacing: 0.5, lineBreak: false });
            });
            this.y += 58;
        }
        this.y += 8;
    }

    // A table that repeats its header row on every page it spans.
    table(columns, rows, { rowHeight = 22, highlight } = {}) {
        const { doc } = this;
        const total = columns.reduce((sum, column) => sum + column.width, 0);
        const scale = W / total;
        const cols = columns.map(column => ({ ...column, width: column.width * scale }));
        const head = () => {
            doc.rect(PAGE.margin, this.y, W, 20).fill(C.ink);
            let x = PAGE.margin;
            for (const column of cols) {
                // Shrink a long title to fit its column instead of letting it wrap.
                const title = column.title.toUpperCase();
                let size = 6.8;
                doc.font("Helvetica-Bold");
                while (size > 5 && doc.fontSize(size).widthOfString(title, { characterSpacing: 0.3 }) > column.width - 14) size -= 0.2;
                doc.fillColor("#FFFFFF").fontSize(size).text(title, x + 4, this.y + 10 - size / 2, { width: column.width - 8, align: column.align || "left", characterSpacing: 0.3, lineBreak: false });
                x += column.width;
            }
            this.y += 20;
        };
        this.ensure(20 + rowHeight * Math.min(rows.length, 2));
        head();
        rows.forEach((row, index) => {
            if (this.ensure(rowHeight)) head();
            const fill = highlight?.(row);
            if (fill) doc.rect(PAGE.margin, this.y, W, rowHeight).fill(fill);
            else if (index % 2 === 1) doc.rect(PAGE.margin, this.y, W, rowHeight).fill(C.zebra);
            let x = PAGE.margin;
            for (const column of cols) {
                const cell = column.cell(row, index);
                const inner = column.width - 10;
                if (cell.bar !== undefined) {
                    const barWidth = inner - 30;
                    doc.roundedRect(x + 5, this.y + rowHeight / 2 - 3, barWidth, 6, 3).fill("#ECE8F8");
                    doc.roundedRect(x + 5, this.y + rowHeight / 2 - 3, Math.max(3, barWidth * Math.min(100, cell.bar) / 100), 6, 3).fill(scoreColor(cell.bar));
                    doc.fillColor(C.text).font("Helvetica-Bold").fontSize(7.5).text(pct(cell.bar), x + 5 + barWidth + 3, this.y + rowHeight / 2 - 3.5, { width: 27, align: "right", lineBreak: false });
                } else if (cell.sub) {
                    doc.fillColor(cell.color || C.text).font(cell.bold === false ? "Helvetica" : "Helvetica-Bold").fontSize(cell.size || 8).text(latin(cell.text), x + 5, this.y + 4.5, { width: inner, align: column.align || "left", height: 10, ellipsis: true, lineBreak: false });
                    doc.fillColor(C.muted).font("Helvetica").fontSize(6.6).text(latin(cell.sub), x + 5, this.y + 15.5, { width: inner, align: column.align || "left", height: 9, ellipsis: true, lineBreak: false });
                } else if (cell.pill) {
                    const pillWidth = Math.min(inner, doc.font("Helvetica-Bold").fontSize(7).widthOfString(cell.text) + 12);
                    const px = x + 5 + (column.align === "center" ? (inner - pillWidth) / 2 : 0);
                    doc.roundedRect(px, this.y + rowHeight / 2 - 6.5, pillWidth, 13, 6.5).fill(cell.pill);
                    doc.fillColor(cell.color).text(cell.text, px, this.y + rowHeight / 2 - 3, { width: pillWidth, align: "center", lineBreak: false });
                } else {
                    doc.fillColor(cell.color || C.text).font(cell.bold ? "Helvetica-Bold" : "Helvetica").fontSize(cell.size || 8).text(latin(cell.text), x + 5, this.y + rowHeight / 2 - 4, { width: inner, align: column.align || "left", height: 10, ellipsis: true, lineBreak: false });
                }
                x += column.width;
            }
            doc.moveTo(PAGE.margin, this.y + rowHeight).lineTo(PAGE.margin + W, this.y + rowHeight).lineWidth(0.4).strokeColor(C.line).stroke();
            this.y += rowHeight;
        });
        this.y += 14;
    }

    paragraph(text, { size = 8.5, color = C.muted, font = "Helvetica" } = {}) {
        const { doc } = this;
        doc.font(font).fontSize(size);
        const height = doc.heightOfString(latin(text), { width: W });
        this.ensure(height + 6);
        doc.fillColor(color).text(latin(text), PAGE.margin, this.y, { width: W });
        this.y += height + 8;
    }

    gradingScale() {
        const { doc } = this;
        this.ensure(48);
        const width = W / GRADES.length;
        GRADES.forEach(([grade, min, label], index) => {
            const x = PAGE.margin + index * width;
            const max = index ? GRADES[index - 1][1] - 1 : 100;
            doc.roundedRect(x + 2, this.y, width - 4, 40, 6).fillAndStroke(index === GRADES.length - 1 ? C.failSoft : C.soft, C.line);
            doc.fillColor(index === GRADES.length - 1 ? C.fail : C.brand).font("Helvetica-Bold").fontSize(12).text(grade, x + 2, this.y + 5, { width: width - 4, align: "center", lineBreak: false });
            doc.fillColor(C.text).font("Helvetica-Bold").fontSize(6.8).text(`${min}-${max}%`, x + 2, this.y + 20, { width: width - 4, align: "center", lineBreak: false });
            doc.fillColor(C.muted).font("Helvetica").fontSize(6).text(label, x + 2, this.y + 30, { width: width - 4, align: "center", lineBreak: false });
        });
        this.y += 52;
    }

    // Verification QR, signature lines and the IlmiDunya stamp, always kept together.
    attestation(reference, signatures) {
        const { doc } = this;
        this.ensure(150);
        const top = this.y + 6;
        const url = `${this.meta.verifyBase}/verify/${reference}`;
        doc.roundedRect(PAGE.margin, top, 132, 132, 10).fillAndStroke("#FFFFFF", C.line);
        drawQr(doc, url, PAGE.margin + 26, top + 10, 80);
        doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(7.5).text("SCAN TO VERIFY", PAGE.margin, top + 95, { width: 132, align: "center", characterSpacing: 0.8, lineBreak: false });
        doc.fillColor(C.muted).font("Helvetica").fontSize(6.4).text(reference, PAGE.margin, top + 107, { width: 132, align: "center", lineBreak: false });
        doc.text("ilmidunya.org/verify", PAGE.margin, top + 117, { width: 132, align: "center", lineBreak: false });
        const sx = PAGE.margin + 152;
        signatures.forEach((label, index) => {
            const y = top + 34 + index * 50;
            doc.moveTo(sx, y).lineTo(sx + 170, y).lineWidth(0.7).strokeColor(C.muted).stroke();
            doc.fillColor(C.text).font("Helvetica-Bold").fontSize(8.5).text(label, sx, y + 5, { lineBreak: false });
            doc.fillColor(C.muted).font("Helvetica").fontSize(7).text("Signature and date", sx, y + 16, { lineBreak: false });
        });
        stamp(doc, PAGE.width - PAGE.margin - 70, top + 64, formatDate(this.meta.issuedAt));
        this.y = top + 146;
    }

    footers() {
        const { doc } = this;
        const range = doc.bufferedPageRange();
        // Each report card is numbered on its own, so a single student's pages read "Page 1 of 2".
        const totals = new Map();
        for (const reference of this.pageReferences) totals.set(reference, (totals.get(reference) || 0) + 1);
        const seen = new Map();
        for (let i = 0; i < range.count; i++) {
            const reference = this.pageReferences[i];
            seen.set(reference, (seen.get(reference) || 0) + 1);
            doc.switchToPage(range.start + i);
            doc.page.margins.bottom = 0;
            doc.save().lineWidth(0.6).strokeColor(C.gold).rect(12, 12, PAGE.width - 24, PAGE.height - 24).stroke().restore();
            const y = PAGE.height - 40;
            doc.moveTo(PAGE.margin, y - 7).lineTo(PAGE.width - PAGE.margin, y - 7).lineWidth(0.5).strokeColor(C.line).stroke();
            doc.fillColor(C.muted).font("Helvetica").fontSize(6.8)
                .text(`Computer-generated by IlmiDunya on ${formatDateTime(this.meta.issuedAt)} PKT  ·  Verify at ilmidunya.org/verify/${reference}`, PAGE.margin, y, { width: W - 70, height: 9, ellipsis: true, lineBreak: false })
                .text(`Page ${seen.get(reference)} of ${totals.get(reference)}`, PAGE.width - PAGE.margin - 70, y, { width: 70, align: "right", lineBreak: false });
        }
    }
}

function drawQr(doc, text, x, y, size) {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
    const cell = size / modules.size;
    doc.save().fillColor(C.ink);
    for (let row = 0; row < modules.size; row++) {
        for (let col = 0; col < modules.size; col++) if (modules.get(row, col)) doc.rect(x + col * cell, y + row * cell, cell + 0.05, cell + 0.05);
    }
    doc.fill().restore();
}

const scopeLabel = meta => [meta.className || "All classes", meta.sectionName ? `Section ${meta.sectionName}` : "All sections"].join(" · ");
const resultPill = attempt => (attempt.passStatus === "pass" ? { text: "PASS", pill: C.passSoft, color: C.pass } : attempt.passStatus === "fail" ? { text: "FAIL", pill: C.failSoft, color: C.fail } : { text: "—", color: C.muted });

function reportDetails(sheet, meta, data) {
    sheet.details([
        ["School", meta.schoolName],
        ["Subject", data.subject ? `${data.subject.name}${data.subject.className ? ` (${data.subject.className})` : ""}` : "All subjects"],
        ["Class", meta.className || "All classes"],
        ["Section", meta.sectionName || "All sections"],
        ["Report period", meta.period],
        ["Issued on", formatDateTime(meta.issuedAt)],
    ]);
}

// The class, section or school result report.
function schoolReport(sheet, meta, data) {
    const { overall } = data;
    const level = meta.sectionName ? "SECTION RESULT REPORT" : meta.className ? "CLASS RESULT REPORT" : "SCHOOL RESULT REPORT";
    sheet.page(() => sheet.hero(level, meta.schoolName, meta.reference));
    reportDetails(sheet, meta, data);

    sheet.section("Key results");
    const participation = overall.studentsInScope ? Math.round(overall.studentsAttempted / overall.studentsInScope * 100) : 0;
    sheet.tiles([
        [String(overall.studentsInScope), "Students enrolled"],
        [`${overall.studentsAttempted} (${participation}%)`, "Students who took tests"],
        [String(overall.attempts), "Completed attempts"],
        [String(overall.tests), "Different tests"],
        [pct(overall.average), "Average score", scoreColor(overall.average)],
        [pct(overall.passRate), "Pass rate", overall.passRate >= 50 ? C.pass : C.fail],
        [pct(overall.accuracy), "Answer accuracy"],
        [formatDuration(overall.seconds), "Total test time", C.gold],
    ]);

    if (overall.attempts) {
        sheet.section("Grade distribution", "Each student's grade is based on the average of all their attempts");
        const { doc } = sheet;
        const most = Math.max(1, ...data.distribution.map(item => item.students));
        sheet.ensure(data.distribution.length * 17 + 10);
        for (const item of data.distribution) {
            doc.fillColor(item.grade === "F" ? C.fail : C.ink).font("Helvetica-Bold").fontSize(9).text(item.grade, PAGE.margin, sheet.y + 2, { width: 24, lineBreak: false });
            doc.fillColor(C.muted).font("Helvetica").fontSize(7).text(`${item.min}%+ ${item.label}`, PAGE.margin + 24, sheet.y + 3, { width: 104, lineBreak: false });
            doc.roundedRect(PAGE.margin + 130, sheet.y + 1, W - 200, 10, 5).fill("#EFECF9");
            if (item.students) doc.roundedRect(PAGE.margin + 130, sheet.y + 1, Math.max(8, (W - 200) * item.students / most), 10, 5).fill(item.grade === "F" ? C.fail : item.grade.startsWith("A") ? C.pass : C.brand);
            const share = overall.studentsAttempted ? Math.round(item.students / overall.studentsAttempted * 100) : 0;
            doc.fillColor(C.text).font("Helvetica-Bold").fontSize(7.5).text(`${item.students} ${item.students === 1 ? "student" : "students"} · ${share}%`, PAGE.width - PAGE.margin - 66, sheet.y + 2.5, { width: 66, align: "right", lineBreak: false });
            sheet.y += 17;
        }
        sheet.y += 10;
    }

    if (data.subjects.length) {
        sheet.section("Subject-wise performance");
        sheet.table([
            { title: "Subject", width: 120, cell: row => ({ text: row.name, bold: true }) },
            { title: "Students", width: 46, align: "center", cell: row => ({ text: String(row.students) }) },
            { title: "Attempts", width: 48, align: "center", cell: row => ({ text: String(row.attempts) }) },
            { title: "Average", width: 110, cell: row => ({ bar: row.average }) },
            { title: "Pass rate", width: 52, align: "center", cell: row => ({ text: pct(row.passRate) }) },
            { title: "Accuracy", width: 52, align: "center", cell: row => ({ text: pct(row.accuracy) }) },
            { title: "Best", width: 42, align: "center", cell: row => ({ text: pct(row.best), bold: true, color: C.pass }) },
            { title: "Lowest", width: 42, align: "center", cell: row => ({ text: pct(row.lowest), color: C.fail }) },
        ], data.subjects);
    }

    const topics = data.topics.filter(topic => topic.attempts);
    if (topics.length >= 4) {
        const byAccuracy = [...topics].sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
        const insightColumns = [
            { title: "Topic", width: 190, cell: row => ({ text: row.name, sub: [row.subject, row.chapter].filter(Boolean).join(" · ") }) },
            { title: "Students", width: 50, align: "center", cell: row => ({ text: String(row.students) }) },
            { title: "Attempts", width: 50, align: "center", cell: row => ({ text: String(row.attempts) }) },
            { title: "Accuracy", width: 120, cell: row => ({ bar: row.accuracy }) },
        ];
        sheet.section("Topics that need attention", "Lowest answer accuracy across the class");
        sheet.table(insightColumns, byAccuracy.slice(0, 5), { rowHeight: 26 });
        sheet.section("Strongest topics", "Highest answer accuracy across the class");
        sheet.table(insightColumns, byAccuracy.slice(-5).reverse(), { rowHeight: 26 });
    }

    if (data.chapters.length) {
        sheet.section("Chapter-wise performance");
        sheet.table([
            { title: "Chapter", width: 200, cell: row => ({ text: row.name, sub: row.subject }) },
            { title: "Students", width: 46, align: "center", cell: row => ({ text: String(row.students) }) },
            { title: "Attempts", width: 46, align: "center", cell: row => ({ text: String(row.attempts) }) },
            { title: "Average", width: 110, cell: row => ({ bar: row.average }) },
            { title: "Pass rate", width: 52, align: "center", cell: row => ({ text: pct(row.passRate) }) },
            { title: "Accuracy", width: 52, align: "center", cell: row => ({ text: pct(row.accuracy) }) },
        ], data.chapters, { rowHeight: 26 });
    }

    if (topics.length) {
        sheet.section("Topic-wise performance");
        sheet.table([
            { title: "Topic", width: 200, cell: row => ({ text: row.name, sub: [row.subject, row.chapter].filter(Boolean).join(" · ") }) },
            { title: "Students", width: 46, align: "center", cell: row => ({ text: String(row.students) }) },
            { title: "Attempts", width: 46, align: "center", cell: row => ({ text: String(row.attempts) }) },
            { title: "Average", width: 110, cell: row => ({ bar: row.average }) },
            { title: "Pass rate", width: 52, align: "center", cell: row => ({ text: pct(row.passRate) }) },
            { title: "Accuracy", width: 52, align: "center", cell: row => ({ text: pct(row.accuracy) }) },
        ], topics, { rowHeight: 26 });
    }

    const byId = new Map(data.students.map(student => [student._id, student]));
    const merit = data.merit.map(key => byId.get(key));
    if (merit.length) {
        sheet.section("Merit list", "Ranked by average score, then accuracy, tests taken and time");
        const medal = position => (position === 1 ? C.gold : position === 2 ? C.silver : position === 3 ? C.bronze : null);
        sheet.table([
            { title: "Pos.", width: 30, align: "center", cell: row => ({ text: ordinal(row.position), bold: true, color: medal(row.position) || C.ink }) },
            { title: "Student", width: 140, cell: row => ({ text: row.name, sub: [row.className, row.sectionName && `Section ${row.sectionName}`].filter(Boolean).join(" · ") }) },
            { title: "Tests", width: 34, align: "center", cell: row => ({ text: String(row.summary.tests) }) },
            { title: "Attempts", width: 44, align: "center", cell: row => ({ text: String(row.summary.attempts) }) },
            { title: "Average", width: 46, align: "center", cell: row => ({ text: pct(row.summary.average), bold: true, color: scoreColor(row.summary.average) }) },
            { title: "Best", width: 40, align: "center", cell: row => ({ text: pct(row.summary.best) }) },
            { title: "Accuracy", width: 46, align: "center", cell: row => ({ text: pct(row.summary.accuracy) }) },
            { title: "Passed", width: 40, align: "center", cell: row => ({ text: `${row.summary.passed}/${row.summary.attempts}` }) },
            { title: "Time", width: 46, align: "center", cell: row => ({ text: formatDuration(row.summary.seconds) }) },
            { title: "Grade", width: 36, align: "center", cell: row => ({ text: row.grade, pill: row.grade === "F" ? C.failSoft : C.soft, color: row.grade === "F" ? C.fail : C.brand }) },
        ], merit, { rowHeight: 26, highlight: row => (row.position <= 3 ? C.goldSoft : null) });
    }

    if (data.notAttempted.length) {
        sheet.section(`Students yet to attempt (${data.notAttempted.length})`);
        const { doc } = sheet;
        const perRow = 3;
        const width = W / perRow;
        for (let i = 0; i < data.notAttempted.length; i += perRow) {
            sheet.ensure(14);
            data.notAttempted.slice(i, i + perRow).forEach((student, index) => {
                const extra = [student.className, student.sectionName].filter(Boolean).join(" ");
                doc.fillColor(C.text).font("Helvetica").fontSize(8).text(`• ${latin(student.name)}${extra ? `  (${latin(extra)})` : ""}`, PAGE.margin + index * width, sheet.y, { width: width - 8, height: 10, ellipsis: true, lineBreak: false });
            });
            sheet.y += 13;
        }
        sheet.y += 10;
    }

    sheet.section("Grading scale");
    sheet.gradingScale();
    sheet.paragraph("Notes: Only completed attempts are counted. Average is the mean percentage of all completed attempts; accuracy is correct answers out of all questions answered or skipped. Pass and fail follow each test's passing marks. Times are in Pakistan Standard Time.", { size: 7.5 });
    sheet.attestation(meta.reference, ["Class Teacher", "Principal / Head of School"]);
}

// One student's detailed card. `reference` is unique to this student within the batch.
function studentCard(sheet, meta, data, student, reference, classSize) {
    sheet.currentReference = reference;
    sheet.headerFor = `Report card · ${student.name}`;
    sheet.page(() => sheet.hero("STUDENT REPORT CARD", meta.schoolName, reference));
    const { doc } = sheet;
    sheet.details([
        ["Student name", student.name],
        ["School", meta.schoolName],
        ["Class", student.className || meta.className || "—"],
        ["Section", student.sectionName || meta.sectionName || "—"],
        ["Subject", data.subject ? `${data.subject.name}${data.subject.className ? ` (${data.subject.className})` : ""}` : "All subjects"],
        ["Report period", meta.period],
        ["City", student.city],
        ["IlmiDunya member since", student.memberSince ? formatDate(student.memberSince) : "—"],
    ]);

    const s = student.summary;
    if (!s) {
        sheet.paragraph("No completed tests in this period.", { size: 11, color: C.text, font: "Helvetica-Bold" });
        sheet.attestation(reference, ["Class Teacher", "Principal / Head of School"]);
        return;
    }

    // Result banner: the grade seal, overall score and position.
    sheet.ensure(96);
    const top = sheet.y;
    doc.roundedRect(PAGE.margin, top, W, 84, 12).fill(C.ink);
    doc.save().lineWidth(0.5).strokeOpacity(0.2);
    for (let r = 20; r <= 110; r += 10) doc.circle(PAGE.width - PAGE.margin - 20, top + 84, r).stroke("#FFFFFF");
    doc.restore();
    doc.circle(PAGE.margin + 46, top + 42, 30).fill(C.gold);
    doc.circle(PAGE.margin + 46, top + 42, 26).lineWidth(1).stroke("#FFFFFF");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(student.grade.length > 1 ? 20 : 24).text(student.grade, PAGE.margin + 16, top + 31, { width: 60, align: "center", lineBreak: false });
    doc.fillColor("#D8CCFF").font("Helvetica").fontSize(7.5).text("OVERALL RESULT", PAGE.margin + 92, top + 16, { characterSpacing: 1.2, lineBreak: false });
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(22).text(pct(s.average), PAGE.margin + 92, top + 28, { lineBreak: false });
    doc.fillColor("#D8CCFF").font("Helvetica").fontSize(8).text(latin(remarkFor(s.average)), PAGE.margin + 92, top + 56, { width: 270, height: 20, ellipsis: true });
    doc.fillColor("#D8CCFF").font("Helvetica").fontSize(7.5).text("POSITION IN THIS REPORT", PAGE.width - PAGE.margin - 150, top + 16, { width: 136, align: "right", characterSpacing: 1, lineBreak: false });
    doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(22).text(ordinal(student.position), PAGE.width - PAGE.margin - 150, top + 28, { width: 136, align: "right", lineBreak: false });
    doc.fillColor("#D8CCFF").font("Helvetica").fontSize(8).text(`out of ${classSize} students`, PAGE.width - PAGE.margin - 150, top + 56, { width: 136, align: "right", lineBreak: false });
    sheet.y = top + 98;

    sheet.tiles([
        [String(s.tests), "Different tests"],
        [String(s.attempts), "Total attempts"],
        [pct(s.best), "Best score", C.pass],
        [pct(s.accuracy), "Answer accuracy"],
        [`${s.passed} / ${s.failed}`, "Passed / failed", s.passed >= s.failed ? C.pass : C.fail],
        [`${s.correct}/${s.questions}`, "Correct answers"],
        [formatDuration(s.seconds), "Total test time", C.gold],
        [`${formatDate(student.first)}`, "First test taken"],
    ]);

    if (student.subjects.length) {
        sheet.section("Subject-wise performance");
        sheet.table([
            { title: "Subject", width: 130, cell: row => ({ text: row.subject, bold: true }) },
            { title: "Tests", width: 40, align: "center", cell: row => ({ text: String(row.tests) }) },
            { title: "Attempts", width: 46, align: "center", cell: row => ({ text: String(row.attempts) }) },
            { title: "Average", width: 120, cell: row => ({ bar: row.average }) },
            { title: "Best", width: 44, align: "center", cell: row => ({ text: pct(row.best), bold: true }) },
            { title: "Accuracy", width: 50, align: "center", cell: row => ({ text: pct(row.accuracy) }) },
            { title: "Passed", width: 44, align: "center", cell: row => ({ text: `${row.passed}/${row.attempts}` }) },
            { title: "Grade", width: 40, align: "center", cell: row => ({ text: gradeOf(row.average), pill: C.soft, color: C.brand }) },
        ], student.subjects);
    }

    sheet.section("Detailed test record", `${student.attempts.length} attempts, oldest first`);
    sheet.table([
        { title: "#", width: 20, align: "center", cell: (_, index) => ({ text: String(index + 1), color: C.muted }) },
        { title: "Date & time", width: 62, cell: row => ({ text: formatDate(row.startedAt), sub: formatTime(row.startedAt), bold: false }) },
        { title: "Test · chapter / topic", width: 152, cell: row => ({ text: row.title, sub: [row.topic || row.chapter || row.type, row.practiceSet ? "Practice set" : ""].filter(Boolean).join(" · ") }) },
        { title: "Try", width: 26, align: "center", cell: row => ({ text: ordinal(row.attemptNo), color: row.attemptNo > 1 ? C.muted : C.text }) },
        { title: "Right / wrong / skip", width: 70, align: "center", cell: row => ({ text: `${row.correct} / ${row.wrong} / ${row.skipped}`, sub: `${row.questions} questions` }) },
        { title: "Marks", width: 42, align: "center", cell: row => ({ text: `${num(row.score)}/${num(row.totalMarks)}`, bold: true }) },
        { title: "Score", width: 40, align: "center", cell: row => ({ text: pct(row.percentage), bold: true, color: scoreColor(row.percentage) }) },
        { title: "Time", width: 50, align: "center", cell: row => ({ text: formatDuration(row.timeTakenSeconds), sub: row.submission === "Submitted" ? "" : row.submission }) },
        { title: "Grade", width: 30, align: "center", cell: row => ({ text: row.grade, bold: true, color: row.grade === "F" ? C.fail : C.brand }) },
        { title: "Result", width: 38, align: "center", cell: row => resultPill(row) },
    ], student.attempts, { rowHeight: 26 });

    // Strengths and focus areas from the student's own topics.
    const topics = new Map();
    for (const attempt of student.attempts) {
        const key = attempt.topic || attempt.chapter;
        if (!key) continue;
        const entry = topics.get(key) || { name: key, correct: 0, questions: 0 };
        entry.correct += attempt.correct;
        entry.questions += attempt.questions;
        topics.set(key, entry);
    }
    const ranked = [...topics.values()].filter(item => item.questions).map(item => ({ ...item, accuracy: item.correct / item.questions * 100 })).sort((a, b) => b.accuracy - a.accuracy);
    sheet.section("Teacher's remarks");
    const lines = [remarkFor(s.average)];
    if (ranked.length >= 2) {
        lines.push(`Strongest area: ${ranked[0].name} (${pct(ranked[0].accuracy)} correct).`);
        lines.push(`Needs more practice: ${ranked[ranked.length - 1].name} (${pct(ranked[ranked.length - 1].accuracy)} correct).`);
    }
    if (student.subjects.length >= 2) {
        const bySubject = [...student.subjects].sort((a, b) => b.average - a.average);
        lines.push(`Best subject: ${bySubject[0].subject} (${pct(bySubject[0].average)}). Focus subject: ${bySubject[bySubject.length - 1].subject} (${pct(bySubject[bySubject.length - 1].average)}).`);
    }
    sheet.ensure(lines.length * 13 + 30);
    doc.roundedRect(PAGE.margin, sheet.y, W, lines.length * 13 + 18, 10).fillAndStroke(C.goldSoft, "#EBDDAE");
    lines.forEach((line, index) => doc.fillColor(index ? C.text : C.ink).font(index ? "Helvetica" : "Helvetica-Bold").fontSize(8.5).text(latin(line), PAGE.margin + 14, sheet.y + 10 + index * 13, { width: W - 28, height: 11, ellipsis: true, lineBreak: false }));
    sheet.y += lines.length * 13 + 30;

    sheet.section("Grading scale");
    sheet.gradingScale();
    sheet.attestation(reference, ["Class Teacher", "Principal / Head of School"]);
}

const gradeOf = percentage => (GRADES.find(([, min]) => (Number(percentage) || 0) >= min) || GRADES[GRADES.length - 1])[0];

// Builds the whole PDF in memory and resolves with its bytes.
function renderSchoolPdf(meta, data) {
    const sheet = new Sheet(meta);
    if (meta.kind === "cards") {
        const byId = new Map(data.students.map(student => [student._id, student]));
        const ordered = data.merit.map(key => byId.get(key));
        const position = new Map(ordered.map(student => [student._id, student.position]));
        // Cards follow the class list order so they can be handed out roll-number style.
        const withTests = data.students.filter(student => student.summary).map(student => ({ ...student, position: position.get(student._id) }));
        if (!withTests.length) {
            sheet.page(() => sheet.hero("STUDENT REPORT CARDS", meta.schoolName, meta.reference));
            reportDetails(sheet, meta, data);
            sheet.paragraph("No student in this selection has completed a test in this period.", { size: 11, color: C.text, font: "Helvetica-Bold" });
        }
        withTests.forEach(student => studentCard(sheet, meta, data, student, meta.cardReferences[student._id], ordered.length));
    } else {
        schoolReport(sheet, meta, data);
    }
    sheet.footers();
    return new Promise((resolve, reject) => {
        const chunks = [];
        sheet.doc.on("data", chunk => chunks.push(chunk));
        sheet.doc.on("end", () => resolve(Buffer.concat(chunks)));
        sheet.doc.on("error", reject);
        sheet.doc.end();
    });
}

module.exports = { renderSchoolPdf, ordinal };
