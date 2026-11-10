import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import axiosInstance from "../../api/axios";
import Loader from "../../shared/Loader";

const ProtectedRoutes = () => {
    const token = localStorage.getItem("adminToken");
    // "checking" | "allowed" | "denied" | "unreachable"
    // A signed-in admin whose details are saved sees the page at once; the session is confirmed in the
    // background and a rejected session still signs them out. This saves a full server round trip on every load.
    const [state, setState] = useState(() => {
        if (!token) return "denied";
        try { return JSON.parse(localStorage.getItem("adminUser") || "null")?.id ? "allowed" : "checking"; } catch { return "checking"; }
    });
    const [check, setCheck] = useState(0);
    const location = useLocation();

    useEffect(() => {
        if (!token) return undefined;
        let active = true;
        const verifyAdmin = async () => {
            try {
                const response = await axiosInstance.get("/admin/me");
                if (!active) return;
                const admin = response.data?.admin;
                if (!admin?.id) {
                    localStorage.removeItem("adminToken");
                    setState("denied");
                    return;
                }
                localStorage.setItem("adminUser", JSON.stringify(admin));
                setState("allowed");
            } catch (error) {
                if (!active) return;
                // Only a rejected session signs the admin out; a slow or failed connection keeps it for a retry.
                if ([401, 403].includes(error.response?.status)) {
                    localStorage.removeItem("adminToken");
                    localStorage.removeItem("adminUser");
                    setState("denied");
                } else {
                    // Already showing the page: keep it, the page's own requests show any connection problem.
                    setState((current) => (current === "allowed" ? current : "unreachable"));
                }
            }
        };
        verifyAdmin();
        return () => { active = false; };
    }, [token, check]);

    // Recheck quietly when the connection returns.
    useEffect(() => {
        if (state !== "unreachable") return undefined;
        const recheck = () => setCheck((value) => value + 1);
        window.addEventListener("app-network-restored", recheck);
        return () => window.removeEventListener("app-network-restored", recheck);
    }, [state]);

    const retry = () => {
        setState("checking");
        setCheck((value) => value + 1);
    };

    if (state === "checking") return <Loader />;

    if (state === "unreachable") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
                <section role="alert" className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-black text-slate-950">Unable to reach the server</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500">You are still signed in. Check your connection and try again.</p>
                    <button type="button" onClick={retry} className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white">Try again</button>
                </section>
            </main>
        );
    }

    if (state === "denied") {
        return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
};

export default ProtectedRoutes;
