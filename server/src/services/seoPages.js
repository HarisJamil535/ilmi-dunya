// Search-friendly study pages under readable addresses that mirror how students search, e.g.
//   /federal-board/class-9/computer-science/chapter-3-programming-fundamentals/mcqs
// Every page is built only from published content: real chapters, topics, notes, questions and MCQs.
const Board = require("../models/Board");
const ClassModel = require("../models/Class");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Topic = require("../models/Topic");
const ChapterNote = require("../models/ChapterNote");
const Book = require("../models/Book");
const PastPaper = require("../models/PastPaper");
const Assessment = require("../models/Assessment");
const Question = require("../models/Question");
const { slugify, fail } = require("./publishing");
const { openNow } = require("./testPublishing");

// MCQs shown publicly with answers. The full set stays in the timed tests, so a test is still a real test.
const PUBLIC_MCQS = { chapter: 30, topic: 15, sample: 5 };
const NOTE_TYPES = [["short_questions", "Short Questions"], ["long_questions", "Long Questions"], ["mcqs", "MCQs"], ["exercise", "Exercise Solutions"]];
const id = value => String(value?._id || value || "");
const segment = text => slugify(String(text || "")) || "page";

// "Federal Board" also searched as "FBISE"; other boards keep their own name.
const boardShort = board => (/federal/i.test(board?.name || "") ? "FBISE" : "");
const boardFull = board => (boardShort(board) ? `${board.name} (${boardShort(board)})` : board?.name || "");
const classNumber = cls => Number((String(cls?.name || "").match(/\d+/) || [])[0]) || null;
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
// "Class 9" and its common search form "9th Class".
const classNames = cls => {
    const n = classNumber(cls);
    return { name: cls?.name || "", alt: n ? `${ordinal(n)} Class` : cls?.name || "" };
};
const chapterSegment = chapter => `chapter-${chapter.chapterNumber}-${segment(chapter.name)}`;
const topicSegment = topic => [String(topic.topicNumber || "").replace(/[^0-9a-z]+/gi, "-").replace(/^-|-$/g, ""), segment(topic.name)].filter(Boolean).join("-");
const byNumber = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });

let catalogCache = null;
// Boards, classes and subjects with their address segments; small, so kept for 30 seconds.
async function catalog() {
    if (catalogCache && catalogCache.expires > Date.now()) return catalogCache.value;
    const value = (async () => {
        const [boards, classes, groups, subjects] = await Promise.all([
            Board.find().select("name slug").lean(),
            ClassModel.find().select("name slug").lean(),
            Group.find().select("name").lean(),
            Subject.find().select("name slug board class group summary description updatedAt").lean(),
        ]);
        const boardSeg = new Map(boards.map(board => [id(board), board.slug || segment(board.name)]));
        const classSeg = new Map(classes.map(cls => [id(cls), segment(cls.name)]));
        const groupName = new Map(groups.map(group => [id(group), group.name]));
        // Two groups can both have "Mathematics" in one class; the group name tells them apart.
        const subjectSeg = new Map();
        const taken = new Map();
        for (const subject of subjects) {
            const key = `${id(subject.board)}|${id(subject.class)}|${segment(subject.name)}`;
            taken.set(key, (taken.get(key) || 0) + 1);
        }
        for (const subject of [...subjects].sort((a, b) => id(a).localeCompare(id(b)))) {
            const base = segment(subject.name);
            const shared = taken.get(`${id(subject.board)}|${id(subject.class)}|${base}`) > 1;
            subjectSeg.set(id(subject), shared ? `${base}-${segment(groupName.get(id(subject.group)) || id(subject.group).slice(-6))}` : base);
        }
        return {
            boards: new Map(boards.map(board => [id(board), board])),
            classes: new Map(classes.map(cls => [id(cls), cls])),
            groupName, subjects, boardSeg, classSeg, subjectSeg,
        };
    })();
    catalogCache = { value, expires: Date.now() + 30000 };
    try { return await value; } catch (error) { catalogCache = null; throw error; }
}
const clearCatalog = () => { catalogCache = null; };

// Addresses.
const urls = (cat) => {
    const board = b => `/${cat.boardSeg.get(id(b))}`;
    const boardClass = (b, c) => `${board(b)}/${cat.classSeg.get(id(c))}`;
    const subject = s => `${boardClass(s.board, s.class)}/${cat.subjectSeg.get(id(s))}`;
    const chapter = (s, ch) => `${subject(s)}/${chapterSegment(ch)}`;
    const topic = (s, ch, t) => `${chapter(s, ch)}/${topicSegment(t)}`;
    return { board, boardClass, subject, chapter, topic };
};
async function subjectUrl(subjectId) {
    const cat = await catalog();
    const subject = cat.subjects.find(item => id(item) === id(subjectId));
    return subject && cat.boardSeg.get(id(subject.board)) && cat.classSeg.get(id(subject.class)) ? urls(cat).subject(subject) : null;
}

// Published MCQs: the questions in topic tests that are live for students right now.
async function liveMcqs(filter, limit) {
    const tests = await Assessment.find({ ...openNow(), type: "topic_test", isAutoGenerated: { $ne: true }, createdBy: { $exists: true }, ...filter })
        .select("topic questions.question questions.order").lean();
    const order = [];
    const seen = new Set();
    for (const test of tests) {
        for (const item of [...(test.questions || [])].sort((a, b) => (a.order || 0) - (b.order || 0))) {
            const key = id(item.question);
            if (!seen.has(key)) { seen.add(key); order.push(key); }
        }
    }
    if (!order.length) return { total: 0, items: [], byTopic: new Map() };
    const docs = await Question.find({ _id: { $in: order }, status: { $ne: "archived" }, contentType: { $nin: ["short_question", "long_question"] } })
        .select("questionText options correctOption explanation contentLanguage isImportant topic scenario imageUrls imageAlt")
        .populate("scenario", "title scenarioText").lean();
    const byId = new Map(docs.map(doc => [id(doc), doc]));
    const ordered = order.map(key => byId.get(key)).filter(Boolean);
    const byTopic = new Map();
    for (const doc of ordered) byTopic.set(id(doc.topic), (byTopic.get(id(doc.topic)) || 0) + 1);
    // Important MCQs first, then the teacher's order.
    const shown = [...ordered].sort((a, b) => Number(Boolean(b.isImportant)) - Number(Boolean(a.isImportant))).slice(0, limit);
    return {
        total: ordered.length,
        byTopic,
        items: shown.map(doc => ({ _id: id(doc), questionText: doc.questionText, options: (doc.options || []).map(option => ({ key: option.key, text: option.text })), correctOption: doc.correctOption, explanation: doc.explanation || "", contentLanguage: doc.contentLanguage, isImportant: Boolean(doc.isImportant), scenario: doc.scenario ? { title: doc.scenario.title, scenarioText: doc.scenario.scenarioText } : null, imageUrl: doc.imageUrls?.[0] || "", imageAlt: doc.imageAlt || "" })),
    };
}

