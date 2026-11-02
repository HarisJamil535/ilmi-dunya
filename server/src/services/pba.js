const mongoose = require("mongoose");
const { fail, safeUrl } = require("./publishing");

// Limits keep one subject's PBA page fast and tidy.
const LIMITS = { topics: 60, subtopics: 120, practicals: 500, categories: 30, facts: 8, links: 6 };
const YOUTUBE = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

const clean = (value, max, label, { required = false } = {}) => {
    if (value === undefined || value === null) value = "";
    if (typeof value !== "string") fail(`${label} must be text.`);
    const text = value.replace(/\s+/g, " ").trim();
    if (required && !text) fail(`${label} is required.`);
    if (text.length > max) fail(`${label} must be ${max} characters or fewer.`);
    return text;
};

// The admin pastes YouTube links for lectures and any web link (usually a PDF) for notes.
const videoLink = (value, label = "Video link") => {
    const text = clean(value, 500, label);
    if (!text) return "";
    let url;
    try { url = new URL(text); } catch { fail(`${label} must be a full YouTube link (https://...).`); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || !YOUTUBE.has(url.hostname.toLowerCase())) fail(`${label} must be a YouTube link.`);
    return text;
};
const notesLink = (value, label = "Notes link") => {
    const text = clean(value, 1000, label);
    if (text && !safeUrl(text)) fail(`${label} must be a full web link (https://...).`);
    return text;
};

function cleanSubtopics(list) {
    if (list === undefined) return undefined;
    if (!Array.isArray(list)) fail("Subtopics must be a list.");
    if (list.length > LIMITS.subtopics) fail(`A topic can have up to ${LIMITS.subtopics} subtopics.`);
    return list.map((item, index) => ({
        ...(mongoose.isValidObjectId(item?._id) ? { _id: item._id } : {}),
        title: clean(item?.title, 140, `Subtopic ${index + 1} name`, { required: true }),
        summary: clean(item?.summary, 240, `Subtopic ${index + 1} description`),
        videoUrl: videoLink(item?.videoUrl, `Subtopic ${index + 1} video link`),
        notesUrl: notesLink(item?.notesUrl, `Subtopic ${index + 1} notes link`),
    }));
}

function cleanTopic(body) {
    const output = {
        title: clean(body.title, 140, "Topic name", { required: true }),
        summary: clean(body.summary, 400, "Description"),
        videoUrl: videoLink(body.videoUrl),
        notesUrl: notesLink(body.notesUrl),
    };
    const subtopics = cleanSubtopics(body.subtopics);
    if (subtopics) output.subtopics = subtopics;
    return output;
}

// `topics` and `categories` are the ids that belong to the same subject, so a practical cannot point at another subject's data.
function cleanPractical(body, { topics, categories }) {
    const pick = (value, allowed, label) => {
        if (value === undefined || value === null || value === "") return null;
        if (!mongoose.isValidObjectId(value) || !allowed.has(String(value))) fail(`Choose a ${label} from this subject.`);
        return String(value);
    };
    return {
        title: clean(body.title, 200, "Practical title", { required: true }),
        label: clean(body.label, 80, "Badge"),
        summary: clean(body.summary, 400, "Description"),
        videoUrl: videoLink(body.videoUrl),
        notesUrl: notesLink(body.notesUrl),
        topic: pick(body.topic, topics, "topic"),
        category: pick(body.category, categories, "category"),
    };
}

function cleanSetting(body) {
    const facts = (Array.isArray(body.facts) ? body.facts : []).slice(0, LIMITS.facts).map(item => ({ label: clean(item?.label, 40, "Fact name"), value: clean(item?.value, 80, "Fact value") })).filter(item => item.label && item.value);
    const links = (Array.isArray(body.links) ? body.links : []).slice(0, LIMITS.links).map((item, i) => ({ title: clean(item?.title, 100, `Link ${i + 1} title`), url: notesLink(item?.url, `Link ${i + 1}`) })).filter(item => item.title && item.url);
    return { intro: clean(body.intro, 1200, "Introduction"), facts, links };
}

module.exports = { LIMITS, clean, videoLink, notesLink, cleanTopic, cleanPractical, cleanSetting, cleanSubtopics };
