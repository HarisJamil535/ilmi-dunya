import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import axiosInstance from "../../api/axios";
import Loader from "../../shared/Loader";

const ProtectedRoutes = () => {
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const location = useLocation();

    const token = localStorage.getItem("adminToken");

    useEffect(() => {
        const checkAdmin = async () => {
            // No token
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                // Axios interceptor automatically sends the token
                const response = await axiosInstance.get("/admin/me");
                const admin = response.data?.admin;

                if (!admin?.id) {
                    localStorage.removeItem("adminToken");
                    setIsAuthenticated(false);
                    return;
                }

                localStorage.setItem("adminUser", JSON.stringify(admin));
                setIsAuthenticated(true);
            } catch {
                localStorage.removeItem("adminToken");
                setIsAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };

        checkAdmin();
    }, [token]);

    // Show loading while checking authentication
    if (loading) {
        return <Loader/>;
    }

    // Redirect if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }

    // Allow access
    return <Outlet />;
};

export default ProtectedRoutes;
