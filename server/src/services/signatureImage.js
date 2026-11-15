const { PNG } = require("pngjs");
const { decode } = require("./watermark");

// Cleans an uploaded or drawn signature: the paper-white background becomes transparent, the ink becomes
// a clean dark blue-black, and the picture is cropped to the ink and kept small. The result is a PNG that
// sits on the signature line of the Word file and the PDF without a white box around it.
const MAX_W = 700;
const MAX_H = 240;

function cleanSignature(buffer) {
    let source;
    try { source = decode(buffer); } catch { throw Object.assign(new Error("Upload the signature as a PNG or JPG picture."), { status: 400 }); }
    const { width, height, data } = source;
    if (!width || !height || width * height > 25e6) throw Object.assign(new Error("That picture is too large. Use one under 5000 × 5000 pixels."), { status: 400 });
    // Ink is anything clearly darker than the paper. The paper level is read from the brightest pixels.
    let brightest = 0;
    for (let i = 0; i < data.length; i += 4 * 17) brightest = Math.max(brightest, (data[i] + data[i + 1] + data[i + 2]) / 3);
    const paper = Math.max(160, brightest);
    const alpha = new Uint8ClampedArray(width * height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const light = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const ink = Math.max(0, Math.min(1, (paper - 25 - light) / (paper - 25 - 60))) * (data[i + 3] / 255);
        const a = Math.round(ink * 255);
        alpha[y * width + x] = a;
        if (a > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < 0) throw Object.assign(new Error("No signature was found in the picture. Sign with a dark pen on white paper, or draw it."), { status: 400 });
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
    const cropW = maxX - minX + 1, cropH = maxY - minY + 1;
    const k = Math.min(1, MAX_W / cropW, MAX_H / cropH);
    const outW = Math.max(1, Math.round(cropW * k)), outH = Math.max(1, Math.round(cropH * k));
    const out = new PNG({ width: outW, height: outH });
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
        // Box-average the source pixels for a smooth downscale.
        const x0 = minX + Math.floor(x / k), x1 = Math.max(x0 + 1, minX + Math.floor((x + 1) / k));
        const y0 = minY + Math.floor(y / k), y1 = Math.max(y0 + 1, minY + Math.floor((y + 1) / k));
        let sum = 0, n = 0;
        for (let yy = y0; yy < Math.min(y1, height); yy++) for (let xx = x0; xx < Math.min(x1, width); xx++) { sum += alpha[yy * width + xx]; n++; }
        const o = (y * outW + x) * 4;
        out.data[o] = 16; out.data[o + 1] = 24; out.data[o + 2] = 64; // ink colour
        out.data[o + 3] = n ? Math.round(sum / n) : 0;
    }
    return PNG.sync.write(out);
}

module.exports = { cleanSignature };
