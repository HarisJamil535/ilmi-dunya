const { fail } = require("./publishing");
const { mediaPath } = require("./mediaStore");

// Formatted content for PBA questions: a list of blocks (text, code, image, picture row, table, labelling) and the parts of a question.
// The same shapes feed the admin editor, the student page and the PDF and Word papers.
const LIMITS = { blocks: 24, parts: 12, text: 4000, code: 6000, rows: 14, cols: 6, cell: 200, labelItems: 10, gallery: 4, caption: 120 };
const LANGUAGES = ["javascript", "html", "css", "python", "text"];
const SIZES = ["small", "medium", "large"];

const str = (value, max, label) => {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") fail(`${label} must be text.`);
    if (value.length > max) fail(`${label} must be ${max} characters or fewer.`);
    return value;
};
const line = (value, max, label) => str(value, max, label).replace(/\s+/g, " ").trim();
const image = (value, label) => {
    if (!value) return "";
    if (typeof value !== "string" || !mediaPath.test(value)) fail(`${label} must be an image uploaded here.`);
    return value;
};

function cleanBlock(block, label) {
    if (!block || typeof block !== "object") fail(`${label} is not valid.`);
    switch (block.type) {
        case "text": {
            const text = str(block.text, LIMITS.text, label).replace(/\r/g, "").replace(/[ \t]+$/gm, "").trim();
            return text ? { type: "text", text } : null;
        }
        case "code": {
            const code = str(block.code, LIMITS.code, label).replace(/\r/g, "").replace(/\s+$/, "");
            if (!code.trim()) return null;
            return { type: "code", language: LANGUAGES.includes(block.language) ? block.language : "text", code, caption: line(block.caption, LIMITS.caption, `${label} caption`) };
        }
        case "image": {
            const url = image(block.url, label);
            return url ? { type: "image", url, caption: line(block.caption, LIMITS.caption, `${label} caption`), alt: line(block.alt, 160, `${label} description`), size: SIZES.includes(block.size) ? block.size : "medium" } : null;
        }
        case "gallery": {
            // One to four pictures side by side in a single row.
            const images = (Array.isArray(block.images) ? block.images : []).slice(0, LIMITS.gallery).map((item, i) => ({ url: image(item?.url, `${label} picture ${i + 1}`), caption: line(item?.caption, LIMITS.caption, `${label} caption`) })).filter(item => item.url);
            return images.length ? { type: "gallery", images, size: SIZES.includes(block.size) ? block.size : "medium" } : null;
        }
        case "table": {
            const rows = (Array.isArray(block.rows) ? block.rows : []).slice(0, LIMITS.rows).map(row => (Array.isArray(row) ? row : []).slice(0, LIMITS.cols).map(cell => line(cell, LIMITS.cell, `${label} cell`)));
            if (!rows.length) return null;
            const width = Math.max(...rows.map(row => row.length));
            if (!width) return null;
            return { type: "table", header: block.header !== false, rows: rows.map(row => Array.from({ length: width }, (_, i) => row[i] || "")) };
        }
        case "labelling": {
            const items = (Array.isArray(block.items) ? block.items : []).slice(0, LIMITS.labelItems).map((item, i) => ({ image: image(item?.image, `${label} picture ${i + 1}`), name: line(item?.name, 120, `${label} name`), purpose: line(item?.purpose, 240, `${label} purpose`) }));
            if (!items.length) return null;
            const columns = Array.from({ length: 3 }, (_, i) => line(block.columns?.[i], 30, `${label} column`) || ["Item", "Name", "Purpose"][i]);
            return { type: "labelling", columns, items };
        }
        default: return fail(`${label} has an unknown content type.`);
    }
}

function cleanBlocks(list, label = "Content") {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) fail(`${label} must be a list.`);
    if (list.length > LIMITS.blocks) fail(`${label} can have up to ${LIMITS.blocks} items.`);
    return list.map((block, i) => cleanBlock(block, `${label} item ${i + 1}`)).filter(Boolean);
}

const marksOf = (value, label) => {
    const number = Number(value ?? 0);
    if (!(number >= 0) || number > 100 || Math.round(number * 2) !== number * 2) fail(`${label} marks must be a number such as 1, 2 or 0.5.`);
    return number;
};

function cleanParts(list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) fail("Parts must be a list.");
    if (list.length > LIMITS.parts) fail(`A question can have up to ${LIMITS.parts} parts.`);
    return list.map((part, i) => {
        const name = `Part ${i + 1}`;
        const mode = ["none", "lines", "box"].includes(part?.space?.mode) ? part.space.mode : "none";
        return {
            marks: marksOf(part?.marks, name),
            blocks: cleanBlocks(part?.blocks, name),
            space: { mode, size: Math.min(Math.max(Math.floor(Number(part?.space?.size) || 0), 0), 30) },
            answer: cleanBlocks(part?.answer, `${name} answer`),
        };
    });
}

// The marks of a question: the sum of its parts, or the number the admin typed when it has no parts.
const totalOf = (parts, typed) => (parts.length ? parts.reduce((sum, part) => sum + part.marks, 0) : marksOf(typed, "Total"));

// ---- the small markup used inside text blocks ------------------------------------------------------------------
// **bold**, *italic*, __underline__, "- " bullets and "1. " numbered lines. Everything else is plain text.
function inline(text, style = {}) {
    const runs = [];
    const pattern = /(\*\*(?:[^*]|\*(?!\*))+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g;
    let last = 0;
    for (const match of text.matchAll(pattern)) {
        if (match.index > last) runs.push({ text: text.slice(last, match.index), ...style });
        const token = match[0];
        if (token.startsWith("**")) runs.push(...inline(token.slice(2, -2), { ...style, bold: true }));
        else if (token.startsWith("__")) runs.push(...inline(token.slice(2, -2), { ...style, underline: true }));
        else runs.push(...inline(token.slice(1, -1), { ...style, italic: true }));
        last = match.index + token.length;
    }
    if (last < text.length) runs.push({ text: text.slice(last), ...style });
    return runs.filter(run => run.text);
}

function paragraphs(text) {
    const out = [];
    let list = null;
    for (const raw of String(text || "").split("\n")) {
        const bullet = /^\s*-\s+(.*)$/.exec(raw);
        const number = /^\s*(\d+)[.)]\s+(.*)$/.exec(raw);
        if (bullet || number) {
            const kind = bullet ? "ul" : "ol";
            if (!list || list.type !== kind) { list = { type: kind, items: [] }; out.push(list); }
            list.items.push({ runs: inline((bullet || number)[bullet ? 1 : 2]), number: number ? Number(number[1]) : undefined });
        } else if (raw.trim()) { list = null; out.push({ type: "p", runs: inline(raw.trim()) }); }
        else list = null;
    }
    return out;
}

const plain = text => paragraphs(text).map(item => (item.type === "p" ? item.runs.map(run => run.text).join("") : item.items.map(entry => entry.runs.map(run => run.text).join("")).join("; "))).join(" ");

module.exports = { LIMITS, LANGUAGES, cleanBlocks, cleanParts, totalOf, marksOf, inline, paragraphs, plain };
