const { PNG } = require("pngjs");
const jpeg = require("jpeg-js");

// Turns an uploaded image into a pale PNG for printing behind the paper, so the PDF and the Word file
// show the same soft watermark (Word cannot fade an image by itself).
const STRENGTH = { light: 0.1, medium: 0.16, strong: 0.24 };
const MAX_SIDE = 900;
const cache = new Map();

function decode(buffer) {
    if (buffer.subarray(0, 4).toString("binary") === "\x89PNG") {
        const png = PNG.sync.read(buffer);
        return { width: png.width, height: png.height, data: png.data };
    }
    return jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 256, formatAsRGBA: true });
}

function fadeImage(buffer, strength = "light") {
    const key = `${buffer.length}:${buffer.subarray(0, 64).toString("base64")}:${strength}`;
    if (cache.has(key)) return cache.get(key);
    const source = decode(buffer);
    const step = Math.max(1, Math.ceil(Math.max(source.width, source.height) / MAX_SIDE));
    const width = Math.floor(source.width / step);
    const height = Math.floor(source.height / step);
    const out = new PNG({ width, height });
    const keep = STRENGTH[strength] || STRENGTH.light;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const from = ((y * step) * source.width + x * step) * 4;
            const to = (y * width + x) * 4;
            // Grey, pale and partly see-through: dark parts of the logo become a soft grey.
            const grey = 0.299 * source.data[from] + 0.587 * source.data[from + 1] + 0.114 * source.data[from + 2];
            const shade = Math.round(255 - (255 - grey) * Math.min(1, keep * 4));
            out.data[to] = out.data[to + 1] = out.data[to + 2] = shade;
            out.data[to + 3] = Math.round(source.data[from + 3] * Math.min(1, keep * 3.5));
        }
    }
    const result = PNG.sync.write(out);
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
}

module.exports = { fadeImage, STRENGTH };
