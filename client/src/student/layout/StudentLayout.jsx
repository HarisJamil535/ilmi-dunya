import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";

const StudentLayout = () => {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-100 dark:bg-gray-900">

        <Outlet />
      </main>
      <Footer />
    </>
  );
};

export default StudentLayout;