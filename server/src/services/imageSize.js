// Width and height of a PNG or JPEG, read from its header, so pictures can be placed at the right proportions.
function imageSize(buffer) {
    if (!buffer || buffer.length < 24) return null;
    if (buffer.subarray(0, 4).toString("binary") === "\x89PNG") return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), type: "png" };
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < buffer.length) {
            if (buffer[offset] !== 0xff) { offset += 1; continue; }
            const marker = buffer[offset + 1];
            if (marker === 0xff) { offset += 1; continue; }
            if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), type: "jpg" };
            offset += 2 + buffer.readUInt16BE(offset + 2);
        }
    }
    return null;
}
module.exports = { imageSize };
