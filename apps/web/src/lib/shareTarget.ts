import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNative } from "./platform";

/** Vom nativen Plugin in den Cache kopierte Datei, die per "Teilen mit…" ankam. */
export interface SharedFileInfo {
  path: string;
  name: string;
  type: string;
}

interface ShareTargetPlugin {
  getSharedFiles(): Promise<{ files: SharedFileInfo[] }>;
  addListener(event: "sharedFiles", cb: () => void): Promise<PluginListenerHandle>;
}

const ShareTarget = registerPlugin<ShareTargetPlugin>("ShareTarget");

/** Wandelt eine geteilte Datei (über ihre WebView-URL) in eine File für den Upload-Flow. */
export async function fileFromShared(
  info: SharedFileInfo,
  toUrl: (path: string) => string = Capacitor.convertFileSrc,
  fetchFn: typeof fetch = fetch,
): Promise<File> {
  const res = await fetchFn(toUrl(info.path));
  const blob = await res.blob();
  const type = info.type || blob.type || "application/octet-stream";
  return new File([blob], info.name, { type });
}

/** Holt alle bisher geteilten Dateien ab (leer im Browser). Fehlerhafte Dateien werden übersprungen. */
export async function takeSharedFiles(
  plugin: Pick<ShareTargetPlugin, "getSharedFiles"> = ShareTarget,
  toFile: (info: SharedFileInfo) => Promise<File> = fileFromShared,
): Promise<File[]> {
  const { files } = await plugin.getSharedFiles();
  const settled = await Promise.allSettled(files.map(toFile));
  return settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}

/** Meldet sich für geteilte Dateien an (Start per Teilen und neue Teilen-Aktion bei laufender App). */
export function listenForSharedFiles(onFiles: (files: File[]) => void): () => void {
  if (!isNative()) return () => undefined;
  let active = true;
  const check = () => {
    takeSharedFiles()
      .then((files) => active && files.length > 0 && onFiles(files))
      .catch(() => undefined);
  };
  check();
  const handle = ShareTarget.addListener("sharedFiles", check);
  return () => {
    active = false;
    void handle.then((h) => h.remove());
  };
}
