import { useEffect, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { isNative } from "./platform";
import { resolveBackAction } from "./backNavigation";
import type { Route } from "./route";

/** Koppelt die Android-Zurück-Taste an die Routenlogik. Im Browser ohne Wirkung. */
export function useNativeBack(route: Route, navigate: (route: Route, options?: { replace?: boolean }) => void) {
  const routeRef = useRef(route);
  routeRef.current = route;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!isNative()) return;
    const handle = CapacitorApp.addListener("backButton", () => {
      const action = resolveBackAction(routeRef.current);
      if (action.type === "exit") void CapacitorApp.exitApp();
      else navigateRef.current(action.route);
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
}
