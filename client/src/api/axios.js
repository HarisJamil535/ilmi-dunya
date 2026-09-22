import axios from "axios";
import { notifyStudentAuthChanged } from "../auth/authEvents";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
    timeout: 20000,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add token automatically to every request
axiosInstance.interceptors.request.use((config) => {
    const url = config.url || "";
    const isAdminRequest = window.location.pathname.startsWith('/admin') || url.startsWith('/admin');
    const studentPaths = ["/attempts", "/student-dashboard", "/students/me", "/resources/books", "/resources/chapter-notes"];
    const isStudentRequest = !isAdminRequest && studentPaths.some((path) => url.startsWith(path));
    const token = isStudentRequest ? localStorage.getItem("studentToken") : isAdminRequest ? localStorage.getItem("adminToken") : null;
    config.authAudience = isStudentRequest ? 'student' : isAdminRequest ? 'admin' : null;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const isAdminRequest = error.config?.authAudience === 'admin';
        const isStudentRequest = error.config?.authAudience === 'student';

        if (status === 401 && isStudentRequest) {
            localStorage.removeItem("studentToken");
            notifyStudentAuthChanged();
        } else if (status === 401 && isAdminRequest) {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("adminUser");
        }

        if ((status === 401 || status === 403 || status >= 500) && isAdminRequest && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("admin-toast", {
                detail: { type: "error", message: error.response?.data?.message || "Something went wrong. Please try again." },
            }));
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
