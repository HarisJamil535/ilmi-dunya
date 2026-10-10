import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageLoadingContext } from "./pageLoading";
import PageLoader from "./PageLoader";

export default function PageLoadingProvider({ children }) {
  const { pathname, search } = useLocation();
  const route = pathname + search;
  const [pending, setPending] = useState({});
  const reportLoading = useCallback((id, loadingRoute, loading) => {
    setPending(current => {
      if (loading && current[id] === loadingRoute) return current;
      if (!loading && current[id] !== loadingRoute) return current;
      const next = { ...current };
      if (loading) next[id] = loadingRoute;
      else delete next[id];
      return next;
    });
  }, []);

  return <PageLoadingContext.Provider value={reportLoading}>
    {children}
    {Object.values(pending).includes(route) && <PageLoader />}
  </PageLoadingContext.Provider>;
}
