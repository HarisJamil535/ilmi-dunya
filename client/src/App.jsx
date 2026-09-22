import { BrowserRouter, useLocation } from "react-router-dom";
import StudentRoutes from "./routes/StudentRoutes";
import AdminRoutes from "./routes/AdminRoutes";
import { useLayoutEffect } from "react";
import { applyMetadata, initialPage } from "./seo/pageMetadata";

function AppRoutes({ initialData, initialView }) {
  const location = useLocation();
  useLayoutEffect(() => {
    const seed = initialPage();
    if (seed?.meta) applyMetadata(seed.meta);
    else applyMetadata({ title: "IlmiDunya", description: "Study resources and MCQ practice for Pakistani board students.", path: location.pathname + location.search, indexable: ["/", "/news", "/learn"].includes(location.pathname) && !location.search });
    if (!location.pathname.startsWith("/news/")) document.getElementById("news-article-schema")?.remove();
    document.getElementById("public-page-schema")?.remove();
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.dataset.appReady = 'true';
  }, [location.pathname, location.search]);
  return location.pathname.startsWith("/admin") ? <AdminRoutes /> : <StudentRoutes initialData={initialData} initialView={initialView} />;
}

function App({ initialData, initialView, routerComponent, routerProps = {} }) {
  const Router = routerComponent || BrowserRouter;
  return (
    <Router {...routerProps}>
      <AppRoutes initialData={initialData} initialView={initialView} />
    </Router>
  );
}

export default App;
