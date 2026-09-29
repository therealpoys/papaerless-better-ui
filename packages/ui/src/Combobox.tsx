import { useId, useMemo, useState, type KeyboardEvent } from "react";

export interface ComboboxOption {
  id: number;
  name: string;
  /** Optionaler Zusatz rechts in der Liste (z.B. Trefferzahl). */
  document_count?: number;
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
  /** Formatiert `document_count` für die Anzeige neben der Option; ohne Angabe keine Zahl. */
  countLabel?: (count: number) => string;
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
  countLabel,
}: ComboboxProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
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
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      if (filtered.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + delta + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex]);
      } else if (filtered.length === 1 && !canCreate) {
        handleSelect(filtered[0]);
      } else if (canCreate) {
        handleCreate();
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setIsOpen(false);
      setError(null);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="ui-combobox">
      <input
        className="ui-combobox__input"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        value={isOpen ? query : (selected?.name ?? "")}
        placeholder={emptyLabel}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
        }}
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
        <ul className="ui-combobox__list" role="listbox" id={listId}>
          {filtered.map((option, index) => (
            <li key={option.id} role="option" id={`${listId}-${index}`} aria-selected={option.id === value}>
              <button
                type="button"
                tabIndex={-1}
                className={`ui-combobox__option${index === activeIndex ? " ui-combobox__option--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                <span>{option.name}</span>
                {countLabel && option.document_count !== undefined && (
                  <span className="ui-combobox__count">{countLabel(option.document_count)}</span>
                )}
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
