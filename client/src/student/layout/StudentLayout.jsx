import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Outlet, useLocation } from "react-router-dom";
import StudentToast from "../../shared/StudentToast";
import { ThemeProvider } from "../../theme/ThemeProvider";

const StudentLayout = () => {
  const { pathname } = useLocation();
  const isAuthPage = ["/login", "/register", "/forgot-password"].includes(pathname);

  if (isAuthPage) {
    return <ThemeProvider scope="client"><StudentToast /><Outlet /></ThemeProvider>;
  }

  return (
    <ThemeProvider scope="client">
      <StudentToast />
      <Navbar />
      <main className="client-main min-h-screen bg-slate-50">

        <Outlet />
      </main>
      <Footer />
    </ThemeProvider>
  );
};

export default StudentLayout;