const writtenQuestions = (filter, limit) => Question.find({ ...filter, status: "published", contentType: { $in: ["short_question", "long_question"] } })
    .select("questionText contentLanguage contentType isImportant").sort({ contentType: -1, isImportant: -1, _id: 1 }).limit(limit).lean();

// Everything a page needs that describes the syllabus it belongs to.
function labels(cat, subject) {
    const board = cat.boards.get(id(subject?.board));
    const cls = cat.classes.get(id(subject?.class));
    const { name: className, alt: classAlt } = classNames(cls);
    return { board, cls, className, classAlt, boardName: board?.name || "", boardFull: boardFull(board), short: boardShort(board), subjectName: subject?.name || "", group: cat.groupName.get(id(subject?.group)) || "" };
}

const pageMeta = (title, description, path, indexable) => ({ title, description: description.replace(/\s+/g, " ").trim().slice(0, 165), path, indexable });
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Board hub: every class of the board with its subjects.
async function boardPage(cat, board) {
    const u = urls(cat);
    const subjects = cat.subjects.filter(subject => id(subject.board) === id(board) && cat.classes.has(id(subject.class)));
    const byClass = new Map();
    for (const subject of subjects) {
        if (!byClass.has(id(subject.class))) byClass.set(id(subject.class), []);
        byClass.get(id(subject.class)).push(subject);
    }
    const classes = [...byClass.keys()].map(key => cat.classes.get(key)).sort((a, b) => (classNumber(a) || 0) - (classNumber(b) || 0));
    const full = boardFull(board);
    const classList = classes.map(cls => cls.name).join(", ");
    return {
        kind: "seo-board", title: `${full} Notes, MCQs & Past Papers`,
        scope: classList ? `${classList} · all subjects` : "",
        intro: [
            `Free ${full} study material for ${classList || "every class"}: chapter-wise notes, MCQs with answers, short and long questions, exercise solutions, textbooks and past papers.`,
            `Choose your class below, then your subject, to study chapter by chapter and practise with online MCQ tests.`,
        ],
        sections: classes.map(cls => ({
            title: `${board.name} ${cls.name} (${classNames(cls).alt})`,
            hub: { title: `All ${board.name} ${cls.name} subjects`, href: u.boardClass(board, cls) },
            links: byClass.get(id(cls)).sort((a, b) => a.name.localeCompare(b.name)).map(subject => ({ title: `${cls.name} ${subject.name}`, href: u.subject(subject), summary: `Notes, MCQs and past papers${cat.groupName.get(id(subject.group)) ? ` · ${cat.groupName.get(id(subject.group))} group` : ""}` })),
        })),
        breadcrumbs: [{ title: "Home", href: "/" }, { title: board.name, href: u.board(board) }],
        faqs: classes.length ? [{ question: `Which classes does IlmiDunya cover for ${board.name}?`, answer: `IlmiDunya has ${full} study material for ${classList}, organised subject by subject and chapter by chapter.` }] : [],
        meta: pageMeta(`${full} Notes, MCQs & Past Papers – ${classes.map(cls => classNames(cls).alt).join(", ") || "All Classes"}`, `${full} chapter-wise notes, MCQs with answers, exercise solutions and past papers for ${classes.map(cls => `${cls.name} (${classNames(cls).alt})`).join(", ") || "every class"}. Free online MCQ tests on IlmiDunya.`, u.board(board), classes.length > 0),
    };
}

// Board + class hub, e.g. "Federal Board Class 9".
async function boardClassPage(cat, board, cls) {
    const u = urls(cat);
    const subjects = cat.subjects.filter(subject => id(subject.board) === id(board) && id(subject.class) === id(cls)).sort((a, b) => a.name.localeCompare(b.name));
    const { alt } = classNames(cls);
    const full = boardFull(board);
    const names = subjects.map(subject => subject.name).join(", ");
    return {
        kind: "seo-board-class", title: `${board.name} ${cls.name} Notes, MCQs & Past Papers`,
        scope: `${alt} · ${full}`,
        intro: [
            `Everything for ${board.name} ${cls.name} (${alt}) in one place${names ? `: ${names}` : ""}.`,
            `Open a subject for chapter-wise notes, MCQs with answers, short and long questions and exercise solutions, or practise with a timed online MCQ test.`,
        ],
        sections: [
            { title: `${cls.name} subjects`, links: subjects.map(subject => ({ title: `${cls.name} ${subject.name}`, href: u.subject(subject), summary: `Chapter-wise notes, MCQs and past papers` })) },
            { title: `${cls.name} MCQs by subject`, links: subjects.map(subject => ({ title: `${cls.name} ${subject.name} MCQs`, href: `${u.subject(subject)}/mcqs`, summary: `Chapter-wise MCQs with answers` })) },
            { title: `${cls.name} notes by subject`, links: subjects.map(subject => ({ title: `${cls.name} ${subject.name} Notes`, href: `${u.subject(subject)}/notes`, summary: `Notes and exercise solutions for every chapter` })) },
        ].filter(section => section.links.length),
        breadcrumbs: [{ title: "Home", href: "/" }, { title: board.name, href: u.board(board) }, { title: cls.name, href: u.boardClass(board, cls) }],
        faqs: subjects.length ? [{ question: `Which ${board.name} ${cls.name} subjects are available?`, answer: `${names}. Each subject has chapter-wise notes, MCQs with answers and online tests.` }] : [],
        meta: pageMeta(`${board.name} ${cls.name} (${alt}) Notes, MCQs & Past Papers – All Subjects`, `${full} ${cls.name} (${alt}) notes, MCQs with answers, exercise solutions and past papers${names ? ` for ${names}` : ""}. Free chapter-wise online tests.`, u.boardClass(board, cls), subjects.length > 0),
    };
}

