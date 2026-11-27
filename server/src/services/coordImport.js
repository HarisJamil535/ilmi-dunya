const JSZip = require("jszip");
const { DAYS } = require("./coordTemplate");
const { normalise, plainText } = require("./coordRichText");

// Reads coordination records out of a Word (.docx) file: one week per record table, keeping bold, italic,
// underline, colour, highlight and bullet/numbered lists. Columns are found by their headings, so both the
// blank APSACS format (Monday–Friday rows) and the older topic-row format can be imported. In the older
// format each topic row becomes the next day (Monday, Tuesday, ...).
const MAX_BYTES = 10 * 1024 * 1024;
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const HIGHLIGHT = { yellow: "#fef08a", green: "#bbf7d0", brightGreen: "#bbf7d0", cyan: "#bfdbfe", turquoise: "#bfdbfe", magenta: "#fbcfe8", pink: "#fbcfe8", lightGray: "#fef08a" };
const attr = (xml, tag, name = "w:val") => { const m = new RegExp(`<${tag}\\b[^>]*?${name}="([^"]*)"`).exec(xml); return m ? m[1] : null; };
const on = (xml, tag) => { const m = new RegExp(`<${tag}\\b([^>]*)/?>`).exec(xml); if (!m) return false; const v = /w:val="([^"]*)"/.exec(m[1]); return !v || !["0", "false", "none"].includes(v[1]); };

// Splits XML into the top-level children named `tag` (handles nesting of the same tag).
function children(xml, tag) {
    const out = [];
    const open = new RegExp(`<${tag}[ >]|<${tag}/>|</${tag}>`, "g");
    let depth = 0, start = -1, m;
    while ((m = open.exec(xml))) {
        if (m[0] === `</${tag}>`) { depth--; if (depth === 0) { out.push(xml.slice(start, m.index + m[0].length)); start = -1; } }
        else if (m[0] === `<${tag}/>`) { if (depth === 0) out.push(m[0]); }
        else { if (depth === 0) start = m.index; depth++; }
    }
    return out;
}

function listKinds(numberingXml) {
    // numId -> "ul" | "ol", from numbering.xml (level 0 format).
    const abstractFmt = {};
    for (const abs of children(numberingXml || "", "w:abstractNum")) {
        const id = attr(abs, "w:abstractNum", "w:abstractNumId");
        const lvl0 = children(abs, "w:lvl")[0] || "";
        abstractFmt[id] = /w:numFmt w:val="(decimal|lowerLetter|upperLetter|lowerRoman|upperRoman)"/.test(lvl0) ? "ol" : "ul";
    }
    const kinds = {};
    for (const num of children(numberingXml || "", "w:num")) kinds[attr(num, "w:num", "w:numId")] = abstractFmt[attr(num, "w:abstractNumId")] || "ul";
    return kinds;
}

function paragraphOf(pXml, lists) {
    const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(pXml)?.[0] || "";
    const numId = attr(pPr, "w:numId");
    const align = attr(pPr, "w:jc");
    const runs = [];
    for (const r of [...children(pXml, "w:r"), ...children(pXml, "w:hyperlink").flatMap((h) => children(h, "w:r"))]) {
        const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(r)?.[0] || "";
        let text = "";
        for (const m of r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) text += m[1] !== undefined ? decode(m[1]) : m[0] === "<w:tab/>" ? " " : "\n";
        if (!text) continue;
        const colour = attr(rPr, "w:color");
        const size = Number(attr(rPr, "w:sz")) / 2;
        runs.push({ t: text, b: on(rPr, "w:b"), i: on(rPr, "w:i"), u: on(rPr, "w:u") && attr(rPr, "w:u") !== "none", s: on(rPr, "w:strike"),
            c: colour && colour !== "auto" && colour !== "000000" ? `#${colour.toLowerCase()}` : undefined, h: HIGHLIGHT[attr(rPr, "w:highlight")] || undefined,
            z: size && size < 8 ? "s" : size > 13 ? "l" : undefined });
    }
    // A line break inside a run starts a new paragraph.
    const paragraphs = [{ list: numId && numId !== "0" ? lists[numId] || "ul" : "", align: align === "center" ? "center" : align === "right" ? "right" : "left", runs: [] }];
    for (const run of runs) {
        const parts = run.t.split("\n");
        parts.forEach((part, i) => { if (i > 0) paragraphs.push({ list: paragraphs[0].list, align: paragraphs[0].align, runs: [] }); if (part) paragraphs[paragraphs.length - 1].runs.push({ ...run, t: part }); });
    }
    // Bullets or numbers typed as text ("• item", "1. item") become real lists.
    for (const p of paragraphs) {
        if (p.list || !p.runs.length) continue;
        const m = /^\s*(?:([•·▪◦\-–])|(\d{1,2})[.)])[\t ]+/.exec(p.runs[0].t);
        if (!m) continue;
        p.list = m[1] ? "ul" : "ol";
        p.runs[0] = { ...p.runs[0], t: p.runs[0].t.slice(m[0].length) };
    }
    return paragraphs;
}

