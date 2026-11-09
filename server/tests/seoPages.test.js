const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Board = require("../src/models/Board");
const ClassModel = require("../src/models/Class");
const Group = require("../src/models/Group");
const Subject = require("../src/models/Subject");
const Chapter = require("../src/models/Chapter");
const Topic = require("../src/models/Topic");
const ChapterNote = require("../src/models/ChapterNote");
const Book = require("../src/models/Book");
const PastPaper = require("../src/models/PastPaper");
const Assessment = require("../src/models/Assessment");
const Question = require("../src/models/Question");
const { seoPage, isSeoPath, legacyAddress, chapterSegment, topicSegment, clearCatalog } = require("../src/services/seoPages");

const oid = () => new mongoose.Types.ObjectId();
const chain = value => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, populate() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
afterEach(() => { mock.restoreAll(); clearCatalog(); });

const ids = { fed: oid(), c9: oid(), sci: oid(), arts: oid(), cs: oid(), mathSci: oid(), mathArts: oid(), ch3: oid(), t1: oid(), q1: oid() };
function seed({ tests = [], mcqs = [], books = [], papers = [] } = {}) {
    mock.method(Board, "find", () => chain([{ _id: ids.fed, name: "Federal Board" }]));
    mock.method(ClassModel, "find", () => chain([{ _id: ids.c9, name: "Class 9" }]));
    mock.method(Group, "find", () => chain([{ _id: ids.sci, name: "Science" }, { _id: ids.arts, name: "Arts" }]));
    mock.method(Subject, "find", () => chain([
        { _id: ids.cs, name: "Computer Science", board: ids.fed, class: ids.c9, group: ids.sci },
        { _id: ids.mathSci, name: "Mathematics", board: ids.fed, class: ids.c9, group: ids.sci },
        { _id: ids.mathArts, name: "Mathematics", board: ids.fed, class: ids.c9, group: ids.arts },
    ]));
    const chapter = { _id: ids.ch3, name: "Programming Fundamentals", chapterNumber: 3, subject: ids.cs };
    mock.method(Chapter, "find", () => chain([chapter]));
    mock.method(Chapter, "findOne", filter => chain(filter.chapterNumber === 3 && String(filter.subject) === String(ids.cs) ? chapter : null));
    mock.method(Topic, "find", () => chain([{ _id: ids.t1, name: "Algorithms", topicNumber: "3.1", chapterId: ids.ch3 }]));
    mock.method(Topic, "aggregate", async () => [{ _id: ids.ch3, count: 1 }]);
    mock.method(ChapterNote, "find", () => chain([{ chapter: ids.ch3, noteType: "exercise", title: "Exercise" }]));
    mock.method(Assessment, "find", () => chain(tests));
    mock.method(Question, "find", filter => chain(filter.contentType?.$in ? [] : mcqs));
    mock.method(Question, "aggregate", async () => []);
    mock.method(Book, "find", () => chain(books));
    mock.method(Book, "distinct", async () => (books.length ? [ids.cs] : []));
    mock.method(PastPaper, "find", () => chain(papers));
    mock.method(PastPaper, "distinct", async () => (papers.length ? [ids.cs] : []));
}

test("addresses read like searches and tell same-named subjects apart by group", async () => {
    seed();
    assert.equal(chapterSegment({ chapterNumber: 3, name: "Programming Fundamentals" }), "chapter-3-programming-fundamentals");
    assert.equal(topicSegment({ topicNumber: "3.1", name: "Algorithms & Flowcharts" }), "3-1-algorithms-flowcharts");
    assert.equal(await isSeoPath("/federal-board/class-9"), true);
    assert.equal(await isSeoPath("/Federal-Board"), true, "capital letters are recognised, then redirected");
    assert.equal(await isSeoPath("/dashboard"), false);
    assert.equal(await isSeoPath("/tests/start"), false);
    const hub = await seoPage("/federal-board/class-9", "https://ilmidunya.org");
    const hrefs = hub.sections[0].links.map(link => link.href);
    assert.ok(hrefs.includes("/federal-board/class-9/computer-science"));
    assert.equal(hrefs.filter(href => href.startsWith("/federal-board/class-9/mathematics-")).length, 2, "two Mathematics subjects get distinct addresses");
    assert.ok(hrefs.includes("/federal-board/class-9/mathematics-arts"));
});

