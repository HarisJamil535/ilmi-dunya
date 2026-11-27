const mongoose = require("mongoose");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { imageExtension } = require("./imageUpload");

// Uploaded images live in MongoDB GridFS so they survive redeploys and are covered by database backups.
const bucketName = "siteImages";
const contentTypes = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const mediaPath = /^\/api\/media\/images\/[a-f\d]{24}$/;
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });

async function storeImage(buffer, purpose) {
    const extension = imageExtension(buffer);
    const stream = bucket().openUploadStream(`${purpose}-${new mongoose.Types.ObjectId()}${extension}`, { metadata: { contentType: contentTypes[extension], purpose } });
    await pipeline(Readable.from([buffer]), stream);
    return `/api/media/images/${stream.id}`;
}

async function serveImage(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
        const files = bucket();
        const file = await files.find({ _id: new mongoose.Types.ObjectId(req.params.id) }).next();
        if (!file) return res.sendStatus(404);
        res.type(file.metadata?.contentType || "application/octet-stream")
            .set("Cache-Control", "public, max-age=31536000, immutable")
            .set("Content-Length", String(file.length))
            .removeHeader("X-Robots-Tag");
        files.openDownloadStream(file._id).on("error", next).pipe(res);
    } catch (error) { next(error); }
}

// An uploaded image's bytes, for printing it on documents.
async function readImage(path) {
    const id = /^\/api\/media\/images\/([a-f\d]{24})$/.exec(path || "")?.[1];
    if (!id) return null;
    const chunks = [];
    for await (const chunk of bucket().openDownloadStream(new mongoose.Types.ObjectId(id))) chunks.push(chunk);
    return Buffer.concat(chunks);
}

// A stored signature in a given ink (see signatureImage.js), for the record on screen and the verify page.
async function serveSignature(req, res, next) {
    try {
        const [ink, weight = "normal"] = String(req.params.ink).split("-");
        if (!mongoose.isValidObjectId(req.params.id) || !["blue", "pink", "navy"].includes(ink) || !["thin", "normal", "bold", "heavy"].includes(weight)) return res.sendStatus(404);
        const file = await bucket().find({ _id: new mongoose.Types.ObjectId(req.params.id) }).next();
        if (!file || file.metadata?.purpose !== "signature") return res.sendStatus(404);
        const { tintSignature } = require("./signatureImage");
        const png = tintSignature(await readImage(`/api/media/images/${req.params.id}`), ink, weight);
        res.type("png").set("Cache-Control", "public, max-age=31536000, immutable").removeHeader("X-Robots-Tag");
        res.send(png);
    } catch (error) { next(error); }
}

module.exports = { storeImage, serveImage, serveSignature, readImage, mediaPath };
