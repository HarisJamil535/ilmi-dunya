const { slugify, fail } = require("./publishing");
const Board = require("../models/Board");
const ClassModel = require("../models/Class");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const Book = require("../models/Book");
const ChapterNote = require("../models/ChapterNote");
const PastPaper = require("../models/PastPaper");
const Assessment = require("../models/Assessment");
const Question = require("../models/Question");
const NewsArticle = require("../models/NewsArticle");

const models = { board: Board, class: ClassModel, subject: Subject, chapter: Chapter, topic: Topic, book: Book, notes: ChapterNote, "past-paper": PastPaper, mcqs: Assessment };
const name = value => value?.name || "";
const id = value => String(value?._id || value || "");
const pagePath = (kind, doc) => `/learn/${kind}/${id(doc)}/${encodeURIComponent(doc.slug || slugify(doc.title || doc.name) || kind)}`;
const link = (kind, doc) => ({ title: doc.title || doc.name, href: pagePath(kind, doc), summary: doc.summary || doc.description || "" });
const context = doc => [name(doc.board), name(doc.class), name(doc.group), name(doc.subject)].filter(Boolean).join(" / ");
const meta = (title, description, path, indexable = true) => ({ title: `${title} | IlmiDunya`, description: description.slice(0, 180), path, indexable });
const pageNumber = value => Math.max(1, Math.min(10000, Number.parseInt(value, 10) || 1));
const hasAcademicContext = (kind, doc) => {
    if (['board', 'class', 'news'].includes(kind)) return true;
    const topic = kind === 'topic';
    return Boolean(name(doc[topic ? 'boardId' : 'board']) && name(doc[topic ? 'classId' : 'class']) && (kind === 'subject' || name(doc[topic ? 'subjectId' : 'subject'])) && (!topic || doc.chapterId) && (kind !== 'notes' || doc.chapter));
};
const scopeParams = doc => new URLSearchParams(Object.fromEntries(["board", "class", "group", "subject"].filter(key => doc[key]).map(key => [`${key}Id`, id(doc[key])]))).toString();