// What each chapter of a subject has, for hubs and listings.
async function chapterInventory(subject) {
    const chapters = (await Chapter.find({ subject: subject._id }).select("name chapterNumber slug summary description updatedAt").lean()).sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    const chapterIds = chapters.map(chapter => chapter._id);
    const [notes, tests, written, topics] = await Promise.all([
        ChapterNote.find({ chapter: { $in: chapterIds } }).select("chapter noteType title").lean(),
        Assessment.find({ ...openNow(), type: "topic_test", isAutoGenerated: { $ne: true }, createdBy: { $exists: true }, chapter: { $in: chapterIds } }).select("chapter questions.question").lean(),
        Question.aggregate([{ $match: { chapter: { $in: chapterIds }, status: "published", contentType: { $in: ["short_question", "long_question"] } } }, { $group: { _id: "$chapter", count: { $sum: 1 } } }]),
        Topic.aggregate([{ $match: { chapterId: { $in: chapterIds } } }, { $group: { _id: "$chapterId", count: { $sum: 1 } } }]),
    ]);
    const mcqs = new Map();
    for (const test of tests) {
        const set = mcqs.get(id(test.chapter)) || new Set();
        (test.questions || []).forEach(item => set.add(id(item.question)));
        mcqs.set(id(test.chapter), set);
    }
    const noteTypes = new Map();
    for (const note of notes) noteTypes.set(id(note.chapter), [...(noteTypes.get(id(note.chapter)) || []), note.noteType]);
    const writtenCount = new Map(written.map(row => [id(row._id), row.count]));
    const topicCount = new Map(topics.map(row => [id(row._id), row.count]));
    return chapters.map(chapter => ({ chapter, mcqs: mcqs.get(id(chapter))?.size || 0, notes: noteTypes.get(id(chapter)) || [], written: writtenCount.get(id(chapter)) || 0, topics: topicCount.get(id(chapter)) || 0 }));
}

const subjectCrumbs = (cat, subject, l) => {
    const u = urls(cat);
    return [{ title: "Home", href: "/" }, { title: l.boardName, href: u.board(l.board) }, { title: l.className, href: u.boardClass(l.board, l.cls) }, { title: l.subjectName, href: u.subject(subject) }];
};
const noteLabel = type => (NOTE_TYPES.find(([key]) => key === type) || [type, type])[1];
const chapterLine = item => [item.mcqs && plural(item.mcqs, "MCQ"), item.notes.length && `${item.notes.length} notes`, item.written && plural(item.written, "short/long question"), item.topics && plural(item.topics, "topic")].filter(Boolean).join(" · ");

async function subjectPage(cat, subject, view) {
    const u = urls(cat);
    const l = labels(cat, subject);
    const inventory = await chapterInventory(subject);
    const base = u.subject(subject);
    const crumbs = subjectCrumbs(cat, subject, l);
    const who = `${l.className} ${l.subjectName}`;
    const totalMcqs = inventory.reduce((sum, item) => sum + item.mcqs, 0);
    const withNotes = inventory.filter(item => item.notes.length || item.written);
    if (view === "mcqs") {
        const withMcqs = inventory.filter(item => item.mcqs);
        const first = withMcqs[0];
        const sample = first ? await liveMcqs({ chapter: first.chapter._id }, PUBLIC_MCQS.sample) : { items: [] };
        return {
            kind: "seo-subject-mcqs", title: `${who} MCQs with Answers – Chapter Wise`,
            scope: `${l.classAlt} ${l.subjectName} · ${l.boardFull}`,
            intro: [
                `Practise ${totalMcqs ? `${totalMcqs} ` : ""}${l.boardName} ${who} MCQs (${l.classAlt} ${l.subjectName}) chapter by chapter, with correct answers and explanations.`,
                `Open a chapter to see its MCQs with answers, then take a timed online test to check your preparation for the ${l.short || l.boardName} exam.`,
            ],
            sections: [{ title: `${who} chapter-wise MCQs`, links: withMcqs.map(item => ({ title: `Chapter ${item.chapter.chapterNumber}: ${item.chapter.name} MCQs`, href: `${u.chapter(subject, item.chapter)}/mcqs`, summary: `${plural(item.mcqs, "MCQ")} with answers` })) }],
            mcqs: sample.items, mcqHeading: first ? `Sample MCQs from Chapter ${first.chapter.chapterNumber}: ${first.chapter.name}` : "", mcqMore: first ? { title: `All Chapter ${first.chapter.chapterNumber} MCQs`, href: `${u.chapter(subject, first.chapter)}/mcqs` } : null,
            breadcrumbs: [...crumbs, { title: "MCQs", href: `${base}/mcqs` }],
            faqs: withMcqs.length ? [{ question: `How many ${who} MCQs are on IlmiDunya?`, answer: `There are ${totalMcqs} published MCQs across ${plural(withMcqs.length, "chapter")}, each with the correct answer.` }] : [],
            meta: pageMeta(`${who} MCQs with Answers Chapter Wise – ${l.short || l.boardName}`, `${l.boardFull} ${who} (${l.classAlt}) MCQs with answers for all chapters. ${totalMcqs ? `${totalMcqs} MCQs, ` : ""}chapter-wise online tests and explanations.`, `${base}/mcqs`, withMcqs.length > 0),
        };
    }
    if (view === "notes") {
        return {
            kind: "seo-subject-notes", title: `${who} Notes – All Chapters`,
            scope: `${l.classAlt} ${l.subjectName} · ${l.boardFull}`,
            intro: [
                `${l.boardName} ${who} notes (${l.classAlt} ${l.subjectName}) for every chapter: short questions, long questions, MCQs and exercise solutions.`,
                `Open a chapter to read its questions and get the notes for your ${l.short || l.boardName} exam preparation.`,
            ],
            sections: [{ title: `${who} chapter-wise notes`, links: withNotes.map(item => ({ title: `Chapter ${item.chapter.chapterNumber}: ${item.chapter.name} Notes`, href: `${u.chapter(subject, item.chapter)}/notes`, summary: [item.notes.map(noteLabel).join(", "), item.written && plural(item.written, "question")].filter(Boolean).join(" · ") })) }],
            breadcrumbs: [...crumbs, { title: "Notes", href: `${base}/notes` }],
            faqs: withNotes.some(item => item.notes.includes("exercise")) ? [{ question: `Where are the ${who} exercise solutions?`, answer: `Exercise solutions are listed with each chapter's notes: ${withNotes.filter(item => item.notes.includes("exercise")).map(item => `Chapter ${item.chapter.chapterNumber}`).join(", ")}.` }] : [],
            meta: pageMeta(`${who} Notes – All Chapters & Exercise Solutions | ${l.short || l.boardName}`, `${l.boardFull} ${who} (${l.classAlt}) notes for all chapters: short and long questions, MCQs and exercise solutions.`, `${base}/notes`, withNotes.length > 0),
        };
    }
    const [books, papers] = await Promise.all([
        Book.find({ subject: subject._id }).select("title slug summary sourceName edition").lean(),
        PastPaper.find({ subject: subject._id }).sort({ year: -1, session: 1 }).select("title slug year session examType isNewPattern").limit(40).lean(),
    ]);
    const { pagePath } = require("./publicPages");
    const copyLabels = labelsFrom(l.board, l.cls, subject);
    return {
        kind: "seo-subject", title: `${who} Notes, MCQs & Past Papers`,
        scope: `${l.classAlt} ${l.subjectName} · ${l.boardFull}${l.group ? ` · ${l.group}` : ""}`,
        summary: subject.summary || subject.description || "",
        intro: [
            `Complete ${l.boardName} ${who} (${l.classAlt} ${l.subjectName}) study material: ${plural(inventory.length, "chapter")} with notes, MCQs with answers, short and long questions and exercise solutions.`,
            `Pick a chapter below, or jump straight to all ${who} MCQs or notes.`,
        ],
        quickLinks: [
            { title: `${who} MCQs`, href: `${base}/mcqs`, note: totalMcqs ? plural(totalMcqs, "MCQ") : "Chapter wise" },
            { title: `${who} Notes`, href: `${base}/notes`, note: "All chapters" },
        ],
        sections: [
            { title: `${who} chapters`, links: inventory.map(item => ({ title: `Chapter ${item.chapter.chapterNumber}: ${item.chapter.name}`, href: u.chapter(subject, item.chapter), summary: chapterLine(item) || "Topics and study material" })) },
            { title: "Textbooks", links: books.map(book => ({ title: resourceCopy("book", book, copyLabels).title, href: pagePath("book", book), summary: book.summary || `${l.boardName} ${who} textbook to read online` })) },
            { title: `${who} past papers`, links: papers.map(paper => ({ title: resourceCopy("past-paper", paper, copyLabels).title.replace(/ – .*$/, ""), href: pagePath("past-paper", paper), summary: [paper.year, titleCase(paper.session), titleCase(paper.examType)].filter(Boolean).join(" · ") })) },
        ].filter(section => section.links.length),
        actions: [{ title: "Open chapter study tools", href: `/chapters?boardId=${id(subject.board)}&classId=${id(subject.class)}${subject.group ? `&groupId=${id(subject.group)}` : ""}&subjectId=${id(subject)}` }],
        breadcrumbs: crumbs,
        faqs: inventory.length ? [{ question: `How many chapters are in ${l.boardName} ${who}?`, answer: `${who} has ${plural(inventory.length, "chapter")}: ${inventory.map(item => `${item.chapter.chapterNumber}. ${item.chapter.name}`).join("; ")}.` }] : [],
        meta: pageMeta(`${who} Notes, MCQs & Past Papers – ${l.boardFull}`, `${l.boardFull} ${who} (${l.classAlt} ${l.subjectName}): chapter-wise notes, MCQs with answers, exercise solutions and past papers${inventory.length ? ` for all ${inventory.length} chapters` : ""}.`, base, inventory.length > 0),
        updatedAt: subject.updatedAt,
    };
}

