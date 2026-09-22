import Sidebar from "../components/AdminSidebar";
import { Outlet } from "react-router-dom";
import AdminBackButton from "../components/AdminBackButton";
import AdminToast from "../components/AdminToast";



const AdminLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
       <Sidebar /> 
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <AdminBackButton />
        <Outlet />
      </main>
      <AdminToast />
    </div>
  );
};

export default AdminLayout;