async function publicPage(path, query = {}) {
    const page = pageNumber(query.page);
    const size = 30;
    if (path === "/learn") {
        const [boards, classes] = await Promise.all([Board.find().sort({ name: 1 }).lean(), ClassModel.find().sort({ name: 1 }).lean()]);
        return { kind: "directory", title: "Study resources for Pakistani board students", summary: "Choose your education board or class to browse the subjects available on IlmiDunya. Each subject brings its chapters, topic questions, notes, textbooks and past papers together. Check the board and class shown on a resource before using it for your exam preparation.", sections: [{ title: "Education boards", links: boards.map(doc => link("board", doc)) }, { title: "Classes", links: classes.map(doc => link("class", doc)) }], breadcrumbs: [{ title: "Home", href: "/" }], meta: meta("Pakistani Boards and Class Study Resources", "Browse board and class study resources, chapters, topic questions, notes, textbooks and past papers for Pakistani students.", path) };
    }
    const match = path.match(/^\/learn\/([a-z-]+)\/([a-f0-9]{24})(?:\/([^/]+))?\/?$/i);
    if (!match || !models[match[1]]) fail("Study page not found.", 404);
    const [, kind, docId] = match;
    let request = models[kind].findById(docId);
    if (["subject", "chapter", "book", "notes", "past-paper", "mcqs"].includes(kind)) request = request.populate("board class group" + (kind !== "subject" ? " subject" : ""));
    if (kind === "topic") request = request.populate("boardId classId groupId subjectId chapterId");
    if (kind === 'notes') request = request.populate('chapter');
    const doc = await request.lean();
    if (!doc || (kind === "mcqs" && doc.status !== "published")) fail("Study page not found.", 404);
    if (!hasAcademicContext(kind, doc)) fail("This resource's academic context is unavailable.", 404);
    if (kind === "topic") Object.assign(doc, { board: doc.boardId, class: doc.classId, group: doc.groupId, subject: doc.subjectId });
    if (["subject", "chapter", "topic", "book", "notes", "past-paper", "mcqs"].includes(kind) && (!name(doc.board) || !name(doc.class) || (kind !== "subject" && !name(doc.subject)))) fail("This resource's academic context is unavailable.", 404);
    const canonicalPath = pagePath(kind, doc);
    const scope = context(doc);
    const title = [doc.title || doc.name, scope].filter(Boolean).join(" - ");
    const sections = [];
    const actions = [];
    let questions = [];
    let hasNext = false;
    const breadcrumbs = [{ title: "Home", href: "/" }, { title: "Study library", href: "/learn" }];
    if (name(doc.board)) breadcrumbs.push({ title: name(doc.board), href: pagePath("board", doc.board) });
    if (name(doc.subject)) breadcrumbs.push({ title: name(doc.subject), href: pagePath("subject", doc.subject) });
    if (kind === "topic" && doc.chapterId) breadcrumbs.push({ title: doc.chapterId.name, href: pagePath("chapter", doc.chapterId) });
    if (["board", "class"].includes(kind)) {
        const subjects = await Subject.find({ [kind]: doc._id }).populate("board class group").sort({ name: 1, _id: 1 }).skip((page - 1) * size).limit(size + 1).lean();
        hasNext = subjects.length > size;
        sections.push({ title: "Available subjects", links: subjects.slice(0, size).map(item => ({ ...link("subject", item), summary: context(item) })) });
    } else if (kind === "subject") {
        const [chapters, books, papers] = await Promise.all([
            Chapter.find({ subject: doc._id }).sort({ chapterNumber: 1 }).lean(),
            Book.find({ subject: doc._id }).lean(),
            PastPaper.find({ subject: doc._id }).sort({ year: -1, session: 1 }).limit(100).lean(),
        ]);
        sections.push({ title: "Chapters", links: chapters.map(item => ({ ...link("chapter", item), title: `Chapter ${item.chapterNumber}: ${item.name}` })) }, { title: "Textbooks", links: books.map(item => link("book", item)) }, { title: "Past papers", links: papers.map(item => ({ ...link("past-paper", item), summary: `${item.year} / ${item.session}` })) });
        actions.push({ title: "Open chapter study tools", href: `/chapters?${scopeParams({ ...doc, subject: doc._id })}` });
    } else if (kind === "chapter") {
        const [topics, notes, tests] = await Promise.all([Topic.find({ chapterId: doc._id }).lean(), ChapterNote.find({ chapter: doc._id }).lean(), Assessment.find({ chapter: doc._id, status: "published" }).select("title slug description summary").lean()]);
        topics.sort((a, b) => String(a.topicNumber).localeCompare(String(b.topicNumber), "en", { numeric: true }));
        sections.push({ title: "Topics", links: topics.map(item => ({ ...link("topic", item), title: `${item.topicNumber} ${item.name}` })) }, { title: "Chapter notes", links: notes.map(item => link("notes", item)) }, { title: "MCQ tests", links: tests.map(item => link("mcqs", item)) });
        actions.push({ title: "Practise chapter MCQs", href: `/tests/start?chapter=${doc._id}` });
    } else if (kind === "topic") {
        const rows = await Question.find({ topic: doc._id, status: "published", contentType: { $in: ["short_question", "long_question"] } }).select("questionText contentType examYear examSession").sort({ contentType: 1, _id: 1 }).skip((page - 1) * size).limit(size + 1).lean();
        questions = rows.slice(0, size);
        hasNext = rows.length > size;
        actions.push({ title: "Practise topic MCQs", href: `/tests/start?topic=${doc._id}` });
        if (doc.videoUrl) actions.push({ title: "Watch this topic's lesson", href: `/topics?chapterId=${id(doc.chapterId)}&topic=${doc._id}` });
    } else if (kind === "mcqs") {
        actions.push({ title: "Take this MCQ test", href: `/tests/${doc._id}/take` });
    } else {
        const destination = kind === "book" ? `/book?${scopeParams(doc)}` : kind === "notes" ? `/notes?chapterId=${id(doc.chapter)}&${scopeParams(doc)}` : `/past-papers?${scopeParams(doc)}`;
        actions.push({ title: kind === "past-paper" ? "View past papers" : "View resource and download options", href: destination });
    }
    const summary = doc.summary || doc.description || "";
    const count = sections.reduce((total, section) => total + section.links.length, 0);
    const indexable = ["board", "class", "subject", "chapter"].includes(kind) ? count > 0 || summary.length >= 80 : kind === "topic" ? questions.length > 0 || summary.length >= 80 : summary.length >= 80;
    const suffix = page > 1 ? `?page=${page}` : "";
    return { kind, title, scope, summary, sourceName: doc.sourceName, sourceUrl: doc.sourceUrl, edition: doc.edition, tags: doc.tags || [], updatedAt: doc.updatedAt, year: doc.year, session: doc.session, durationMinutes: doc.durationMinutes, questionCount: kind === "mcqs" ? doc.questions?.length : undefined, instructions: kind === "mcqs" ? doc.instructions : undefined, sections: sections.filter(section => section.links.length), actions, questions, breadcrumbs, page, previous: page > 1 ? `${canonicalPath}${page === 2 ? "" : `?page=${page - 1}`}` : null, next: hasNext ? `${canonicalPath}?page=${page + 1}` : null, meta: meta(title + (page > 1 ? ` - Page ${page}` : ""), summary || `Explore ${title}. ${count ? `${count} available study resources with their academic context.` : "Review the resource details and available study tools."}`, canonicalPath + suffix, indexable) };
}

const resourceReady = { summary: { $regex: /[\s\S]{80}/ } };
const sitemapModels = { ...models, news: NewsArticle };
function sitemapFilter(kind) {
    if (kind === "news") return { isPublished: true, excerpt: { $regex: /[\s\S]{60}/ }, content: { $regex: /[\s\S]{160}/ } };
    if (kind === "mcqs") return { status: "published", ...resourceReady };
    // Curated descriptions avoid indexing empty academic shells and thin legacy resources.
    if (["board", "class"].includes(kind)) return null;
    return resourceReady;
}

module.exports = { publicPage, pagePath, meta, sitemapModels, sitemapFilter, pageNumber, hasAcademicContext };
