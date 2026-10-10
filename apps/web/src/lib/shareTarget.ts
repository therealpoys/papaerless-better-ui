import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNative } from "./platform";

/** Vom nativen Plugin in den Cache kopierte Datei, die per "Teilen mit…" ankam. */
export interface SharedFileInfo {
  path: string;
  name: string;
  type: string;
}

interface ShareTargetPlugin {
  notify(options: { message: string }): Promise<void>;
  getSharedFiles(): Promise<{ files: SharedFileInfo[]; errors?: string[] }>;
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

/** Geteilte Dateien samt Fehlern, die beim Einlesen aufgetreten sind (nichts geht mehr still verloren). */
export interface SharedResult {
  files: File[];
  errors: string[];
}

/** Holt alle bisher geteilten Dateien ab (leer im Browser). Fehlerhafte Dateien landen in `errors`. */
export async function takeSharedFiles(
  plugin: Pick<ShareTargetPlugin, "getSharedFiles"> = ShareTarget,
  toFile: (info: SharedFileInfo) => Promise<File> = fileFromShared,
): Promise<SharedResult> {
  const { files: infos, errors = [] } = await plugin.getSharedFiles();
  // Nur die Datei übergeben: map() würde sonst Index und Array als toUrl/fetchFn von fileFromShared mitgeben.
  const settled = await Promise.allSettled(infos.map((info) => toFile(info)));
  const files: File[] = [];
  const failed = [...errors];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") files.push(r.value);
    else failed.push(`${infos[i].name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  });
  return { files, errors: failed };
}

/** Meldet sich für geteilte Dateien an (Start per Teilen und neue Teilen-Aktion bei laufender App). */
export function listenForSharedFiles(
  onFiles: (files: File[]) => void,
  onError: (message: string) => void = () => undefined,
): () => void {
  if (!isNative()) return () => undefined;
  let active = true;
  const check = () => {
    takeSharedFiles()
      .then(({ files, errors }) => {
        if (!active) return;
        if (files.length > 0) {
          onFiles(files);
        }
        if (errors.length > 0) onError(errors.join("; "));
      })
      .catch((err) => active && onError(err instanceof Error ? err.message : String(err)));
  };
  check();
  const handle = ShareTarget.addListener("sharedFiles", check);
  handle.catch((err) => active && onError(err instanceof Error ? err.message : String(err)));
  return () => {
    active = false;
    void handle.then((h) => h.remove()).catch(() => undefined);
  };
}
