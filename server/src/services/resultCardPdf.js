const path = require("node:path");
const PDFDocument = require("pdfkit");
const { formatDate, formatTime, formatDateTime, formatDuration } = require("./pakistanTime");

const LOGO = path.join(__dirname, "../../assets/logo.png");
const COLORS = { dark: "#24154D", brand: "#623FCD", soft: "#F3EFFF", line: "#DDD6F5", text: "#17202A", muted: "#64748B", pass: "#047857", fail: "#B91C1C", pending: "#B45309", zebra: "#FAF9FF" };
const PAGE = { width: 595.28, height: 841.89, margin: 40 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const ROW_HEIGHT = 30;
const TABLE_HEADER_HEIGHT = 22;
const PAGE_LIMIT = PAGE.height - 70;
// Rows on the final page must end above the stamp.
const STAMP_LIMIT = PAGE.height - 202;
const MIN_ROWS_WITH_STAMP = 2;
const MAX_ROWS = 300;

// Built-in PDF fonts only cover Latin text; other scripts become "?" instead of corrupt glyphs.
const latin = value => String(value ?? "").replace(/[^\x20-\x7E -ÿ]/g, "?").replace(/\s+/g, " ").trim();
const percent = value => `${Math.round((Number(value) || 0) * 10) / 10}%`;
const marks = value => String(Math.round((Number(value) || 0) * 100) / 100);

// Statistics for released results only; withheld results stay "Pending" until an admin releases them.
function summarize(attempts) {
    const released = attempts.filter(attempt => !attempt.withheld);
    return {
        attempted: attempts.length,
        released: released.length,
        average: released.length ? released.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) / released.length : 0,
        best: released.reduce((best, attempt) => Math.max(best, attempt.percentage || 0), 0),
        passed: released.filter(attempt => attempt.passStatus === "pass").length,
        seconds: attempts.reduce((sum, attempt) => sum + (attempt.timeTakenSeconds || 0), 0),
    };
}

function performanceBand(average, released) {
    if (!released) return "Results will be added once they are released.";
    if (average >= 85) return "Outstanding performance. Keep up the excellent work.";
    if (average >= 70) return "Very good performance with room to aim even higher.";
    if (average >= 50) return "Good progress. Regular practice will lift these results further.";
    return "More practice is needed. Revisit the explanations and retry the tests.";
}

function header(doc, { reference, generatedAt }) {
    doc.rect(0, 0, PAGE.width, 108).fill(COLORS.dark);
    doc.rect(0, 108, PAGE.width, 4).fill(COLORS.brand);
    doc.roundedRect(PAGE.margin, 26, 56, 56, 12).fill("#FFFFFF");
    doc.image(LOGO, PAGE.margin + 6, 32, { fit: [44, 44], align: "center", valign: "center" });
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(24).text("IlmiDunya", PAGE.margin + 70, 30, { lineBreak: false });
    doc.fillColor("#CFC4F5").font("Helvetica").fontSize(10).text("Learning that moves you forward", PAGE.margin + 70, 59, { lineBreak: false });
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(15).text("STUDENT RESULT CARD", 300, 32, { width: PAGE.width - PAGE.margin - 300, align: "right", lineBreak: false });
    doc.fillColor("#CFC4F5").font("Helvetica").fontSize(8.5)
        .text(`Report no. ${reference}`, 300, 56, { width: PAGE.width - PAGE.margin - 300, align: "right", lineBreak: false })
        .text(`Issued ${formatDate(generatedAt)}`, 300, 69, { width: PAGE.width - PAGE.margin - 300, align: "right", lineBreak: false });
}

function sectionTitle(doc, title, y) {
    doc.fillColor(COLORS.brand).font("Helvetica-Bold").fontSize(9.5).text(title.toUpperCase(), PAGE.margin, y, { characterSpacing: 1.2, lineBreak: false });
    doc.moveTo(PAGE.margin, y + 15).lineTo(PAGE.width - PAGE.margin, y + 15).lineWidth(0.8).strokeColor(COLORS.line).stroke();
}

