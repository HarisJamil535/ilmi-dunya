import { Navigate, Outlet, useLocation } from "react-router-dom";

const StudentProtectedRoute = () => {
  const location = useLocation();
  const token = localStorage.getItem("studentToken");

  if (!token) {
    const returnTo = location.pathname + location.search;
    sessionStorage.setItem("studentReturnTo", returnTo);
    return <Navigate to="/login" replace state={{ from: returnTo }} />;
  }

  return <Outlet />;
};

export default StudentProtectedRoute;
