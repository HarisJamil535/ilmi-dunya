import { Navigate, Outlet, useLocation } from "react-router-dom";

const StudentProtectedRoute = () => {
  const location = useLocation();
  const token = localStorage.getItem("studentToken");

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
};

export default StudentProtectedRoute;