test("titles, headings and descriptions use the words students search with", async () => {
    seed();
    const hub = await seoPage("/federal-board/class-9", "https://ilmidunya.org");
    assert.match(hub.meta.title, /Federal Board Class 9 \(9th Class\) Notes, MCQs & Past Papers/);
    const subject = await seoPage("/federal-board/class-9/computer-science", "https://ilmidunya.org");
    assert.match(subject.meta.title, /^Class 9 Computer Science Notes, MCQs & Past Papers – Federal Board \(FBISE\)$/);
    assert.match(subject.meta.description, /9th Class Computer Science/);
    assert.ok(subject.meta.indexable);
    const notes = await seoPage("/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/notes", "https://ilmidunya.org");
    assert.equal(notes.meta.title, "Class 9 Computer Science Chapter 3 Notes – Short & Long Questions, Exercise | FBISE");
    assert.match(notes.meta.description, /Chapter 3 \(Unit 3\) Programming Fundamentals notes: short questions, long questions/);
    assert.equal(notes.questionLabel, "Class 9 Computer Science Chapter 3");
    assert.ok(notes.notes.find(note => note.type === "exercise").available);
    assert.deepEqual(notes.breadcrumbs.map(item => item.title), ["Home", "Federal Board", "Class 9", "Computer Science", "Chapter 3"], "the page itself is added after its parents when rendered");
});

test("MCQ pages show only live, published MCQs with their answers, marked up as a quiz", async () => {
    const mcq = { _id: ids.q1, questionText: "Which symbol starts a flowchart?", options: [{ key: "A", text: "Oval" }, { key: "B", text: "Diamond" }], correctOption: "A", explanation: "Ovals mark start and end.", topic: ids.t1 };
    seed({ tests: [{ topic: ids.t1, questions: [{ question: ids.q1, order: 1 }] }], mcqs: [mcq] });
    const page = await seoPage("/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/mcqs", "https://ilmidunya.org");
    assert.equal(page.meta.title, "Class 9 Computer Science Chapter 3 MCQs with Answers – Programming Fundamentals | FBISE");
    assert.equal(page.mcqs.length, 1);
    assert.equal(page.mcqs[0].correctOption, "A");
    const quiz = page.structuredData.find(item => item["@type"] === "Quiz");
    assert.equal(quiz.hasPart[0].acceptedAnswer.text, "Oval");
    assert.equal(quiz.hasPart[0].suggestedAnswer[0].text, "Diamond");
    const filter = Assessment.find.mock.calls[0].arguments[0];
    assert.equal(filter.status, "published", "only tests open to students");
    assert.equal(filter.type, "topic_test");

    seed();
    const empty = await seoPage("/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/mcqs", "https://ilmidunya.org");
    assert.equal(empty.meta.indexable, false, "a chapter without published MCQs is not offered to search engines");
});

test("renamed chapters and old addresses lead to the current page; unknown ones are not found", async () => {
    seed();
    assert.deepEqual(await seoPage("/federal-board/class-9/computer-science/chapter-3-old-title/mcqs", "https://ilmidunya.org"), { redirect: "/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/mcqs" });
    assert.deepEqual(await seoPage("/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/3-1-old", "https://ilmidunya.org"), { redirect: "/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/3-1-algorithms" });
    for (const path of ["/federal-board/class-10", "/federal-board/class-9/history", "/federal-board/class-9/computer-science/chapter-9-x", "/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/mcqs/extra/more", "/federal-board/%E0%A4%A"]) {
        await assert.rejects(seoPage(path, "https://ilmidunya.org"), { status: 404 }, path);
    }
    assert.equal(await legacyAddress("subject", { _id: ids.cs }), "/federal-board/class-9/computer-science");
    assert.equal(await legacyAddress("notes", { subject: ids.cs, chapter: { _id: ids.ch3, name: "Programming Fundamentals", chapterNumber: 3 } }), "/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/notes");
    assert.equal(await legacyAddress("topic", { name: "Algorithms", topicNumber: "3.1", subjectId: ids.cs, chapterId: { _id: ids.ch3, name: "Programming Fundamentals", chapterNumber: 3 } }), "/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/3-1-algorithms");
    assert.equal(await legacyAddress("mcqs", { type: "mock_test", subject: ids.cs, chapter: { _id: ids.ch3, name: "x", chapterNumber: 3 } }), null, "other tests keep their own page");
});

