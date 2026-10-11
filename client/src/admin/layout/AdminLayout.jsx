import Sidebar from "../components/AdminSidebar";
import { Outlet } from "react-router-dom";
import AdminBackButton from "../components/AdminBackButton";
import AdminToast from "../components/AdminToast";
import { useLayoutEffect } from "react";



const AdminLayout = () => {
  useLayoutEffect(() => {
    document.documentElement.dataset.adminWorkspace = "true";
    return () => { delete document.documentElement.dataset.adminWorkspace; };
  }, []);

  return (
    <div className="admin-theme-root fixed inset-0 flex h-dvh min-h-0 overflow-hidden bg-bg-main">
       <Sidebar /> 
      <main aria-label="Admin workspace" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain scroll-pt-20 p-3 pt-20 sm:p-4 sm:pt-20 md:scroll-pt-6 md:p-6">
        <AdminBackButton />
        <Outlet />
      </main>
      <AdminToast />
    </div>
  );
};

export default AdminLayout;