async function chapterPage(cat, subject, chapter, view) {
    const u = urls(cat);
    const l = labels(cat, subject);
    const base = u.chapter(subject, chapter);
    const who = `${l.className} ${l.subjectName}`;
    const chapterTitle = `Chapter ${chapter.chapterNumber}: ${chapter.name}`;
    const [topics, siblings, notes] = await Promise.all([
        Topic.find({ chapterId: chapter._id }).select("name topicNumber slug videoUrl").lean(),
        Chapter.find({ subject: subject._id }).select("name chapterNumber").lean(),
        ChapterNote.find({ chapter: chapter._id }).select("noteType title summary updatedAt").lean(),
    ]);
    topics.sort((a, b) => byNumber(a.topicNumber, b.topicNumber));
    siblings.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    const at = siblings.findIndex(item => id(item) === id(chapter));
    const neighbours = [siblings[at - 1] && { label: "Previous chapter", title: `Chapter ${siblings[at - 1].chapterNumber}: ${siblings[at - 1].name}`, href: u.chapter(subject, siblings[at - 1]) + (view ? `/${view}` : "") }, siblings[at + 1] && { label: "Next chapter", title: `Chapter ${siblings[at + 1].chapterNumber}: ${siblings[at + 1].name}`, href: u.chapter(subject, siblings[at + 1]) + (view ? `/${view}` : "") }].filter(Boolean);
    const crumbs = [...subjectCrumbs(cat, subject, l), { title: `Chapter ${chapter.chapterNumber}`, href: base }];
    const noteCards = NOTE_TYPES.map(([type, label]) => {
        const note = notes.find(item => item.noteType === type);
        return { type, label, title: `${who} Chapter ${chapter.chapterNumber} ${label}`, available: Boolean(note), href: `/notes?chapterId=${id(chapter)}&boardId=${id(subject.board)}&classId=${id(subject.class)}${subject.group ? `&groupId=${id(subject.group)}` : ""}&subjectId=${id(subject)}` };
    });
    const topicLinks = mcqCount => topics.map(topic => ({ title: `${topic.topicNumber} ${topic.name}`, href: u.topic(subject, chapter, topic), summary: mcqCount?.get(id(topic)) ? plural(mcqCount.get(id(topic)), "MCQ") : "Questions and practice" }));
    const short = `${l.short || l.boardName}`;

    if (view === "mcqs") {
        const mcqs = await liveMcqs({ chapter: chapter._id }, PUBLIC_MCQS.chapter);
        return {
            kind: "seo-chapter-mcqs", title: `${who} ${chapterTitle} MCQs with Answers`,
            scope: `${l.classAlt} ${l.subjectName} · ${l.boardFull}`,
            intro: [
                `${mcqs.total ? `${mcqs.total} ` : ""}multiple choice questions (MCQs) for ${l.boardName} ${who} Chapter ${chapter.chapterNumber}, ${chapter.name} (${l.classAlt} ${l.subjectName}), with the correct answer and an explanation for each.`,
                mcqs.total > mcqs.items.length ? `Here are ${mcqs.items.length} of them. Take the online test to practise the full set against the clock.` : `Read them here, then take the timed online test to check yourself.`,
            ],
            mcqs: mcqs.items, mcqTotal: mcqs.total,
            actions: mcqs.total ? [{ title: `Take the Chapter ${chapter.chapterNumber} MCQ test`, href: `/tests/start?chapter=${id(chapter)}` }] : [],
            sections: [{ title: "MCQs by topic", links: topicLinks(mcqs.byTopic).filter((_, i) => mcqs.byTopic.get(id(topics[i]))) }, { title: "More for this chapter", links: [{ title: `${chapterTitle} Notes`, href: `${base}/notes`, summary: "Short and long questions, exercise solutions" }, { title: `${chapterTitle}`, href: base, summary: "All topics of this chapter" }] }].filter(section => section.links.length),
            neighbours,
            breadcrumbs: [...crumbs, { title: "MCQs", href: `${base}/mcqs` }],
            faqs: mcqs.total ? [{ question: `How many MCQs are in ${who} Chapter ${chapter.chapterNumber}?`, answer: `IlmiDunya has ${plural(mcqs.total, "published MCQ")} for Chapter ${chapter.chapterNumber}, ${chapter.name}, each with the correct answer.` }] : [],
            meta: pageMeta(`${who} Chapter ${chapter.chapterNumber} MCQs with Answers – ${short}`, `${l.boardFull} ${l.classAlt} ${l.subjectName} Chapter ${chapter.chapterNumber} ${chapter.name} MCQs with answers and explanations.${mcqs.total ? ` ${mcqs.total} MCQs` : ""} Free online test.`, `${base}/mcqs`, mcqs.total > 0),
            updatedAt: chapter.updatedAt,
        };
    }
    if (view === "notes") {
        const questions = await writtenQuestions({ chapter: chapter._id }, 60);
        const hasExercise = notes.some(note => note.noteType === "exercise");
        return {
            kind: "seo-chapter-notes", title: `${who} ${chapterTitle} Notes`,
            scope: `${l.classAlt} ${l.subjectName} · ${l.boardFull}`,
            intro: [
                `${l.boardName} ${who} Chapter ${chapter.chapterNumber} (${chapter.name}) notes: short questions, long questions, MCQs${hasExercise ? " and exercise solutions" : ""} for ${l.classAlt} ${l.subjectName}.`,
                `Open any notes below to read or download them, and revise the chapter's important questions listed on this page.`,
            ],
            notes: noteCards, questions,
            sections: [{ title: "More for this chapter", links: [{ title: `${chapterTitle} MCQs`, href: `${base}/mcqs`, summary: "MCQs with answers and an online test" }, { title: chapterTitle, href: base, summary: "All topics of this chapter" }] }],
            neighbours,
            breadcrumbs: [...crumbs, { title: "Notes", href: `${base}/notes` }],
            faqs: hasExercise ? [{ question: `Are ${who} Chapter ${chapter.chapterNumber} exercise solutions available?`, answer: `Yes. The exercise solutions for Chapter ${chapter.chapterNumber}, ${chapter.name}, are in the notes on this page.` }] : [],
            meta: pageMeta(`${who} Chapter ${chapter.chapterNumber} Notes${hasExercise ? " & Exercise Solutions" : ""} – ${short}`, `${l.boardFull} ${l.classAlt} ${l.subjectName} Chapter ${chapter.chapterNumber} ${chapter.name} notes: short and long questions, MCQs${hasExercise ? " and exercise solutions" : ""}.`, `${base}/notes`, notes.length > 0 || questions.length > 0),
            updatedAt: notes.reduce((latest, note) => (note.updatedAt > latest ? note.updatedAt : latest), chapter.updatedAt),
        };
    }
    const mcqs = await liveMcqs({ chapter: chapter._id }, PUBLIC_MCQS.sample);
    return {
        kind: "seo-chapter", title: `${who} ${chapterTitle}`,
        scope: `${l.classAlt} ${l.subjectName} · ${l.boardFull}`,
        summary: chapter.summary || chapter.description || "",
        intro: [
            `${l.boardName} ${who} Chapter ${chapter.chapterNumber}, ${chapter.name}: ${plural(topics.length, "topic")}${mcqs.total ? `, ${plural(mcqs.total, "MCQ")} with answers` : ""}${notes.length ? `, notes${notes.some(note => note.noteType === "exercise") ? " and exercise solutions" : ""}` : ""}.`,
            ...(!(chapter.summary || chapter.description) && topics.length ? [`This chapter covers ${topics.slice(0, 12).map(topic => `${topic.topicNumber} ${topic.name}`).join(", ")}${topics.length > 12 ? " and more" : ""}. Read the notes, revise the short and long questions, and practise the MCQs to prepare it fully.`] : []),
        ],
        quickLinks: [
            { title: `Chapter ${chapter.chapterNumber} MCQs`, href: `${base}/mcqs`, note: mcqs.total ? plural(mcqs.total, "MCQ") : "With answers" },
            { title: `Chapter ${chapter.chapterNumber} Notes`, href: `${base}/notes`, note: notes.some(note => note.noteType === "exercise") ? "Incl. exercise solutions" : "Short & long questions" },
        ],
        sections: [{ title: `Topics in Chapter ${chapter.chapterNumber}`, links: topicLinks(mcqs.byTopic) }],
        mcqs: mcqs.items, mcqHeading: mcqs.items.length ? `Sample MCQs from Chapter ${chapter.chapterNumber}` : "", mcqMore: mcqs.total ? { title: `All ${plural(mcqs.total, "MCQ")} for Chapter ${chapter.chapterNumber}`, href: `${base}/mcqs` } : null,
        actions: mcqs.total ? [{ title: `Take the Chapter ${chapter.chapterNumber} MCQ test`, href: `/tests/start?chapter=${id(chapter)}` }] : [],
        neighbours,
        breadcrumbs: crumbs,
        faqs: topics.length ? [{ question: `What topics are in ${who} Chapter ${chapter.chapterNumber}?`, answer: topics.map(topic => `${topic.topicNumber} ${topic.name}`).join("; ") + "." }] : [],
        meta: pageMeta(`${who} Chapter ${chapter.chapterNumber}: ${chapter.name} – Notes & MCQs | ${short}`, `${l.boardFull} ${l.classAlt} ${l.subjectName} Chapter ${chapter.chapterNumber} ${chapter.name}: topics, notes, MCQs with answers and exercise solutions.`, base, topics.length > 0 || mcqs.total > 0 || notes.length > 0),
        updatedAt: chapter.updatedAt,
    };
}

