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

module.exports = { storeImage, serveImage, mediaPath };
