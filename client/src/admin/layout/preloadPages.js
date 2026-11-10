// Loads the code for every admin page in the background once the first page is on screen, so moving
// between pages from the menu is instant instead of waiting for a download each time.
const pages = [
  () => import("../pages/AdminDashboard"),
  () => import("../pages/SubjectManagement"),
  () => import("../pages/ChapterManagement"),
  () => import("../pages/TopicsManagement"),
  () => import("../pages/QuestionBankManagement"),
  () => import("../pages/AssessmentBuilder"),
  () => import("../pages/TestPublishing"),
  () => import("../pages/BookManagement"),
  () => import("../pages/NotesManagement"),
  () => import("../pages/PastPaperManagement"),
  () => import("../pages/AnswerSheetManagement"),
  () => import("../pages/NewsManagement"),
  () => import("../pages/AssessmentAnalytics"),
  () => import("../pages/StudentManagement"),
  () => import("../pages/SchoolManagement"),
  () => import("../pages/SchoolResults"),
  () => import("../pages/HomeStatsManagement"),
  () => import("../pages/TestimonialsManagement"),
  () => import("../pages/AdminManagement"),
  () => import("../pages/AddBoards"),
  () => import("../pages/AddClass"),
  () => import("../pages/AddGroup"),
  () => import("../paperMaker/PaperList"),
  () => import("../pba/PbaManagement"),
  () => import("../paperMaker/PaperEditor"),
  () => import("../paperMaker/PbaPaperEditor"),
];

let started = false;
export function preloadAdminPages() {
  if (started || typeof window === "undefined") return;
  // Skip on slow or data-saving connections.
  const connection = navigator.connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
  started = true;
  const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 300));
  const next = (index) => {
    if (index >= pages.length) return;
    idle(() => { pages[index]().catch(() => {}).finally(() => next(index + 1)); }, { timeout: 2000 });
  };
  setTimeout(() => next(0), 1200);
}
