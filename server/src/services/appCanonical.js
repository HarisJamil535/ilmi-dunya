const mongoose = require("mongoose");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const { legacyAddress } = require("./seoPages");

// The student app opens study content at addresses like /chapters?subjectId=… or /topics?chapterId=….
// Each of these shows the same subject, chapter or topic as a readable study page
// (/federal-board/9/chemistry/chapter-5-…). Pointing the app address at that page (rel="canonical")
// tells search engines which address to rank, instead of a "noindex" dead end for every link students follow.
const valid = (v) => (mongoose.isValidObjectId(v) ? String(v) : null);

async function chapterDoc(chapterId) {
    return chapterId ? Chapter.findById(chapterId).select("name chapterNumber subject").lean() : null;
}
async function topicAddress(topicId, chapterId) {
    const topic = topicId ? await Topic.findById(topicId).select("name topicNumber slug subjectId chapterId").lean() : null;
    if (!topic || (chapterId && String(topic.chapterId) !== chapterId)) return null;
    return legacyAddress("topic", topic);
}

async function appCanonical(pathname, query) {
    try {
        if (pathname === "/chapters") {
            const subjectId = valid(query.subjectId);
            return subjectId ? await legacyAddress("subject", { _id: subjectId }) : null;
        }
        const chapterId = valid(query.chapterId);
        const topicId = valid(query.topic) || valid(query.topicId);
        if (pathname === "/topics" || pathname === "/topic-questions") {
            if (topicId) { const address = await topicAddress(topicId, chapterId); if (address) return address; }
            const chapter = await chapterDoc(chapterId);
            return chapter ? await legacyAddress("chapter", chapter) : null;
        }
        if (pathname === "/notes") {
            const chapter = await chapterDoc(chapterId);
            return chapter ? await legacyAddress("notes", { subject: chapter.subject, chapter }) : null;
        }
    } catch { /* fall back to a plain noindex page */ }
    return null;
}

module.exports = { appCanonical };
