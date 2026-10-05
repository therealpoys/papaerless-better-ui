import { useCallback, useEffect, useState } from "react";
import { buildPath, parseRoute, type Route } from "./route";

function current(): Route {
  return parseRoute(window.location.pathname, window.location.search);
}

/**
 * Die URL ist die einzige Quelle für "wo bin ich": Navigieren schreibt per History-API,
 * Zurück/Vor (popstate) und F5 lesen sie wieder aus.
 */
export function useRoute(): [Route, (route: Route, options?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<Route>(current);

  useEffect(() => {
    const onPop = () => setRoute(current());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const path = buildPath(next);
    if (path !== window.location.pathname + window.location.search) {
      window.history[options?.replace ? "replaceState" : "pushState"](null, "", path);
    }
    setRoute(next);
  }, []);

  return [route, navigate];
}
