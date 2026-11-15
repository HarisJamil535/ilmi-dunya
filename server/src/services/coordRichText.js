// Rich text for coordination cells.
// The editor sends HTML from a contenteditable cell. It is never stored as HTML: it is read into a small,
// fixed structure (paragraphs of styled runs) and everything else is dropped. That structure is the single
// source for the editor, the Word file and the PDF, so all three show the same formatting and no script
// or foreign markup can be saved.
//
// paragraph: { list: "" | "ul" | "ol", align: "left" | "center" | "right", runs: [run] }
// run:       { t: text, b, i, u, s: booleans, c: "#rrggbb" text colour, h: "#rrggbb" highlight, z: "s" | "m" | "l" size,
//              f: font key (see coordFonts; empty = the page font) }

const { KEYS: FONT_KEYS, fontFromName } = require("./coordFonts");

const MAX_TEXT = 4000;
const MAX_PARAGRAPHS = 80;
const COLOURS = new Set(["#000000", "#1f2937", "#dc2626", "#c2410c", "#a16207", "#15803d", "#0369a1", "#1d4ed8", "#6d28d9", "#be185d"]);
const HIGHLIGHTS = new Set(["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"]);
const NAMED = { black: "#000000", red: "#dc2626", green: "#15803d", blue: "#1d4ed8", purple: "#6d28d9", orange: "#c2410c" };

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const decode = (text) => text.replace(/&(#x?[0-9a-f]+|[a-z]+[0-9]*);/gi, (all, code) => {
    if (code[0] === "#") {
        const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return entities[code.toLowerCase()] ?? all;
});
const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function hexOf(value) {
    if (!value) return "";
    const v = String(value).trim().toLowerCase();
    if (NAMED[v]) return NAMED[v];
    let m = /^#([0-9a-f]{6})$/.exec(v);
    if (m) return `#${m[1]}`;
    m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
    if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
    if (m) return `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
    return "";
}
// Colours snap to the editor's palette so documents stay consistent and readable.
function nearest(hex, set) {
    if (!hex) return "";
    if (set.has(hex)) return hex;
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r, g, b] = rgb(hex);
    let best = "", score = Infinity;
    for (const option of set) { const [x, y, z] = rgb(option); const d = (r - x) ** 2 + (g - y) ** 2 + (b - z) ** 2; if (d < score) { score = d; best = option; } }
    return best;
}

function styleFrom(attrs) {
    const out = {};
    const style = /style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/i.exec(attrs);
    const css = decode(style ? style[1] ?? style[2] : "");
    for (const part of css.split(";")) {
        const [rawKey, ...rest] = part.split(":");
        const key = (rawKey || "").trim().toLowerCase();
        const value = rest.join(":").trim().toLowerCase();
        if (!key) continue;
        if (key === "font-weight") out.b = value === "bold" || Number(value) >= 600;
        if (key === "font-style") out.i = value === "italic";
        if (key === "text-decoration" || key === "text-decoration-line") { if (value.includes("underline")) out.u = true; if (value.includes("line-through")) out.s = true; }
        if (key === "color") out.c = nearest(hexOf(value), COLOURS);
        if (key === "background-color" || key === "background") { const h = nearest(hexOf(value), HIGHLIGHTS); if (h && hexOf(value) !== "#ffffff") out.h = h; }
        if (key === "font-size") { const px = parseFloat(value); if (/small/.test(value) || px < 12) out.z = "s"; else if (/large/.test(value) || px > 15) out.z = "l"; }
        if (key === "text-align" && ["center", "right", "left"].includes(value)) out.align = value;
        if (key === "font-family") { const f = fontFromName(value); if (f) out.f = f; }
    }
    const colour = /\bcolor\s*=\s*"?([#\w]+)"?/i.exec(attrs);
    if (colour) out.c = nearest(hexOf(colour[1]), COLOURS);
    const size = /\bsize\s*=\s*"?(\d)"?/i.exec(attrs);
    if (size) out.z = Number(size[1]) <= 2 ? "s" : Number(size[1]) >= 4 ? "l" : "m";
    const face = /\bface\s*=\s*"([^"]*)"/i.exec(attrs);
    if (face) { const f = fontFromName(face[1]); if (f) out.f = f; }
    const cls = /class\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] || "";
    const ff = /\bff-([a-z]+)\b/.exec(cls);
    if (ff && FONT_KEYS.includes(ff[1])) out.f = ff[1];
    if (/\bfs-s\b/.test(cls)) out.z = "s";
    if (/\bfs-l\b/.test(cls)) out.z = "l";
    const align = /\balign\s*=\s*"?(left|center|right)"?/i.exec(attrs);
    if (align) out.align = align[1].toLowerCase();
    return out;
}

const tagStyle = { b: { b: true }, strong: { b: true }, i: { i: true }, em: { i: true }, u: { u: true }, ins: { u: true }, s: { s: true }, strike: { s: true }, del: { s: true }, mark: { h: "#fef08a" } };
const BLOCK = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "section", "article", "td", "th", "tr"]);
const SKIP = new Set(["script", "style", "head", "title", "template", "iframe", "object", "svg", "math", "noscript", "xml"]);

function cleanRun(run) {
    const out = { t: run.t };
    for (const key of ["b", "i", "u", "s"]) if (run[key]) out[key] = true;
    if (run.c && run.c !== "#000000") out.c = run.c;
    if (run.h) out.h = run.h;
    if (run.z && run.z !== "m") out.z = run.z;
    if (run.f && FONT_KEYS.includes(run.f)) out.f = run.f;
    return out;
}
const sameStyle = (a, b) => ["b", "i", "u", "s", "c", "h", "z", "f"].every((k) => (a[k] || "") === (b[k] || ""));

function finishParagraph(p) {
    const runs = [];
    for (const run of p.runs) {
        if (!run.t) continue;
        const last = runs[runs.length - 1];
        if (last && sameStyle(last, run)) last.t += run.t; else runs.push(cleanRun(run));
    }
    // Trim spaces at the ends of the paragraph and collapse runs of spaces.
    for (const run of runs) run.t = run.t.replace(/[ \t\r\n ]+/g, " ");
    if (runs.length) { runs[0].t = runs[0].t.replace(/^ +/, ""); runs[runs.length - 1].t = runs[runs.length - 1].t.replace(/ +$/, ""); }
    return { list: p.list || "", align: p.align || "left", runs: runs.filter((r) => r.t) };
}

// Turns editor HTML into the stored structure.
function fromHtml(html) {
    const source = String(html ?? "").slice(0, 60000);
    const paragraphs = [];
    const styles = [{}];
    const lists = [];
    let current = null;
    let skip = 0;
    const blockAlign = [];
    const open = () => {
        if (!current) current = { list: lists[lists.length - 1] || "", align: blockAlign[blockAlign.length - 1] || "left", runs: [] };
        return current;
    };
    const close = (keepEmpty = false) => {
        if (!current) { if (keepEmpty) paragraphs.push({ list: lists[lists.length - 1] || "", align: "left", runs: [] }); return; }
        paragraphs.push(finishParagraph(current));
        current = null;
    };
    const pattern = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
    let m;
    while ((m = pattern.exec(source))) {
        if (m[0].startsWith("<!--")) continue;
        if (m[3] !== undefined) {
            if (skip) continue;
            const text = decode(m[3]);
            if (!text) continue;
            const style = Object.assign({}, ...styles);
            open().runs.push({ ...style, t: text });
            continue;
        }
        const tag = m[1].toLowerCase();
        const closing = m[0][1] === "/";
        const attrs = m[2] || "";
        if (SKIP.has(tag)) { if (!/\/>$/.test(m[0])) skip += closing ? -1 : 1; skip = Math.max(0, skip); continue; }
        if (skip) continue;
        if (tag === "br") { if (current) close(); else close(true); continue; }
        if (tag === "ul" || tag === "ol") { close(); if (closing) lists.pop(); else lists.push(tag); continue; }
        if (BLOCK.has(tag)) {
            close();
            if (closing) { blockAlign.pop(); continue; }
            const style = styleFrom(attrs);
            blockAlign.push(style.align || blockAlign[blockAlign.length - 1] || "left");
            if (tag === "li") open();
            continue;
        }
        if (closing) { if (styles.length > 1) styles.pop(); continue; }
        if (/\/>$/.test(m[0])) continue;
        const style = { ...(tagStyle[tag] || {}), ...styleFrom(attrs) };
        delete style.align;
        styles.push(style);
    }
    close();
    // Drop empty paragraphs at the start and end; keep one empty line between paragraphs at most.
    const out = [];
    for (const p of paragraphs) {
        const empty = !p.runs.length;
        if (empty && (!out.length || !out[out.length - 1].runs.length)) continue;
        out.push(p);
    }
    while (out.length && !out[out.length - 1].runs.length) out.pop();
    let total = 0;
    const limited = [];
    for (const p of out.slice(0, MAX_PARAGRAPHS)) {
        const runs = [];
        for (const run of p.runs) { if (total >= MAX_TEXT) break; const t = run.t.slice(0, MAX_TEXT - total); total += t.length; runs.push({ ...run, t }); }
        limited.push({ ...p, runs });
        if (total >= MAX_TEXT) break;
    }
    return limited;
}

// Checks a stored or imported structure (for example from a Word file) and returns a clean copy.
function normalise(paragraphs) {
    if (!Array.isArray(paragraphs)) return [];
    const html = toHtml(paragraphs.map((p) => ({ list: ["ul", "ol"].includes(p?.list) ? p.list : "", align: ["center", "right"].includes(p?.align) ? p.align : "left", runs: Array.isArray(p?.runs) ? p.runs.filter((r) => typeof r?.t === "string").map((r) => ({ ...r, c: COLOURS.has(r.c) ? r.c : undefined, h: HIGHLIGHTS.has(r.h) ? r.h : undefined })) : [] })));
    return fromHtml(html);
}

function runHtml(run) {
    let html = escape(run.t);
    const css = [];
    if (run.c) css.push(`color:${run.c}`);
    if (run.h) css.push(`background-color:${run.h}`);
    const classes = [run.z ? `fs-${run.z}` : "", run.f ? `ff-${run.f}` : ""].filter(Boolean).join(" ");
    if (css.length || classes) html = `<span${classes ? ` class="${classes}"` : ""}${css.length ? ` style="${css.join(";")}"` : ""}>${html}</span>`;
    if (run.s) html = `<s>${html}</s>`;
    if (run.u) html = `<u>${html}</u>`;
    if (run.i) html = `<i>${html}</i>`;
    if (run.b) html = `<b>${html}</b>`;
    return html;
}

// Turns the stored structure back into HTML for the editor.
function toHtml(paragraphs) {
    let html = "";
    let list = "";
    for (const p of paragraphs || []) {
        if (p.list !== list) { if (list) html += `</${list}>`; if (p.list) html += `<${p.list}>`; list = p.list; }
        const inner = (p.runs || []).map(runHtml).join("") || "<br>";
        const align = p.align && p.align !== "left" ? ` style="text-align:${p.align}"` : "";
        html += p.list ? `<li${align}>${inner}</li>` : `<div${align}>${inner}</div>`;
    }
    if (list) html += `</${list}>`;
    return html;
}

const plainText = (paragraphs) => (paragraphs || []).map((p) => (p.runs || []).map((r) => r.t).join("")).join("\n").trim();
const fromText = (text) => String(text ?? "").split(/\r?\n/).map((line) => ({ list: "", align: "left", runs: line ? [{ t: line }] : [] })).filter((p, i, all) => p.runs.length || (i > 0 && i < all.length - 1));

module.exports = { fromHtml, toHtml, normalise, plainText, fromText, COLOURS: [...COLOURS], HIGHLIGHTS: [...HIGHLIGHTS] };
