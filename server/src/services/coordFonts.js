const path = require("node:path");

// Fonts for coordination records. Each has the name Word uses (so the .docx opens in that font) and free,
// metric-compatible font files for the PDF and the on-screen editor, so line breaks match everywhere.
const DIR = path.join(__dirname, "../../assets/fonts");
const FONTS = {
    arial: { label: "Arial", word: "Arial", files: { r: "LiberationSans-Regular.ttf", b: "LiberationSans-Bold.ttf", i: "LiberationSans-Italic.ttf", bi: "LiberationSans-BoldItalic.ttf" } },
    times: { label: "Times New Roman", word: "Times New Roman", files: { r: "LiberationSerif-Regular.ttf", b: "LiberationSerif-Bold.ttf", i: "LiberationSerif-Italic.ttf", bi: "LiberationSerif-BoldItalic.ttf" } },
    calibri: { label: "Calibri", word: "Calibri", files: { r: "Carlito-Regular.ttf", b: "Carlito-Bold.ttf", i: "Carlito-Italic.ttf" } },
    cambria: { label: "Cambria", word: "Cambria", files: { r: "Caladea-Regular.ttf", b: "Caladea-Bold.ttf", i: "Caladea-Italic.ttf" } },
    garamond: { label: "Garamond", word: "Garamond", files: { r: "EBGaramond-Regular.ttf", b: "EBGaramond-Bold.ttf", i: "EBGaramond-Italic.ttf" } },
    poppins: { label: "Poppins", word: "Poppins", files: { r: "Poppins-Regular.ttf", b: "Poppins-Bold.ttf", i: "Poppins-Italic.ttf" } },
    courier: { label: "Courier New", word: "Courier New", files: { r: "LiberationMono-Regular.ttf", b: "LiberationMono-Bold.ttf", i: "LiberationMono-Italic.ttf", bi: "LiberationMono-BoldItalic.ttf" } },
};
const KEYS = Object.keys(FONTS);
const fontKey = (value) => (KEYS.includes(value) ? value : "arial");

// Reads a font choice from editor HTML (font-family / <font face>), e.g. "Coord Garamond" or "Times New Roman".
function fontFromName(name) {
    const v = String(name || "").toLowerCase();
    if (/garamond/.test(v)) return "garamond";
    if (/times|serif(?!.*sans)/.test(v) && !/sans/.test(v)) return "times";
    if (/calibri|carlito/.test(v)) return "calibri";
    if (/cambria|caladea/.test(v)) return "cambria";
    if (/poppins/.test(v)) return "poppins";
    if (/courier|mono/.test(v)) return "courier";
    if (/arial|helvetica|liberation sans|sans/.test(v)) return "arial";
    return "";
}

// The font files are read from disk once and kept in memory (each PDF used to read all 28 again).
const fs = require("node:fs");
const fontData = new Map();
const fontBuffer = (file) => { if (!fontData.has(file)) fontData.set(file, fs.readFileSync(path.join(DIR, file))); return fontData.get(file); };

// Registers every font with a PDF document as "<key>-<style>" (missing bold-italic falls back to bold).
function registerPdfFonts(doc) {
    for (const [key, font] of Object.entries(FONTS)) {
        for (const style of ["r", "b", "i", "bi"]) doc.registerFont(`${key}-${style}`, fontBuffer(font.files[style] || font.files[style === "bi" ? "b" : "r"]));
    }
}

module.exports = { FONTS, KEYS, fontKey, fontFromName, registerPdfFonts };