const cellParagraphs = (tcXml, lists) => children(tcXml, "w:p").flatMap((p) => paragraphOf(p, lists));
const textOf = (paragraphs) => plainText(paragraphs).replace(/\s+/g, " ").trim();
const span = (tcXml) => Number(attr(tcXml, "w:gridSpan")) || 1;

// Removes a leading label ("Topic:", "Subject:") from a cell's paragraphs and returns what follows it.
function afterLabel(paragraphs, pattern) {
    const out = [];
    let found = false;
    for (const p of paragraphs) {
        if (found) { out.push(p); continue; }
        const text = p.runs.map((r) => r.t).join("");
        const m = pattern.exec(text);
        if (!m) continue;
        found = true;
        let skip = m.index + m[0].length;
        const runs = [];
        for (const r of p.runs) {
            if (skip >= r.t.length) { skip -= r.t.length; continue; }
            runs.push({ ...r, t: r.t.slice(skip) }); skip = 0;
        }
        if (runs.length) runs[0] = { ...runs[0], t: runs[0].t.replace(/^\s+/, "") };
        out.push({ ...p, runs });
    }
    return found ? out : [];
}
// Cuts paragraphs at a following label (e.g. Subject text ends where "Topic:" starts).
function beforeLabel(paragraphs, pattern) {
    const out = [];
    for (const p of paragraphs) {
        const text = p.runs.map((r) => r.t).join("");
        const m = pattern.exec(text);
        if (!m) { out.push(p); continue; }
        let keep = m.index; const runs = [];
        for (const r of p.runs) { if (keep <= 0) break; runs.push({ ...r, t: r.t.slice(0, keep) }); keep -= r.t.length; }
        out.push({ ...p, runs });
        break;
    }
    return out;
}
// One line of text; a line of underscores (a blank to fill in on paper) counts as empty.
const singleLine = (paragraphs) => [{ list: "", align: "left", runs: [{ t: textOf(paragraphs).replace(/_{2,}/g, " ").replace(/\s+/g, " ").trim() }] }].filter((p) => p.runs[0].t);