function studentDetails(doc, student, y) {
    const rows = [
        ["Student name", student.name], ["School", student.school],
        ["Class", student.schoolClass || "—"], ["Section", student.schoolSection || "—"],
        ["City", student.city || "—"], ["Email", student.email],
        ["WhatsApp / phone", student.phone || "—"], ["Member since", formatDate(student.createdAt)],
    ];
    const cardHeight = 20 + Math.ceil(rows.length / 2) * 34;
    doc.roundedRect(PAGE.margin, y, CONTENT_WIDTH, cardHeight, 10).fillAndStroke(COLORS.soft, COLORS.line);
    rows.forEach(([label, value], index) => {
        const x = PAGE.margin + 16 + (index % 2) * (CONTENT_WIDTH / 2);
        const top = y + 12 + Math.floor(index / 2) * 34;
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5).text(label.toUpperCase(), x, top, { characterSpacing: 0.8, lineBreak: false });
        doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(10.5).text(latin(value), x, top + 11, { width: CONTENT_WIDTH / 2 - 28, height: 13, ellipsis: true, lineBreak: false });
    });
    return y + cardHeight;
}

function statTiles(doc, stats, y) {
    const tiles = [
        [String(stats.attempted), "Tests attempted"],
        [stats.released ? percent(stats.average) : "—", "Average score"],
        [stats.released ? percent(stats.best) : "—", "Best score"],
        [`${stats.passed}`, "Tests passed"],
        [formatDuration(stats.seconds), "Total test time"],
    ];
    const gap = 8;
    const width = (CONTENT_WIDTH - gap * (tiles.length - 1)) / tiles.length;
    tiles.forEach(([value, label], index) => {
        const x = PAGE.margin + index * (width + gap);
        doc.roundedRect(x, y, width, 54, 8).fillAndStroke("#FFFFFF", COLORS.line);
        doc.rect(x, y + 10, 3, 34).fill(COLORS.brand);
        doc.fillColor(COLORS.dark).font("Helvetica-Bold").fontSize(15).text(value, x + 10, y + 11, { width: width - 14, lineBreak: false });
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5).text(label.toUpperCase(), x + 10, y + 34, { width: width - 14, characterSpacing: 0.5, lineBreak: false });
    });
    return y + 54;
}

const COLUMNS = [
    { key: "no", title: "#", width: 24, align: "center" },
    { key: "when", title: "DATE & TIME", width: 84 },
    { key: "test", title: "TEST", width: 202 },
    { key: "marks", title: "MARKS", width: 56, align: "center" },
    { key: "percent", title: "SCORE", width: 48, align: "center" },
    { key: "time", title: "TIME", width: 52, align: "center" },
    { key: "result", title: "RESULT", width: 49, align: "center" },
];

function tableHeader(doc, y) {
    doc.rect(PAGE.margin, y, CONTENT_WIDTH, TABLE_HEADER_HEIGHT).fill(COLORS.brand);
    let x = PAGE.margin;
    COLUMNS.forEach(column => {
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7.5).text(column.title, x + 6, y + 7, { width: column.width - 12, align: column.align || "left", characterSpacing: 0.6, lineBreak: false });
        x += column.width;
    });
    return y + TABLE_HEADER_HEIGHT;
}

// How many rows go on each page so that the last page has room for the stamp.
function planPages(total, firstTop, laterTop) {
    const plan = [];
    let remaining = total;
    let top = firstTop;
    while (remaining > 0) {
        const normal = Math.max(1, Math.floor((PAGE_LIMIT - top) / ROW_HEIGHT));
        const withStamp = Math.max(1, Math.floor((STAMP_LIMIT - top) / ROW_HEIGHT));
        let take = normal;
        if (remaining <= withStamp) take = remaining;
        else if (remaining <= normal) take = Math.min(remaining - 1, Math.max(1, remaining - MIN_ROWS_WITH_STAMP));
        plan.push(take);
        remaining -= take;
        top = laterTop;
    }
    return plan;
}

