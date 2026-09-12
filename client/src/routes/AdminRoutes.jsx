import { Routes, Route } from "react-router-dom";

import AdminLayout from "../admin/layout/AdminLayout";
import AdminLogin from "../admin/pages/AdminLogin";
import AdminDashboard from "../admin/pages/AdminDashboard";
import ProtectedRoutes from "../admin/components/ProtectedRoutes";
import AddClass from "../admin/pages/AddClass";
import AddBoards from "../admin/pages/AddBoards";
import AddGroup from "../admin/pages/AddGroup";
import SubjectManagement from '../admin/pages/SubjectManagement';
import ChapterManagement from "@/admin/pages/ChapterManagement";
import TopicManagement from "@/admin/pages/TopicsManagement";

const AdminRoutes = () => {
    return (
        <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />

            <Route element={<ProtectedRoutes />}>
                <Route path="/admin" element={<AdminLayout />}>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="academic-structure/add-class" element={<AddClass />} />
                    <Route path="academic-structure/add-board" element={<AddBoards />} />
                    <Route path="academic-structure/add-group" element={<AddGroup />} />
                    <Route path="academic-structure/manage-subject" element={<SubjectManagement />} />
                    <Route path="academic-structure/manage-chapters" element={<ChapterManagement />} />
                    <Route path="academic-structure/manage-topics" element={<TopicManagement />} />
                    <Route path="chapters/:chapterId/topics" element={<TopicManagement />} />
                </Route>
            </Route>

            <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
    );
};

export default AdminRoutes;