const COLUMN_RULES = [
    // Urdu forms (Urdu, Islamiyat, Tarjuma-tul-Quran)
    [/ذیلی\s*موضوع/, "subTopics"],
    [/دن|پیریڈ/, "period"],
    [/طریق/, "methods"],
    [/وسائل/, "resources"],
    [/حکمت/, "afl"],
    [/کلاس\s*ورک|ہوم\s*ورک|اسائنمنٹ|پراجیکٹ/, "work"],
    [/period\s*wise|break-?\s*up/i, "subTopics"],
    [/day|period/i, "period"],
    [/sub[\s-]*topic|topic/i, "subTopics"],
    [/method/i, "methods"],
    [/resource/i, "resources"],
    [/afl|assessment/i, "afl"],
    [/cw|hw|assign|project|home\s*work|class\s*work/i, "work"],
];
const columnKey = (text) => COLUMN_RULES.find(([pattern]) => pattern.test(text))?.[1] || null;
const URDU_DAY = { mon: "پیر", tue: "منگل", wed: "بدھ", thu: "جمعرات", fri: "جمعہ" };
const DAY_NAMES = [...DAYS.map(([key, name]) => [key, new RegExp(`^\\s*${name}\\b`, "i")]), ...DAYS.map(([key]) => [key, new RegExp(`^\\s*${URDU_DAY[key]}(?![\\u0600-\\u06FF])`)])];
const dayPattern = (day) => new RegExp(`^\\s*(?:${DAYS.find(([k]) => k === day)[1]}|${URDU_DAY[day]})\\s*`, "i");
// "پہلا" (first), "دوسرا" (second)... as week numbers.
const URDU_ORDINALS = ["پہلا", "دوسرا", "تیسرا", "چوتھا", "پانچواں", "چھٹا", "ساتواں", "آٹھواں", "نواں", "دسواں", "گیارہواں", "بارہواں", "تیرہواں", "چودہواں", "پندرہواں", "سولہواں", "سترہواں", "اٹھارہواں", "انیسواں", "بیسواں"];
const URDU_DIGITS = (t) => String(t || "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

function parseTable(tblXml, lists, before) {
    const cells = {};
    const notes = [];
    const rows = children(tblXml, "w:tr").map((tr) => children(tr, "w:tc").map((tc) => ({ xml: tc, paragraphs: cellParagraphs(tc, lists), span: span(tc) })));
    let columnMap = null;
    let nextDay = 0;
    for (const row of rows) {
        const rowText = row.map((c) => textOf(c.paragraphs)).join(" | ");
        const all = row.flatMap((c) => c.paragraphs);
        if (!rowText.trim()) continue;
        if (/^\s*(steps?|ste\s*ps)\b/i.test(rowText) && row.length > 1 && /subject/i.test(rowText)) { /* older format: "Steps | Subject: ..." */ }
        if (/subject\s*:/i.test(rowText)) {
            cells.subject = singleLine(beforeLabel(afterLabel(all, /subject\s*:/i), /topic\s*:|chapter|periods per week/i));
            const topic = afterLabel(all, /topic\s*:/i);
            cells.topic = singleLine(beforeLabel(topic.length ? topic : afterLabel(all, /(?=chapter\s*\d)/i), /periods per week/i));
            cells.periods = singleLine(afterLabel(all, /periods per week\s*:?/i));
            continue;
        }
        if (/مضمون\s*:/.test(rowText)) {
            cells.subject = singleLine(beforeLabel(afterLabel(all, /مضمون\s*:/), /ہفتہ وار\s*پیریڈز|موضوع\s*:/));
            cells.topic = afterLabel(all, /موضوع\s*:/);
            cells.periods = singleLine(beforeLabel(afterLabel(all, /پیریڈز\s*:?/), /موضوع\s*:/));
            continue;
        }
        if (/گزشتہ\s*ہفتے|آگے آنے والے/.test(rowText)) { const after = afterLabel(all, /\(اگر کوئی ہوں\)\s*:?/); cells.broughtForward = after.length ? after : afterLabel(all, /موضوعات\s*:?/); continue; }
        if (/اضافی\s*معاونت/.test(rowText)) { const after = afterLabel(all, /عملیاں\s*:/); cells.extraHelp = after.length ? after : afterLabel(all, /متقاضی طلبہ کے لیے\s*:?/); continue; }
        if (/ذمہ\s*دار\s*استاد|شرکاء/.test(rowText)) {
            if (/ذمہ\s*دار\s*استاد/.test(rowText)) cells.teacher = singleLine(beforeLabel(afterLabel(all, /استاد\s*:?/), /رابطہ اجلاس|شرکاء/));
            if (/شرکاء/.test(rowText)) {
                // "1۔شاہد طارق | 2۔ ذکیہ عطا | 3۔ سیکشن ہیڈ | 4۔"
                const list = URDU_DIGITS(rowText.slice(rowText.search(/شرکاء/) + 5)).replace(/\s*\|\s*/g, " ");
                for (const m of list.matchAll(/(?:^|\s)([1-4])\s*[.)۔-]\s*(.*?)(?=\s+[1-4]\s*[.)۔-]|$)/g)) {
                    const name = m[2].replace(/_+/g, "").replace(/^[:\s]+/, "").trim();
                    if (name) cells[`attendee${m[1]}`] = singleLine([{ runs: [{ t: name }] }]);
                }
            }
            continue;
        }
        if (/جمع کرانے کی تاریخ|تقسیم کرنے کی تاریخ/.test(rowText)) {
            if (/جمع کرانے کی تاریخ/.test(rowText)) cells.submitDate = singleLine(beforeLabel(afterLabel(all, /جمع کرانے کی تاریخ\s*:?/), /حتمی\s*سبق|تقسیم کرنے/));
            if (/تقسیم کرنے کی تاریخ/.test(rowText)) cells.distributeDate = singleLine(afterLabel(all, /تقسیم کرنے کی تاریخ\s*:?/));
            continue;
        }
        if (/دستخط/.test(rowText) && !columnMap) continue;
        if (/brought forward|review of previous/i.test(rowText)) { cells.broughtForward = afterLabel(all, /(brought forward \(if any\)|brought forward|completion plan, if any\))\s*:?/i); continue; }
        // A heading row: most cells name a known column.
        const keys = row.map((c) => columnKey(textOf(c.paragraphs)));
        if (keys.filter(Boolean).length >= 3 && row.every((c) => textOf(c.paragraphs).length < 60)) {
            columnMap = [];
            row.forEach((c, i) => { for (let s = 0; s < c.span; s++) columnMap.push(s === 0 ? keys[i] : null); });
            // In the older format the first column is the step number and the topic column is not "period".
            continue;
        }
        if (/requiring extra assistance/i.test(rowText)) { cells.extraHelp = afterLabel(all, /extra assistance\s*:?/i); continue; }
        if (/teacher responsible/i.test(rowText)) {
            cells.teacher = singleLine(beforeLabel(afterLabel(all, /lesson plan\s*:?/i), /attendees/i));
            const attendees = textOf(afterLabel(all, /attendees of coordination meeting\s*:?/i));
            // "1. Section Head  2. Mr. Haris  3. Ms. Ammara  4." — each name goes to its own number.
            // Word's automatic numbering is not part of the text: a name before the first typed number is attendee 1.
            const lead = attendees.slice(0, Math.max(0, attendees.search(/(?:^|\s)[1-4]\s*[.)]/))).replace(/_+/g, "").trim();
            if (lead) cells.attendee1 = singleLine([{ runs: [{ t: lead }] }]);
            for (const m of attendees.matchAll(/(?:^|\s)([1-4])\s*[.)]\s*(.*?)(?=\s+[1-4]\s*[.)]|$)/g)) {
                const name = m[2].replace(/_+/g, "").trim();
                if (name) cells[`attendee${m[1]}`] = singleLine([{ runs: [{ t: name }] }]);
            }
            continue;
        }
        if (/date of submission/i.test(rowText) || /date of distribution/i.test(rowText)) {
            const sub = afterLabel(all, /sec(?:tion)? head\s*:?/i);
            if (/date of submission/i.test(rowText)) cells.submitDate = singleLine(beforeLabel(sub, /date of distribution/i));
            if (/date of distribution/i.test(rowText)) cells.distributeDate = singleLine(afterLabel(all, /to the teachers\s*:?/i));
            continue;
        }
        if (columnMap) {
            // Expand merged cells so positions line up with the heading.
            const positioned = [];
            row.forEach((c) => { positioned.push(c); for (let s = 1; s < c.span; s++) positioned.push(null); });
            const first = textOf(positioned[0]?.paragraphs || []);
            let day = DAY_NAMES.find(([, pattern]) => pattern.test(first))?.[0];
            const filled = positioned.filter((c, i) => c && columnMap[i] && textOf(c.paragraphs)).length;
            if (!day) {
                if (filled < 2) { if (rowText.trim()) notes.push(rowText.slice(0, 200)); continue; }
                if (nextDay >= DAYS.length) { notes.push(`Extra row not imported: ${rowText.slice(0, 120)}`); continue; }
                day = DAYS[nextDay][0];
            }
            nextDay = DAYS.findIndex(([key]) => key === day) + 1;
            positioned.forEach((c, i) => {
                const key = columnMap[i];
                if (!c || !key) return;
                if (key === "period") { const rest = afterLabel(c.paragraphs, dayPattern(day)); cells[`${day}.period`] = rest.length ? rest : DAY_NAMES.some(([, p]) => p.test(textOf(c.paragraphs))) ? [] : c.paragraphs; }
                else cells[`${day}.${key}`] = (cells[`${day}.${key}`] || []).concat(c.paragraphs);
            });
            continue;
        }
        notes.push(rowText.slice(0, 200));
    }
    // A sentence about assessment in the older format has no box of its own; keep it under extra assistance.
    const assessment = notes.find((n) => /assess/i.test(n));
    if (assessment && !cells.extraHelp) cells.extraHelp = [{ list: "", align: "left", runs: [{ t: assessment.replace(/\s*\|\s*/g, " ").trim() }] }];

    // The lines above the table: Week, Class, Sections.
    const top = before.replace(/\s+/g, " ");
    const week = /week\s*:\s*([^:]*?)(?=\s+class\s*:|$)/i.exec(top)?.[1]?.trim();
    const className = /class\s*:\s*([^:]*?)(?=\s+no\.? of sections|$)/i.exec(top)?.[1]?.trim();
    const sections = /no\.?\s*of\s*sections\s*:\s*([\w-]+)/i.exec(top)?.[1]?.trim();
    if (week) cells.week = [{ list: "", align: "left", runs: [{ t: week.replace(/_+/g, "").trim() }] }];
    if (className) cells.className = [{ list: "", align: "left", runs: [{ t: className.replace(/_+/g, "").trim() }] }];
    if (sections) cells.sections = [{ list: "", align: "left", runs: [{ t: sections.replace(/_+/g, "").trim() }] }];
    let weekNumber = Number(/(\d{1,2})/.exec(week || "")?.[1]) || null;
    // Urdu forms: Week / Class / Sections sit in a small table of their own, one per cell (joined with "¦").
    if (/[\u0600-\u06FF]/.test(before)) {
        weekNumber = null;
        // A single line "ہفتہ: … جماعت: … سیکشنز کی تعداد: …" (as this app writes it) is split at its labels.
        const parts = (before.includes("¦") ? before : before.replace(/(جماعت\s*:|سیکشنز کی تعداد\s*:)/g, "¦$1")).split("¦");
        for (const part of parts.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean)) {
            if (/جماعت\s*:/.test(part)) { const v = part.replace(/^.*?جماعت\s*:\s*/, "").replace(/_+/g, "").trim(); if (v) cells.className = [{ list: "", align: "left", runs: [{ t: v }] }]; continue; }
            if (/سیکشن/.test(part)) { const v = URDU_DIGITS(part).match(/\d+/)?.[0]; if (v) cells.sections = [{ list: "", align: "left", runs: [{ t: v }] }]; continue; }
            if (/ہفتہ\s*:|تا|نومبر|دسمبر|جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|پہلا|دوسرا|تیسرا|چوتھا/.test(part)) {
                const v = part.replace(/^.*?ہفتہ\s*:\s*/, "").replace(/_+/g, "").trim();
                if (v) cells.week = [{ list: "", align: "left", runs: [{ t: v }] }];
                const ordinal = URDU_ORDINALS.findIndex((w) => new RegExp(`(^|\\s|:)${w}(\\s|:|$)`).test(part));
                if (ordinal >= 0) weekNumber = ordinal + 1;
                else { const n = /ہفتہ\s*(?:نمبر)?\s*:?\s*(\d{1,2})(?!\s*(?:نومبر|دسمبر|جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر))/.exec(URDU_DIGITS(part)); if (n) weekNumber = Number(n[1]); }
            }
        }
    }
    const clean = {};
    for (const [key, value] of Object.entries(cells)) clean[key] = normalise(value);
    return { cells: clean, week: weekNumber, notes: notes.filter((n) => !/assess/i.test(n)).slice(0, 10) };
}

