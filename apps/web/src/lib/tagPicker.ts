export interface PickerOption {
  id: number;
  name: string;
}

/** Treffer für die Suche (Groß-/Kleinschreibung egal); leere Suche liefert alles. */
export function filterOptions(options: PickerOption[], query: string): PickerOption[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
}

/** Soll "Neu anlegen" angeboten werden? Nur bei nicht-leerer Eingabe ohne exakt gleichnamigen Eintrag. */
export function canCreateOption(options: PickerOption[], query: string): boolean {
  const q = query.trim().toLowerCase();
  return q.length > 0 && !options.some((o) => o.name.trim().toLowerCase() === q);
}

/** Wählt `id` ab, falls schon gewählt, sonst an. */
export function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