function tableRow(doc, attempt, index, y) {
    if (index % 2 === 1) doc.rect(PAGE.margin, y, CONTENT_WIDTH, ROW_HEIGHT).fill(COLORS.zebra);
    const withheld = attempt.withheld;
    const result = withheld ? "Pending" : attempt.passStatus === "pass" ? "Pass" : attempt.passStatus === "fail" ? "Fail" : "—";
    const resultColor = withheld ? COLORS.pending : attempt.passStatus === "pass" ? COLORS.pass : attempt.passStatus === "fail" ? COLORS.fail : COLORS.muted;
    const cells = {
        no: String(index + 1),
        marks: withheld ? "—" : `${marks(attempt.score)}/${marks(attempt.totalMarks)}`,
        percent: withheld ? "—" : percent(attempt.percentage),
        time: formatDuration(attempt.timeTakenSeconds),
    };
    let x = PAGE.margin;
    COLUMNS.forEach(column => {
        const options = { width: column.width - 12, align: column.align || "left", lineBreak: false };
        if (column.key === "test") {
            doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(8.5).text(latin(attempt.title), x + 6, y + 5, { ...options, height: 11, ellipsis: true });
            const detail = [attempt.subject, attempt.type, attempt.isPartialPractice ? "Practice set" : ""].filter(Boolean).join("  |  ");
            doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7).text(latin(detail), x + 6, y + 17, { ...options, height: 9, ellipsis: true });
        } else if (column.key === "when") {
            doc.fillColor(COLORS.text).font("Helvetica").fontSize(8).text(formatDate(attempt.startedAt), x + 6, y + 5, options);
            doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7).text(formatTime(attempt.startedAt), x + 6, y + 17, options);
        } else if (column.key === "result") {
            doc.fillColor(resultColor).font("Helvetica-Bold").fontSize(8).text(result, x + 6, y + 11, options);
        } else {
            doc.fillColor(column.key === "percent" ? COLORS.dark : COLORS.text).font(column.key === "percent" ? "Helvetica-Bold" : "Helvetica").fontSize(8).text(cells[column.key], x + 6, y + 11, options);
        }
        x += column.width;
    });
    doc.moveTo(PAGE.margin, y + ROW_HEIGHT).lineTo(PAGE.width - PAGE.margin, y + ROW_HEIGHT).lineWidth(0.4).strokeColor(COLORS.line).stroke();
    return y + ROW_HEIGHT;
}

// Text laid along a circle. `top` text reads clockwise over the top, bottom text reads left to right under it.
function arcText(doc, text, cx, cy, radius, { top = true, size = 9, spacing = 1.5 } = {}) {
    doc.font("Helvetica-Bold").fontSize(size);
    const widths = [...text].map(char => doc.widthOfString(char) + spacing);
    const span = widths.reduce((sum, width) => sum + width, 0) / radius;
    let angle = top ? -Math.PI / 2 - span / 2 : Math.PI / 2 + span / 2;
    [...text].forEach((char, index) => {
        const step = widths[index] / radius;
        const middle = top ? angle + step / 2 : angle - step / 2;
        const x = cx + radius * Math.cos(middle);
        const y = cy + radius * Math.sin(middle);
        doc.save().translate(x, y).rotate((middle * 180) / Math.PI + (top ? 90 : -90));
        doc.text(char, -widths[index] / 2 + spacing / 2, top ? -size : 0, { lineBreak: false });
        doc.restore();
        angle += top ? step : -step;
    });
}

function star(doc, x, y, radius) {
    const points = Array.from({ length: 10 }, (_, i) => {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? radius * 0.42 : radius;
        return [x + r * Math.cos(angle), y + r * Math.sin(angle)];
    });
    doc.polygon(...points).fill(COLORS.brand);
}

function stamp(doc, cx, cy, issuedOn) {
    doc.save().translate(cx, cy).rotate(-10).translate(-cx, -cy);
    doc.fillOpacity(0.88).strokeOpacity(0.88);
    doc.lineWidth(2.6).circle(cx, cy, 58).stroke(COLORS.brand);
    doc.lineWidth(0.8).circle(cx, cy, 53).stroke(COLORS.brand);
    doc.lineWidth(0.8).circle(cx, cy, 33).stroke(COLORS.brand);
    doc.fillColor(COLORS.brand);
    arcText(doc, "ILMIDUNYA", cx, cy, 38.5, { top: true, size: 10.5, spacing: 2.4 });
    arcText(doc, "VERIFIED RESULT", cx, cy, 41, { top: false, size: 7.5, spacing: 1.8 });
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.brand).text("OFFICIAL", cx - 30, cy - 12, { width: 60, align: "center", characterSpacing: 1, lineBreak: false });
    doc.moveTo(cx - 22, cy - 1).lineTo(cx + 22, cy - 1).lineWidth(0.6).stroke(COLORS.brand);
    doc.font("Helvetica").fontSize(6.5).text(issuedOn, cx - 30, cy + 4, { width: 60, align: "center", lineBreak: false });
    // Stars between the two arcs.
    for (const side of [-1, 1]) star(doc, cx + side * 43.5, cy, 3.2);
    doc.restore();
    doc.fillOpacity(1).strokeOpacity(1);
}

