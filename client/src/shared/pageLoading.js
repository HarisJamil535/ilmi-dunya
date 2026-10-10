import { createContext, useContext, useEffect, useId, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const PageLoadingContext = createContext(null);

export function usePageLoading(loading) {
  const reportLoading = useContext(PageLoadingContext);
  const { pathname, search } = useLocation();
  const route = pathname + search;
  const id = useId();
  const [finishedRoute, setFinishedRoute] = useState(null);

  // Once this route is ready, background refreshes use the section's spinner.
  useEffect(() => {
    if (loading) return;
    const frame = requestAnimationFrame(() => setFinishedRoute(route));
    return () => cancelAnimationFrame(frame);
  }, [loading, route]);

  useLayoutEffect(() => {
    if (!reportLoading || !loading || finishedRoute === route) return;
    reportLoading(id, route, true);
    return () => reportLoading(id, route, false);
  }, [reportLoading, id, route, loading, finishedRoute]);
}
