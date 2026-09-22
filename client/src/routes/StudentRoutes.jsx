import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import StudentLayout from "../student/layout/StudentLayout";
import NotFound from '../shared/NotFound';
import PageLoader from "../shared/PageLoader";
import StudentProtectedRoute from "../student/components/StudentProtectedRoute";

const Chapters = lazy(() => import("../student/pages/Chapters"));
const Home = lazy(() => import("../student/pages/Home"));
const Subjects = lazy(() => import("../student/pages/Subjects"));
const Videos = lazy(() => import("../student/pages/Videos"));
const BookViewer = lazy(() => import("../student/pages/BookViewer"));
const PastPapers = lazy(() => import("../student/pages/PastPapers"));
const ChapterNotes = lazy(() => import("../student/pages/ChapterNotes"));
const StudentLogin = lazy(() => import("../student/pages/StudentLogin"));
const StudentRegister = lazy(() => import("../student/pages/StudentRegister"));
const ForgotPassword = lazy(() => import("../student/pages/ForgotPassword"));
const StudentDashboard = lazy(() => import("../student/pages/StudentDashboard"));
const Leaderboard = lazy(() => import("../student/pages/Leaderboard"));
const AssessmentList = lazy(() => import("../student/pages/AssessmentList"));
const AssessmentPlayer = lazy(() => import("../student/pages/AssessmentPlayer"));
const AssessmentResult = lazy(() => import("../student/pages/AssessmentResult"));
const TestStart = lazy(() => import("../student/pages/TestStart"));
const News = lazy(() => import("../student/pages/News"));
const NewsArticle = lazy(() => import("../student/pages/NewsArticle"));
const TopicQuestions = lazy(() => import("../student/pages/TopicQuestions"));
const PublicStudyPage = lazy(() => import("../student/pages/PublicStudyPage"));

const StudentRoutes = ({ initialData, initialView }) => {
  const HomeView = initialData?.type === 'home' ? initialView : Home;
  const NewsView = initialData?.type === 'news' ? initialView : News;
  const ArticleView = initialData?.type === 'article' ? initialView : NewsArticle;
  const StudyView = initialData?.type === 'study' ? initialView : PublicStudyPage;
  return (
    <Suspense fallback={<PageLoader label="Preparing your study space..." />}>
      <Routes>
        <Route element={<StudentLayout />}>
          <Route path="/" element={<HomeView initialData={initialData?.type === 'home' ? initialData : undefined} />} />
          <Route path="/learn/*" element={<StudyView initialData={initialData?.type === 'study' ? initialData : undefined} />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/topics" element={<Videos />} />
          <Route path="/chapters" element={<Chapters />} />
          <Route path="/book" element={<BookViewer />} />
          <Route path="/past-papers" element={<PastPapers />} />
          <Route path="/notes" element={<ChapterNotes />} />
          <Route path="/login" element={<StudentLogin />} />
          <Route path="/register" element={<StudentRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/tests" element={<AssessmentList />} />
          <Route path="/assessments" element={<AssessmentList />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/news" element={<NewsView initialData={initialData?.type === 'news' ? initialData : undefined} />} />
          <Route path="/news/:slug" element={<ArticleView initialData={initialData?.type === 'article' ? initialData : undefined} />} />
          <Route path="/topic-questions" element={<TopicQuestions />} />
          <Route element={<StudentProtectedRoute />}>
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/tests/start" element={<TestStart />} />
            <Route path="/tests/:id/take" element={<AssessmentPlayer />} />
            <Route path="/tests/result/:attemptId" element={<AssessmentResult />} />
            <Route path="/assessments/:id/take" element={<AssessmentPlayer />} />
            <Route path="/assessments/result/:attemptId" element={<AssessmentResult />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default StudentRoutes;
