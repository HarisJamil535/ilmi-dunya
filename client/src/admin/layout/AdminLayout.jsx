import Sidebar from "../components/AdminSidebar";
import { Outlet } from "react-router-dom";



const AdminLayout = () => {
  return (
    <div className="flex">
       <Sidebar /> 
      <main className="flex-1 p-6">
     
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;