import { useMemo, useState, type KeyboardEvent } from "react";

export interface ComboboxOption {
  id: number;
  name: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Weglassen, wenn diese Instanz nur zum Filtern/Auswählen dient (z.B. Suchfilter) und
   * kein "Neu anlegen" anbieten soll. */
  onCreate?: (name: string) => Promise<ComboboxOption>;
  emptyLabel?: string;
  "aria-label"?: string;
  removeSelectionLabel?: string;
  creatingLabel?: string;
  createOptionLabel?: (name: string) => string;
  typeToCreateHint?: string;
  noResultsHint?: string;
  createFailedLabel?: string;
}

/** Select mit Freitext-Suche + optional "Neu anlegen", statt nur aus bestehenden Werten
 * wählen zu können (Korrespondent, Dokumenttyp) – in Suchfiltern ohne `onCreate` auch als
 * moderneres, durchsuchbares Ersatz für ein natives `<select>` nutzbar.
 * Die Label-Props sind überschreibbar statt fest verdrahtet, weil diese Komponente keine
 * eigene i18n-Anbindung hat – Aufrufer übersetzen selbst. */
export function Combobox({
  options,
  value,
  onChange,
  onCreate,
  emptyLabel = "—",
  "aria-label": ariaLabel,
  removeSelectionLabel = "Auswahl entfernen",
  creatingLabel = "Legt an…",
  createOptionLabel = (name) => `„${name}“ neu anlegen`,
  typeToCreateHint = "Tippen, um einen neuen Eintrag anzulegen",
  noResultsHint = "Keine Treffer",
  createFailedLabel = "Anlegen fehlgeschlagen",
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const trimmed = query.trim();
  const exactMatch = options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const canCreate = Boolean(onCreate) && trimmed.length > 0 && !exactMatch;

  async function handleCreate() {
    if (!trimmed || !onCreate) return;
    setIsCreating(true);
    setError(null);
    try {
      const created = await onCreate(trimmed);
      onChange(created.id);
      setQuery("");
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : createFailedLabel);
    } finally {
      setIsCreating(false);
    }
  }

  function handleSelect(option: ComboboxOption) {
    onChange(option.id);
    setQuery("");
    setIsOpen(false);
    setError(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1 && !canCreate) {
        handleSelect(filtered[0]);
      } else if (canCreate) {
        handleCreate();
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setIsOpen(false);
      setError(null);
    }
  }

  return (
    <div className="ui-combobox">
      <input
        className="ui-combobox__input"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        value={isOpen ? query : (selected?.name ?? "")}
        placeholder={emptyLabel}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
      />
      {selected && !isOpen && (
        <button
          type="button"
          className="ui-combobox__clear"
          aria-label={removeSelectionLabel}
          onClick={() => onChange(null)}
        >
          ×
        </button>
      )}
      {isOpen && (
        <ul className="ui-combobox__list" role="listbox">
          {filtered.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="ui-combobox__option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                {option.name}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                className="ui-combobox__option ui-combobox__option--create"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? creatingLabel : createOptionLabel(trimmed)}
              </button>
            </li>
          )}
          {!canCreate && filtered.length === 0 && (
            <li className="ui-combobox__hint">
              {onCreate ? typeToCreateHint : noResultsHint}
            </li>
          )}
        </ul>
      )}
      {error && <span className="ui-combobox__error">{error}</span>}
    </div>
  );
}
