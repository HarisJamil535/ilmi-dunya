import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";

const StudentLayout = () => {
  return (
    <>
      <Navbar />
      <main className="client-main min-h-screen bg-slate-50">

        <Outlet />
      </main>
      <Footer />
    </>
  );
};

export default StudentLayout;
