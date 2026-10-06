/** Dateiname für ein aufgenommenes Foto, z. B. foto-2026-10-06-14-03-22.jpg */
export function photoFileName(date: Date, extension = "jpg"): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
  return `foto-${stamp}.${extension}`;
}

/** Wandelt das Ergebnis der nativen Kamera (webPath) in eine File für den Upload-Flow. */
export async function fileFromPhotoPath(
  webPath: string,
  format: string | undefined,
  now: Date = new Date(),
  fetchFn: typeof fetch = fetch,
): Promise<File> {
  const res = await fetchFn(webPath);
  const blob = await res.blob();
  const extension = (format ?? "jpeg").toLowerCase().replace("jpeg", "jpg");
  const type = blob.type || `image/${extension === "jpg" ? "jpeg" : extension}`;
  return new File([blob], photoFileName(now, extension), { type });
}