test("books, past papers and tests get search-friendly titles and summaries when the admin wrote none", () => {
    const { resourceCopy, labelsFrom } = require("../src/services/seoPages");
    const l = labelsFrom({ name: "Federal Board" }, { name: "Class 9" }, { name: "Computer Science" });
    const book = resourceCopy("book", { sourceName: "National Book Foundation" }, l, { chapters: [{ chapterNumber: 1, name: "Introduction" }, { chapterNumber: 3, name: "Programming Fundamentals" }] });
    assert.equal(book.title, "Class 9 Computer Science Textbook (National Book Foundation) – Federal Board (FBISE)");
    assert.match(book.summary, /9th Class Computer Science book/);
    assert.match(book.summary, /3\. Programming Fundamentals/);
    assert.ok(book.summary.length >= 80, "long enough to be shown and indexed");
    const paper = resourceCopy("past-paper", { year: 2024, session: "morning", examType: "annual" }, l);
    assert.equal(paper.title, "Class 9 Computer Science Past Paper 2024 (Annual, Morning) – Federal Board");
    const test = resourceCopy("mcqs", { type: "subject_test", questions: new Array(40), durationMinutes: 45 }, l);
    assert.equal(test.title, "Class 9 Computer Science Full Book MCQ Test – Federal Board");
    assert.match(test.summary, /40 MCQs in 45 minutes/);
});

test("a subject has readable past-paper and textbook pages, listed in the sitemap only when they have content", async () => {
    const { seoSitemapEntries } = require("../src/services/seoPages");
    seed();
    assert.ok(!(await seoSitemapEntries()).some(entry => /past-papers|books/.test(entry.path)), "nothing to list yet");
    const empty = await seoPage("/federal-board/class-9/computer-science/past-papers", "https://ilmidunya.org");
    assert.equal(empty.meta.indexable, false);
    mock.restoreAll(); clearCatalog();
    seed({ papers: [{ _id: oid(), year: 2024, session: "annual", examType: "morning", slug: "p1" }, { _id: oid(), year: 2023, session: "annual", slug: "p2" }], books: [{ _id: oid(), title: "CS 9", sourceName: "National Book Foundation", slug: "b" }] });
    const papers = await seoPage("/federal-board/class-9/computer-science/past-papers", "https://ilmidunya.org");
    assert.equal(papers.meta.title, "Class 9 Computer Science Past Papers 2023-2024 – Federal Board (FBISE)");
    assert.deepEqual(papers.sections.map(section => section.title), ["Class 9 Computer Science past paper 2024", "Class 9 Computer Science past paper 2023"]);
    assert.equal(papers.meta.indexable, true);
    const books = await seoPage("/federal-board/class-9/computer-science/books", "https://ilmidunya.org");
    assert.match(books.meta.title, /^Class 9 Computer Science Book – Federal Board \(FBISE\) Textbook Online$/);
    assert.match(books.meta.description, /by National Book Foundation/);
    const paths = (await seoSitemapEntries()).map(entry => entry.path);
    assert.ok(paths.includes("/federal-board/class-9/computer-science/past-papers") && paths.includes("/federal-board/class-9/computer-science/books"));
    const subject = await seoPage("/federal-board/class-9/computer-science", "https://ilmidunya.org");
    assert.ok(subject.quickLinks.some(link => link.href.endsWith("/past-papers")) && subject.quickLinks.some(link => link.href.endsWith("/books")));
});

test("chapter pages link to every other chapter of the subject and cut descriptions at a word", async () => {
    seed();
    mock.method(Chapter, "find", () => chain([{ _id: ids.ch3, name: "Programming Fundamentals", chapterNumber: 3, subject: ids.cs }, { _id: oid(), name: "Data Types", chapterNumber: 4, subject: ids.cs }]));
    const page = await seoPage("/federal-board/class-9/computer-science/chapter-3-programming-fundamentals/notes", "https://ilmidunya.org");
    const all = page.sections.find(section => section.title.startsWith("All Class 9 Computer Science chapters"));
    assert.ok(all, "the all-chapters block exists");
    assert.equal(all.hub.href, "/federal-board/class-9/computer-science/notes");
    assert.deepEqual(all.links.map(link => link.href), ["/federal-board/class-9/computer-science/chapter-4-data-types/notes"]);
    assert.ok(page.meta.description.length <= 160);
    assert.doesNotMatch(page.meta.description, /\s…$/);
});
