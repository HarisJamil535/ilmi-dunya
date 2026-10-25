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
    const studentPaths = ["/attempts", "/student-dashboard", "/students/me", "/leaderboard/me", "/resources/books", "/resources/chapter-notes", "/resources/answer-sheets"];
    const isStudentRequest = !isAdminRequest && studentPaths.some((path) => url.startsWith(path));
    const token = isStudentRequest ? localStorage.getItem("studentToken") : isAdminRequest ? localStorage.getItem("adminToken") : null;
    config.authAudience = isStudentRequest ? 'student' : isAdminRequest ? 'admin' : null;
    if (config.method === 'get' && config.timeout === 20000) config.timeout = 45000;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        const canceled = axios.isCancel(error) || config?.signal?.aborted;
        const temporary = !error.response || [502, 503, 504].includes(error.response.status);
        const safeRead = config?.method === 'get' && !/^\/?(attempts|students|admin|student-dashboard)(\/|\?|$)/.test(config.url || '');
        if (!canceled && temporary && safeRead && !config.networkRetried && navigator.onLine) {
            config.networkRetried = true;
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
            if (config.signal?.aborted) return Promise.reject(error);
            return axiosInstance.request(config);
        }
        // Callers that retry on their own (such as answer saving in a test) pass quietNetwork.
        if (!canceled && temporary && !config?.quietNetwork && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app-network-error', { detail: { service: Boolean(error.response) } }));
        }
        const status = error.response?.status;
        // A blocked student is signed out and told why, wherever the request came from.
        if (status === 403 && error.response?.data?.code === "ACCOUNT_BLOCKED" && typeof window !== "undefined") {
            if (localStorage.getItem("studentToken")) {
                localStorage.removeItem("studentToken");
                notifyStudentAuthChanged();
            }
            window.dispatchEvent(new CustomEvent("ilmidunya:account-blocked", { detail: error.response.data }));
        }
        const isAdminRequest = error.config?.authAudience === 'admin';
        const isStudentRequest = error.config?.authAudience === 'student';

        if (status === 401 && isStudentRequest) {
            localStorage.removeItem("studentToken");
            notifyStudentAuthChanged();
        } else if (status === 401 && isAdminRequest) {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("adminUser");
        }

        if ((status === 401 || status === 403 || status === 409 || status >= 500) && isAdminRequest && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("admin-toast", {
                detail: { type: "error", message: error.response?.data?.message || "Something went wrong. Please try again." },
            }));
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
