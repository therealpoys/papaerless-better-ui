import type { Route } from "./route";

export type BackAction = { type: "navigate"; route: Route } | { type: "exit" };

/**
 * Was die Hardware-Zurück-Taste tut: erst Detail schließen bzw. eine Ebene hoch,
 * dann zurück zur Startseite, dort die App beenden.
 */
export function resolveBackAction(route: Route): BackAction {
  if (route.tab === "documents") {
    if (route.documentId !== null) return { type: "navigate", route: { ...route, documentId: null } };
  } else if (route.tab === "folders") {
    if (route.documentId !== null) return { type: "navigate", route: { ...route, documentId: null } };
    if (route.folderId !== null) return { type: "navigate", route: { tab: "folders", folderId: null, documentId: null } };
  }
  if (route.tab === "home") return { type: "exit" };
  return { type: "navigate", route: { tab: "home" } };
}