async function topicPage(cat, subject, chapter, topic) {
    const u = urls(cat);
    const l = labels(cat, subject);
    const who = `${l.className} ${l.subjectName}`;
    const base = u.topic(subject, chapter, topic);
    const [questions, mcqs, siblings] = await Promise.all([
        writtenQuestions({ topic: topic._id }, 60),
        liveMcqs({ topic: topic._id }, PUBLIC_MCQS.topic),
        Topic.find({ chapterId: chapter._id }).select("name topicNumber").lean(),
    ]);
    siblings.sort((a, b) => byNumber(a.topicNumber, b.topicNumber));
    const at = siblings.findIndex(item => id(item) === id(topic));
    const neighbours = [siblings[at - 1] && { label: "Previous topic", title: `${siblings[at - 1].topicNumber} ${siblings[at - 1].name}`, href: u.topic(subject, chapter, siblings[at - 1]) }, siblings[at + 1] && { label: "Next topic", title: `${siblings[at + 1].topicNumber} ${siblings[at + 1].name}`, href: u.topic(subject, chapter, siblings[at + 1]) }].filter(Boolean);
    const actions = [];
    if (mcqs.total) actions.push({ title: "Practise this topic's MCQs", href: `/tests/start?topic=${id(topic)}` });
    if (topic.videoUrl) actions.push({ title: "Watch this topic's lesson", href: `/topics?chapterId=${id(chapter)}&topic=${id(topic)}` });
    return {
        kind: "seo-topic", title: `${topic.topicNumber} ${topic.name}`,
        scope: `${who} · Chapter ${chapter.chapterNumber}: ${chapter.name} · ${l.boardFull}`,
        summary: topic.summary || topic.description || "",
        intro: [`${topic.topicNumber} ${topic.name} from ${l.boardName} ${who} (${l.classAlt}) Chapter ${chapter.chapterNumber}, ${chapter.name}${questions.length ? `: ${plural(questions.length, "short and long question")}` : ""}${mcqs.total ? `${questions.length ? " and" : ":"} ${plural(mcqs.total, "MCQ")} with answers` : ""}.`],
        questions, mcqs: mcqs.items, mcqTotal: mcqs.total, mcqHeading: mcqs.items.length ? `${topic.name} MCQs` : "",
        actions, neighbours,
        sections: [{ title: `Chapter ${chapter.chapterNumber} study material`, links: [{ title: `Chapter ${chapter.chapterNumber} MCQs`, href: `${u.chapter(subject, chapter)}/mcqs`, summary: "All chapter MCQs with answers" }, { title: `Chapter ${chapter.chapterNumber} Notes`, href: `${u.chapter(subject, chapter)}/notes`, summary: "Short and long questions, exercise solutions" }] }],
        breadcrumbs: [...subjectCrumbs(cat, subject, l), { title: `Chapter ${chapter.chapterNumber}`, href: u.chapter(subject, chapter) }, { title: `${topic.topicNumber} ${topic.name}`, href: base }],
        faqs: [],
        meta: pageMeta(`${topic.topicNumber} ${topic.name} – ${who} Chapter ${chapter.chapterNumber} | ${l.short || l.boardName}`, `${topic.topicNumber} ${topic.name}: ${l.boardFull} ${l.classAlt} ${l.subjectName} Chapter ${chapter.chapterNumber} short questions, long questions and MCQs with answers.`, base, questions.length > 0 || mcqs.total > 0 || (topic.summary || "").length >= 80),
        updatedAt: topic.updatedAt,
    };
}

