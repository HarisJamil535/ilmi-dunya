import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";
import StudentToast from "../../shared/StudentToast";

const StudentLayout = () => {
  return (
    <>
      <StudentToast />
      <Navbar />
      <main className="client-main min-h-screen bg-slate-50">

        <Outlet />
      </main>
      <Footer />
    </>
  );
};

export default StudentLayout;
