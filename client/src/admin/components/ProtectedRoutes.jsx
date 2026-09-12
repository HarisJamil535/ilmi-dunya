import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import axiosInstance from "../../api/axios";
import Loader from "../../shared/Loader";

const ProtectedRoutes = () => {
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

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
                await axiosInstance.get("/admin/me");

                setIsAuthenticated(true);
            } catch (error) {
                localStorage.removeItem("adminToken");
                console.error("Authentication Error:", error.response?.data?.message || error.message);
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
        return <Navigate to="/admin/login" replace />;
    }

    // Allow access
    return <Outlet />;
};

export default ProtectedRoutes;