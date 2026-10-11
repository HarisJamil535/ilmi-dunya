import Sidebar from "../components/AdminSidebar";
import { Outlet } from "react-router-dom";
import AdminBackButton from "../components/AdminBackButton";
import AdminToast from "../components/AdminToast";



const AdminLayout = () => {
  return (
    <div className="admin-theme-root flex h-screen overflow-hidden bg-slate-50">
       <Sidebar /> 
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto scroll-pt-20 p-3 pt-20 sm:p-4 sm:pt-20 md:scroll-pt-6 md:p-6">
        <AdminBackButton />
        <Outlet />
      </main>
      <AdminToast />
    </div>
  );
};

export default AdminLayout;
