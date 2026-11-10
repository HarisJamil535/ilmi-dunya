const https = require("node:https");
const http = require("node:http");
const dns = require("node:dns");
const net = require("node:net");
const { imageExtension } = require("./imageUpload");

// Fetches a picture from a link an admin pasted, so it can be stored like an uploaded file.
// Only public web addresses are allowed: the address is checked after DNS lookup (and again on every
// redirect), so a link cannot reach the server itself or the private network behind it.
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const types = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

function privateAddress(address) {
    if (net.isIPv4(address)) {
        const [a, b] = address.split(".").map(Number);
        return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
    }
    const v6 = address.toLowerCase();
    if (v6.startsWith("::ffff:")) return privateAddress(v6.slice(7));
    return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

function bad(message, status = 400) { return Object.assign(new Error(message), { status }); }

function safeLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(bad("That website could not be found. Check the link."));
        const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family || 4 }];
        if (!list.length || list.some(item => privateAddress(item.address))) return callback(bad("That link points to a private address and cannot be used."));
        if (options.all) return callback(null, list);
        callback(null, list[0].address, list[0].family);
    });
}

function parse(link) {
    let url;
    try { url = new URL(String(link || "").trim()); } catch { throw bad("Paste a full picture link that starts with https://"); }
    if (!["https:", "http:"].includes(url.protocol)) throw bad("Paste a full picture link that starts with https://");
    if (url.username || url.password) throw bad("Links with a user name or password are not accepted.");
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && privateAddress(url.hostname.replace(/^\[|\]$/g, ""))) throw bad("That link points to a private address and cannot be used.");
    return url;
}

function get(url, redirects) {
    return new Promise((resolve, reject) => {
        const client = url.protocol === "https:" ? https : http;
        const request = client.get(url, { lookup: safeLookup, timeout: TIMEOUT_MS, headers: { "User-Agent": "IlmiDunya image import", Accept: "image/*" } }, (response) => {
            const status = response.statusCode || 0;
            if (status >= 300 && status < 400 && response.headers.location) {
                response.resume();
                if (redirects <= 0) return reject(bad("That link redirects too many times."));
                let next;
                try { next = parse(new URL(response.headers.location, url).href); } catch (error) { return reject(error); }
                return resolve(get(next, redirects - 1));
            }
            if (status !== 200) { response.resume(); return reject(bad(`The picture could not be downloaded (the website answered ${status}).`)); }
            if (Number(response.headers["content-length"]) > MAX_BYTES) { response.destroy(); return reject(bad("That picture is larger than 5 MB.")); }
            const chunks = []; let size = 0;
            response.on("data", (chunk) => {
                size += chunk.length;
                if (size > MAX_BYTES) { response.destroy(); reject(bad("That picture is larger than 5 MB.")); } else chunks.push(chunk);
            });
            response.on("end", () => resolve(Buffer.concat(chunks)));
            response.on("error", () => reject(bad("The picture could not be downloaded.")));
        });
        request.on("timeout", () => request.destroy(bad("The website took too long to send the picture.")));
        request.on("error", (error) => reject(error.status ? error : bad("The picture could not be downloaded. Check the link.")));
    });
}

async function fetchRemoteImage(link) {
    const buffer = await get(parse(link), 3);
    const extension = imageExtension(buffer); // throws for anything that is not a JPG, PNG or WebP picture
    return { buffer, extension, contentType: types[extension] };
}

module.exports = { fetchRemoteImage, privateAddress, parse };
