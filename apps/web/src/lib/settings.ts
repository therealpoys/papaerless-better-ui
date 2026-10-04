export interface SettingsApi {
  updateSettings: (s: { autoSuggest: boolean }) => Promise<{ autoSuggest: boolean }>;
}

/** Speichert den Schalter und liefert den vom Server bestätigten Wert; bei Fehler bleibt der alte Wert gültig. */
export async function saveAutoSuggest(
  api: SettingsApi,
  current: boolean,
  next: boolean,
): Promise<{ value: boolean; failed: boolean }> {
  try {
    const saved = await api.updateSettings({ autoSuggest: next });
    return { value: saved.autoSuggest, failed: false };
  } catch {
    return { value: current, failed: true };
  }
}
