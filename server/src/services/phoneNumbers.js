// Stores Pakistani numbers as +92..., and other countries' numbers as typed with their + prefix.
const normalizePakistaniPhone = (value) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";
    let digits = raw.replace(/[^\d]/g, "");
    if (raw.startsWith("+")) return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
    else if (!digits.startsWith("92")) digits = `92${digits}`;
    return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : "";
};

module.exports = { normalizePakistaniPhone };