// The words a page uses for its syllabus, from populated board, class and subject records.
const labelsFrom = (board, cls, subject) => ({ boardName: board?.name || "", boardFull: boardFull(board), short: boardShort(board) || board?.name || "", className: cls?.name || "", classAlt: classNames(cls).alt, subjectName: subject?.name || "" });
const TEST_KIND = { subject_test: "Full Book", full_syllabus_test: "Full Syllabus", mock_test: "Mock", previous_paper_practice: "Past Paper Practice", chapter_test: "Chapter", topic_test: "Topic", custom_practice: "Practice" };
const titleCase = value => String(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, char => char.toUpperCase()).trim();

// Search-friendly title and a factual summary for a book, past paper or MCQ test, built from its real details.
// An admin's own summary (80+ characters) is always used instead of the generated one.
function resourceCopy(kind, doc, l, { chapters = [], chapter = null } = {}) {
    const who = [l.className, l.subjectName].filter(Boolean).join(" ");
    const whoAlt = [l.classAlt, l.subjectName].filter(Boolean).join(" ");
    const chapterList = chapters.length ? ` It covers ${plural(chapters.length, "chapter")}: ${chapters.slice(0, 12).map(item => `${item.chapterNumber}. ${item.name}`).join(", ")}${chapters.length > 12 ? " and more" : ""}.` : "";
    let title = "";
    let summary = "";
    if (kind === "book") {
        const extra = [doc.sourceName, doc.edition].filter(Boolean).join(", ");
        title = `${who} Textbook${extra ? ` (${extra})` : ""} – ${l.boardFull}`;
        summary = `The ${l.boardName} ${who} textbook (${whoAlt} book)${doc.sourceName ? ` by ${doc.sourceName}` : ""}${doc.edition ? `, ${doc.edition}` : ""}, to read online.${chapterList} Study each chapter with notes, short and long questions and MCQs with answers on IlmiDunya.`;
    } else if (kind === "past-paper") {
        const details = [titleCase(doc.examType), titleCase(doc.session)].filter(Boolean).join(", ");
        title = `${who} Past Paper ${doc.year || ""}${details ? ` (${details})` : ""}${doc.isNewPattern ? " New Pattern" : ""} – ${l.boardName}`.replace(/\s+/g, " ");
        summary = `${l.boardFull} ${who} (${whoAlt}) past paper from ${doc.year || "a previous year"}${doc.session ? `, ${titleCase(doc.session).toLowerCase()} session` : ""}${doc.examType ? `, ${titleCase(doc.examType).toLowerCase()} exam` : ""}${doc.isNewPattern ? ", new pattern" : ""}. See the real paper format and the kind of questions asked, then revise each chapter with notes and practise MCQs with answers.`;
    } else if (kind === "mcqs") {
        const count = doc.questions?.length || 0;
        const scope = chapter ? `Chapter ${chapter.chapterNumber} ${chapter.name} ` : "";
        title = `${who} ${scope}${TEST_KIND[doc.type] || ""} MCQ Test – ${l.boardName}`.replace(/\s+/g, " ");
        summary = `Online ${TEST_KIND[doc.type] ? `${TEST_KIND[doc.type].toLowerCase()} ` : ""}MCQ test for ${l.boardFull} ${who} (${whoAlt})${chapter ? `, Chapter ${chapter.chapterNumber}: ${chapter.name}` : ""}: ${plural(count, "MCQ")}${doc.durationMinutes ? ` in ${doc.durationMinutes} minutes` : ""}. Submit to see your score, the correct answers and explanations straight away.`;
    }
    return { title: title.trim(), summary };
}

