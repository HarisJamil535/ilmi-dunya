export const getName = (value, fallback = "Selected") => {
    if (!value) return "";
    if (typeof value === "string") return value.length > 18 ? fallback : value;
    return value.name || fallback;
};

export const isValidUrl = (value) => {
    if (!value) return false;
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
};

export const noteTypeLabels = {
    short_questions: "Short Question Notes",
    long_questions: "Long Question Notes",
    mcqs: "MCQs Notes",
};
