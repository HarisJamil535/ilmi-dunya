const { fail } = require('./publishing');
function imageExtension(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) fail('The image file is invalid.');
    if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
    if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return '.jpg';
    if (buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return '.webp';
    fail('Upload a JPG, PNG or WebP image. SVG, HTML and other file types are not accepted.');
}
module.exports = { imageExtension };