const RESERVED = new Set(["learn", "news", "api", "admin", "assets", "uploads", "sitemaps", "subjects", "chapters", "topics", "videos", "book", "notes", "past-papers", "answer-sheet", "topic-questions", "login", "register", "forgot-password", "dashboard", "leaderboard", "tests", "assessments", "verify"]);

// Whether a path could be one of these pages (its first part is a board's address).
async function isSeoPath(path) {
    let first = String(path).split("/").filter(Boolean)[0];
    try { first = decodeURIComponent(first || "").toLowerCase(); } catch { return false; }
    if (!first || RESERVED.has(first)) return false;
    const cat = await catalog();
    return [...cat.boardSeg.values()].includes(first);
}

// Structured data describing only what the page shows.
function schemasFor(page, origin) {
    const url = new URL(page.meta.path, origin).href;
    const level = page.educationalLevel || undefined;
    const provider = { "@type": "Organization", name: "IlmiDunya", url: origin };
    const schemas = [];
    if (["seo-subject", "seo-chapter"].includes(page.kind)) schemas.push({ "@context": "https://schema.org", "@type": "Course", "@id": `${url}#course`, name: page.title, description: page.meta.description, url, provider, educationalLevel: level, inLanguage: "en", ...(page.updatedAt ? { dateModified: new Date(page.updatedAt).toISOString() } : {}) });
    if (["seo-chapter-notes", "seo-topic", "seo-subject-notes"].includes(page.kind)) schemas.push({ "@context": "https://schema.org", "@type": "LearningResource", "@id": `${url}#resource`, name: page.title, description: page.meta.description, url, provider, educationalLevel: level, learningResourceType: page.kind === "seo-topic" ? "Topic questions" : "Study notes", inLanguage: "en" });
    const mcqs = (page.mcqs || []).filter(item => item.questionText && item.options?.length && item.options.some(option => option.key === item.correctOption));
    if (mcqs.length && ["seo-chapter-mcqs", "seo-topic", "seo-subject-mcqs"].includes(page.kind)) {
        schemas.push({ "@context": "https://schema.org", "@type": "Quiz", "@id": `${url}#quiz`, name: page.title, about: page.scope, educationalLevel: level, provider,
            hasPart: mcqs.map(item => ({ "@type": "Question", eduQuestionType: "Multiple choice", text: item.questionText,
                suggestedAnswer: item.options.filter(option => option.key !== item.correctOption).map(option => ({ "@type": "Answer", text: option.text })),
                acceptedAnswer: { "@type": "Answer", text: item.options.find(option => option.key === item.correctOption).text, ...(item.explanation ? { answerExplanation: { "@type": "Comment", text: item.explanation } } : {}) } })) });
    }
    if (page.faqs?.length) schemas.push({ "@context": "https://schema.org", "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: page.faqs.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) });
    return schemas;
}

// Builds the page for a readable address, or a redirect to the right address.
async function seoPage(path, origin) {
    const page = await buildSeoPage(path);
    if (page.redirect) return page;
    const level = page.scope?.split(" · ")[0];
    page.educationalLevel = level;
    // The trail lists the parents; the page itself is added after them by the document renderer.
    page.breadcrumbs = page.breadcrumbs.slice(0, -1);
    page.sections = page.sections || [];
    page.actions = page.actions || [];
    page.structuredData = schemasFor(page, origin);
    return page;
}

async function buildSeoPage(path) {
    let parts;
    try { parts = String(path).split("/").filter(Boolean).map(part => decodeURIComponent(part).toLowerCase()); } catch { fail("Page not found.", 404); }
    const cat = await catalog();
    const board = [...cat.boards.values()].find(item => cat.boardSeg.get(id(item)) === parts[0]);
    if (!board) fail("Page not found.", 404);
    if (parts.length === 1) return boardPage(cat, board);
    const cls = [...cat.classes.values()].find(item => cat.classSeg.get(id(item)) === parts[1]);
    if (!cls) fail("Page not found.", 404);
    if (parts.length === 2) return boardClassPage(cat, board, cls);
    const subject = cat.subjects.find(item => id(item.board) === id(board) && id(item.class) === id(cls) && cat.subjectSeg.get(id(item)) === parts[2]);
    if (!subject) fail("Page not found.", 404);
    if (parts.length === 3) return subjectPage(cat, subject);
    if (parts.length === 4 && ["mcqs", "notes"].includes(parts[3])) return subjectPage(cat, subject, parts[3]);
    const chapterMatch = parts[3].match(/^chapter-(\d+)(?:-|$)/);
    if (!chapterMatch || parts.length > 5) fail("Page not found.", 404);
    const chapter = await Chapter.findOne({ subject: subject._id, chapterNumber: Number(chapterMatch[1]) }).lean();
    if (!chapter) fail("Page not found.", 404);
    const u = urls(cat);
    const rest = parts.slice(4);
    // A renamed chapter keeps working: the number finds it, then the address is corrected.
    if (parts[3] !== chapterSegment(chapter)) return { redirect: [u.chapter(subject, chapter), ...rest].join("/") };
    if (!rest.length) return chapterPage(cat, subject, chapter);
    if (["mcqs", "notes"].includes(rest[0])) return chapterPage(cat, subject, chapter, rest[0]);
    const topics = await Topic.find({ chapterId: chapter._id }).lean();
    const topic = topics.find(item => topicSegment(item) === rest[0]) || topics.find(item => item.topicNumber && rest[0].startsWith(`${String(item.topicNumber).replace(/[^0-9a-z]+/gi, "-")}-`));
    if (!topic) fail("Page not found.", 404);
    if (topicSegment(topic) !== rest[0]) return { redirect: u.topic(subject, chapter, topic) };
    return topicPage(cat, subject, chapter, topic);
}

// Readable addresses that replace the older /learn/{kind}/{id} pages.
async function legacyAddress(kind, doc) {
    const cat = await catalog();
    const u = urls(cat);
    if (kind === "board") return cat.boardSeg.get(id(doc)) ? u.board(doc) : null;
    const subjectId = kind === "subject" ? doc._id : kind === "topic" ? doc.subjectId : doc.subject;
    const subject = cat.subjects.find(item => id(item) === id(subjectId));
    if (!subject || !cat.boardSeg.get(id(subject.board)) || !cat.classSeg.get(id(subject.class))) return null;
    if (kind === "subject") return u.subject(subject);
    const chapterId = kind === "chapter" ? doc._id : kind === "topic" ? doc.chapterId : doc.chapter;
    const chapter = chapterId?.chapterNumber !== undefined ? chapterId : await Chapter.findById(id(chapterId)).select("name chapterNumber").lean();
    if (!chapter) return null;
    if (kind === "chapter") return u.chapter(subject, chapter);
    if (kind === "notes") return `${u.chapter(subject, chapter)}/notes`;
    if (kind === "topic") return u.topic(subject, chapter, doc);
    if (kind === "mcqs") {
        if (doc.type === "topic_test" && doc.topic) {
            const topic = doc.topic?.name ? doc.topic : await Topic.findById(id(doc.topic)).select("name topicNumber").lean();
            return topic ? u.topic(subject, chapter, topic) : `${u.chapter(subject, chapter)}/mcqs`;
        }
        if (doc.type === "chapter_test") return `${u.chapter(subject, chapter)}/mcqs`;
    }
    return null;
}

// Every readable address worth listing in the sitemap, with its last change.
async function seoSitemapEntries() {
    const cat = await catalog();
    const u = urls(cat);
    const entries = [];
    const subjects = cat.subjects.filter(subject => cat.boardSeg.get(id(subject.board)) && cat.classSeg.get(id(subject.class)));
    const boardIds = new Set(subjects.map(subject => id(subject.board)));
    const pairs = new Map(subjects.map(subject => [`${id(subject.board)}|${id(subject.class)}`, subject]));
    for (const boardId of boardIds) entries.push({ path: u.board(cat.boards.get(boardId)) });
    for (const subject of pairs.values()) entries.push({ path: u.boardClass(subject.board, subject.class) });
    const chapters = await Chapter.find({ subject: { $in: subjects.map(subject => subject._id) } }).select("name chapterNumber subject updatedAt").lean();
    const chapterIds = chapters.map(chapter => chapter._id);
    const [tests, notes, written, topics] = await Promise.all([
        Assessment.find({ ...openNow(), type: "topic_test", isAutoGenerated: { $ne: true }, createdBy: { $exists: true }, chapter: { $in: chapterIds } }).select("chapter topic").lean(),
        ChapterNote.find({ chapter: { $in: chapterIds } }).select("chapter updatedAt").lean(),
        Question.aggregate([{ $match: { chapter: { $in: chapterIds }, status: "published", contentType: { $in: ["short_question", "long_question"] } } }, { $group: { _id: { chapter: "$chapter", topic: "$topic" } } }]),
        Topic.find({ chapterId: { $in: chapterIds } }).select("name topicNumber chapterId updatedAt").lean(),
    ]);
    const mcqChapters = new Set(tests.map(test => id(test.chapter)));
    const mcqTopics = new Set(tests.map(test => id(test.topic)));
    const noteChapters = new Set([...notes.map(note => id(note.chapter)), ...written.map(row => id(row._id.chapter))]);
    const writtenTopics = new Set(written.map(row => id(row._id.topic)));
    const chapterById = new Map(chapters.map(chapter => [id(chapter), chapter]));
    const subjectById = new Map(subjects.map(subject => [id(subject), subject]));
    for (const subject of subjects) {
        const own = chapters.filter(chapter => id(chapter.subject) === id(subject));
        if (!own.length) continue;
        entries.push({ path: u.subject(subject), updatedAt: subject.updatedAt });
        if (own.some(chapter => mcqChapters.has(id(chapter)))) entries.push({ path: `${u.subject(subject)}/mcqs` });
        if (own.some(chapter => noteChapters.has(id(chapter)))) entries.push({ path: `${u.subject(subject)}/notes` });
    }
    const topicChapters = new Set(topics.map(topic => id(topic.chapterId)));
    for (const chapter of chapters) {
        const subject = subjectById.get(id(chapter.subject));
        const base = u.chapter(subject, chapter);
        // Only chapters with something to study; empty ones are still reachable but not listed.
        if (topicChapters.has(id(chapter)) || mcqChapters.has(id(chapter)) || noteChapters.has(id(chapter))) entries.push({ path: base, updatedAt: chapter.updatedAt });
        if (mcqChapters.has(id(chapter))) entries.push({ path: `${base}/mcqs` });
        if (noteChapters.has(id(chapter))) entries.push({ path: `${base}/notes` });
    }
    for (const topic of topics) {
        if (!mcqTopics.has(id(topic)) && !writtenTopics.has(id(topic))) continue;
        const chapter = chapterById.get(id(topic.chapterId));
        entries.push({ path: u.topic(subjectById.get(id(chapter.subject)), chapter, topic), updatedAt: topic.updatedAt });
    }
    return entries;
}

// Board + class hubs that exist, for site-wide navigation links.
async function hubLinks() {
    const cat = await catalog();
    const u = urls(cat);
    const pairs = new Map();
    for (const subject of cat.subjects) {
        const board = cat.boards.get(id(subject.board));
        const cls = cat.classes.get(id(subject.class));
        if (!board || !cls || !cat.boardSeg.get(id(board)) || !cat.classSeg.get(id(cls))) continue;
        const key = `${id(board)}|${id(cls)}`;
        if (!pairs.has(key)) pairs.set(key, { board: board.name, boardHref: u.board(board), class: cls.name, href: u.boardClass(board, cls), order: classNumber(cls) || 0 });
    }
    return [...pairs.values()].sort((a, b) => a.board.localeCompare(b.board) || a.order - b.order);
}

module.exports = { resourceCopy, labelsFrom, seoPage, isSeoPath, legacyAddress, seoSitemapEntries, hubLinks, subjectUrl, clearCatalog, PUBLIC_MCQS, chapterSegment, topicSegment, boardFull, classNames };
