const { fail } = require("./publishing");

// Pakistan has no daylight saving, so a fixed UTC+5 offset is exact.
const OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = number => String(number).padStart(2, "0");

// A Date whose UTC fields hold the Pakistan wall-clock time.
const shifted = value => new Date(Math.floor(new Date(value).getTime() / 1000) * 1000 + OFFSET_MS);

function formatDate(value) {
    if (!value) return "";
    const date = shifted(value);
    return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatTime(value) {
    if (!value) return "";
    const date = shifted(value);
    const hours = date.getUTCHours();
    return `${pad(hours % 12 || 12)}:${pad(date.getUTCMinutes())} ${hours < 12 ? "AM" : "PM"}`;
}

const formatDateTime = value => value ? `${formatDate(value)}, ${formatTime(value)}` : "";

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours) return `${hours}h ${pad(minutes)}m`;
    return `${minutes}m ${pad(seconds % 60)}s`;
}

// "2026-10-22" read as a Pakistan calendar day; returns the UTC millisecond it starts at.
function dayStart(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
    return utc.getTime() - OFFSET_MS;
}

// Inclusive Pakistan-time day range; either end may be omitted.
function dateRange(from, to) {
    const range = {};
    if (from) {
        const start = dayStart(from);
        if (start === null) fail("Choose a valid start date.");
        range.start = new Date(start);
    }
    if (to) {
        const start = dayStart(to);
        if (start === null) fail("Choose a valid end date.");
        range.end = new Date(start + DAY_MS - 1);
    }
    if (range.start && range.end && range.start > range.end) fail("The end date must not be before the start date.");
    return range;
}

module.exports = { shifted, formatDate, formatTime, formatDateTime, formatDuration, dayStart, dateRange };