// The body's top-level paragraphs and tables, in document order.
function topLevel(body) {
    const out = [];
    const tag = /<w:tbl>|<\/w:tbl>|<w:p(?=[\s>\/])[^>]*\/>|<w:p(?=[\s>])[^>]*>|<\/w:p>/g;
    let tableDepth = 0, start = -1, inParagraph = false, m;
    while ((m = tag.exec(body))) {
        const t = m[0];
        if (t === "<w:tbl>") { if (tableDepth === 0) start = m.index; tableDepth++; continue; }
        if (t === "</w:tbl>") { tableDepth--; if (tableDepth === 0) out.push(body.slice(start, m.index + t.length)); continue; }
        if (tableDepth) continue;
        if (t.endsWith("/>")) continue;
        if (t === "</w:p>") { if (inParagraph) { out.push(body.slice(start, m.index + t.length)); inParagraph = false; } continue; }
        start = m.index; inParagraph = true;
    }
    return out;
}

async function readCoordinationDocx(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length > MAX_BYTES) throw Object.assign(new Error("Upload a Word file (.docx) under 10 MB."), { status: 400 });
    let zip;
    try { zip = await JSZip.loadAsync(buffer); } catch { throw Object.assign(new Error("This is not a Word (.docx) file. In Word, use File › Save As › Word Document (.docx)."), { status: 400 }); }
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) throw Object.assign(new Error("This Word file has no document content."), { status: 400 });
    const lists = listKinds(await zip.file("word/numbering.xml")?.async("string"));
    const body = /<w:body>([\s\S]*)<\/w:body>/.exec(documentXml)?.[1] || "";
    const weeks = [];
    let textBefore = "";
    // Walk the body in order: paragraphs before a table hold the Week/Class line; after it, the sign line.
    for (const element of topLevel(body)) {
        if (element.startsWith("<w:tbl")) {
            const text = textOf(cellParagraphs(element, lists));
            if (!/monday|methodolog|sub[\s-]*topic|period wise|ذیلی\s*موضوعات|طریقہ\s*ہائے\s*تدریس/i.test(text)) {
                // A small table above the record (the Urdu form's Week / Class / Sections line): keep its cells.
                const cellsText = children(element, "w:tr").flatMap((tr) => children(tr, "w:tc").map((tc) => textOf(cellParagraphs(tc, lists))));
                if (cellsText.join("").trim() && cellsText.length <= 6) textBefore = ` ${cellsText.join(" ¦ ")} ¦`; // the title above it is not part of the week
                continue;
            }
            weeks.push(parseTable(element, lists, textBefore));
            textBefore = "";
            continue;
        }
        const text = textOf(paragraphOf(element, lists));
        const coordinator = /subject coordinator\s*:?\s*(.*?)(?=\s*(?:section head|sh sign)|$)/i.exec(text)?.[1]?.replace(/_+/g, "").trim();
        const head = /(?:section head|sh sign)\s*:?\s*(.*)$/i.exec(text)?.[1]?.replace(/_+/g, "").trim();
        if ((coordinator || head) && weeks.length && !/week\s*:/i.test(text)) {
            const target = weeks[weeks.length - 1].cells;
            if (coordinator) target.coordinatorName = normalise([{ runs: [{ t: coordinator }] }]);
            if (head) target.sectionHeadName = normalise([{ runs: [{ t: head }] }]);
            continue;
        }
        textBefore += ` ${text}`;
    }
    if (!weeks.length) throw Object.assign(new Error("No coordination record table was found in this Word file. Use the weekly record format."), { status: 400 });
    return weeks;
}

module.exports = { readCoordinationDocx };