function footers(doc, { reference, generatedAt }) {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        // Writing in the bottom margin must not start a new page.
        doc.page.margins.bottom = 0;
        const y = PAGE.height - 34;
        doc.moveTo(PAGE.margin, y - 8).lineTo(PAGE.width - PAGE.margin, y - 8).lineWidth(0.6).strokeColor(COLORS.line).stroke();
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5)
            .text(`Computer-generated by IlmiDunya on ${formatDateTime(generatedAt)} (Pakistan time). No signature is required.`, PAGE.margin, y, { width: CONTENT_WIDTH - 90, lineBreak: false })
            .text(`Ref ${reference}  |  Page ${i + 1} of ${range.count}`, PAGE.width - PAGE.margin - 180, y, { width: 180, align: "right", lineBreak: false });
    }
}

// Streams a finished result card. `attempts` are the student's completed attempts, newest first.
function createResultCard({ student, attempts, generatedAt = new Date(), reference }) {
    const doc = new PDFDocument({
        size: "A4",
        margins: { top: PAGE.margin, bottom: 50, left: PAGE.margin, right: PAGE.margin },
        bufferPages: true,
        info: { Title: `Result Card - ${latin(student.name)}`, Author: "IlmiDunya", Subject: "Student result card", Creator: "IlmiDunya" },
    });
    const shown = attempts.slice(0, MAX_ROWS);
    const stats = summarize(attempts);

    header(doc, { reference, generatedAt });
    let y = 132;
    sectionTitle(doc, "Student details", y);
    y = studentDetails(doc, student, y + 24) + 20;
    sectionTitle(doc, "Performance summary", y);
    y = statTiles(doc, stats, y + 24) + 12;
    doc.fillColor(COLORS.muted).font("Helvetica-Oblique").fontSize(8.5).text(performanceBand(stats.average, stats.released), PAGE.margin, y, { width: CONTENT_WIDTH, lineBreak: false });
    y += 28;

    sectionTitle(doc, attempts.length > shown.length ? `Test results (latest ${shown.length} of ${attempts.length})` : "Test results", y);
    y += 24;
    const stampBaseY = PAGE.height - 150;
    if (!shown.length) {
        doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10).text("No completed tests yet. Results will appear here after your first test.", PAGE.margin, y + 6, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
    } else {
        // The stamp sits at the foot of the final page, so rows are planned to leave room for it there.
        const laterTop = PAGE.margin + 4 + TABLE_HEADER_HEIGHT;
        const plan = planPages(shown.length, y + TABLE_HEADER_HEIGHT, laterTop);
        let index = 0;
        plan.forEach((count, pageIndex) => {
            if (pageIndex > 0) { doc.addPage(); y = PAGE.margin + 4; }
            y = tableHeader(doc, y);
            for (let i = 0; i < count; i++) y = tableRow(doc, shown[index], index++, y);
        });
    }

    doc.moveTo(PAGE.margin, stampBaseY - 6).lineTo(PAGE.margin + 200, stampBaseY - 6).lineWidth(0.8).strokeColor(COLORS.muted).stroke();
    doc.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(9).text("IlmiDunya Academic Records", PAGE.margin, stampBaseY, { lineBreak: false });
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text("Issued electronically", PAGE.margin, stampBaseY + 13, { lineBreak: false })
        .text(`Date of issue: ${formatDate(generatedAt)}`, PAGE.margin, stampBaseY + 25, { lineBreak: false });
    stamp(doc, PAGE.width - PAGE.margin - 78, stampBaseY + 18, formatDate(generatedAt));

    footers(doc, { reference, generatedAt });
    doc.end();
    return doc;
}

module.exports = { createResultCard, summarize, latin, planPages, MAX_ROWS };
