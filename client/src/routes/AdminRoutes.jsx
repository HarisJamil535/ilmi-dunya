import { lazy, Suspense } from "react";
import { Navigate, Routes, Route } from "react-router-dom";

import AdminLayout from "../admin/layout/AdminLayout";
import ProtectedRoutes from "../admin/components/ProtectedRoutes";
import PageLoader from "../shared/PageLoader";

const AdminLogin = lazy(() => import("../admin/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("../admin/pages/AdminDashboard"));
const AddClass = lazy(() => import("../admin/pages/AddClass"));
const AddBoards = lazy(() => import("../admin/pages/AddBoards"));
const AddGroup = lazy(() => import("../admin/pages/AddGroup"));
const SubjectManagement = lazy(() => import("../admin/pages/SubjectManagement"));
const ChapterManagement = lazy(() => import("@/admin/pages/ChapterManagement"));
const TopicManagement = lazy(() => import("@/admin/pages/TopicsManagement"));
const BookManagement = lazy(() => import("@/admin/pages/BookManagement"));
const PastPaperManagement = lazy(() => import("@/admin/pages/PastPaperManagement"));
const NotesManagement = lazy(() => import("@/admin/pages/NotesManagement"));
const HomeStatsManagement = lazy(() => import("@/admin/pages/HomeStatsManagement"));
const TestimonialsManagement = lazy(() => import("@/admin/pages/TestimonialsManagement"));
const QuestionBankManagement = lazy(() => import("@/admin/pages/QuestionBankManagement"));
const AssessmentBuilder = lazy(() => import("@/admin/pages/AssessmentBuilder"));
const AssessmentAnalytics = lazy(() => import("@/admin/pages/AssessmentAnalytics"));
const NewsManagement = lazy(() => import("@/admin/pages/NewsManagement"));
const AdminManagement = lazy(() => import("@/admin/pages/AdminManagement"));

const AdminRoutes = () => {
    return (
        <Suspense fallback={<PageLoader label="Loading admin workspace..." />}>
            <Routes>
                <Route path="/admin/login" element={<AdminLogin />} />

                <Route element={<ProtectedRoutes />}>
                    <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="academic-structure/add-class" element={<AddClass />} />
                        <Route path="academic-structure/add-board" element={<AddBoards />} />
                        <Route path="academic-structure/add-group" element={<AddGroup />} />
                        <Route path="academic-structure/manage-subject" element={<SubjectManagement />} />
                        <Route path="academic-structure/manage-chapters" element={<ChapterManagement />} />
                        <Route path="academic-structure/manage-topics" element={<TopicManagement />} />
                        <Route path="academic-structure/manage-books" element={<BookManagement />} />
                        <Route path="academic-structure/manage-past-papers" element={<PastPaperManagement />} />
                        <Route path="academic-structure/manage-notes" element={<NotesManagement />} />
                        <Route path="home-content/stats" element={<HomeStatsManagement />} />
                        <Route path="home-content/testimonials" element={<TestimonialsManagement />} />
                        <Route path="home-content/news" element={<NewsManagement />} />
                        <Route path="assessments/questions" element={<QuestionBankManagement />} />
                        <Route path="assessments/builder" element={<AssessmentBuilder />} />
                        <Route path="assessments/analytics" element={<AssessmentAnalytics />} />
                        <Route path="chapters/:chapterId/topics" element={<TopicManagement />} />
                        <Route path="admin-management" element={<AdminManagement />} />
                    </Route>
                </Route>

                <Route path="/admin/*" element={<div>404 Not Found</div>} />
            </Routes>
        </Suspense>
    );
};

export default AdminRoutes;
