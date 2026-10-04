import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { canCreateOption, filterOptions, toggleId, type PickerOption } from "../lib/tagPicker";

interface Props {
  options: PickerOption[];
  values: number[];
  onChange: (ids: number[]) => void;
  /** Legt einen neuen Eintrag an (oder merkt ihn vor) und liefert dessen ID. */
  onCreate: (name: string) => Promise<PickerOption>;
  "aria-label": string;
  placeholder?: string;
  createOptionLabel?: (name: string) => string;
}

/** Mehrfachauswahl mit Suche: Ausgewählte stehen als Chips (mit ×) oben, im Dropdown kann man suchen,
 * an-/abwählen und per Eingabe neue Einträge anlegen. */
export function TagCombobox({ options, values, onChange, onCreate, "aria-label": ariaLabel, placeholder, createOptionLabel }: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const trimmed = query.trim();
  const canCreate = canCreateOption(options, query);
  const selected = values.map((id) => options.find((o) => o.id === id)).filter((o): o is PickerOption => Boolean(o));

  function toggle(id: number) {
    onChange(toggleId(values, id));
    setQuery("");
    setActiveIndex(-1);
    setError(null);
  }

  async function handleCreate() {
    if (!trimmed) return;
    setIsCreating(true);
    setError(null);
    try {
      const created = await onCreate(trimmed);
      if (!values.includes(created.id)) onChange([...values, created.id]);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.combobox.createFailed"));
    } finally {
      setIsCreating(false);
    }
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
      if (activeIndex >= 0 && activeIndex < filtered.length) toggle(filtered[activeIndex].id);
      else if (canCreate) void handleCreate();
      else if (filtered.length === 1) toggle(filtered[0].id);
    } else if (e.key === "Backspace" && query === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    } else if (e.key === "Escape" && isOpen) {
      // Nur die Liste schließen, nicht den umgebenden Dialog.
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="ui-combobox tag-combobox">
      {selected.length > 0 && (
        <div className="tag-combobox__chips">
          {selected.map((tag) => (
            <span key={tag.id} className="tag-combobox__chip">
              {tag.name}
              <button
                type="button"
                aria-label={t("tagCombobox.remove", { name: tag.name })}
                onClick={() => onChange(values.filter((x) => x !== tag.id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="ui-combobox__input"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
      />
      {isOpen && (
        <ul className="ui-combobox__list" role="listbox" id={listId} aria-multiselectable="true">
          {filtered.map((option, index) => {
            const on = values.includes(option.id);
            return (
              <li key={option.id} role="option" aria-selected={on}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`ui-combobox__option${index === activeIndex ? " ui-combobox__option--active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(option.id)}
                >
                  <span>{option.name}</span>
                  {on && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
          {canCreate && (
            <li>
              <button
                type="button"
                className="ui-combobox__option ui-combobox__option--create"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleCreate()}
                disabled={isCreating}
              >
                {isCreating ? t("tagCombobox.creating") : (createOptionLabel ?? ((n: string) => t("tagCombobox.create", { name: n })))(trimmed)}
              </button>
            </li>
          )}
          {!canCreate && filtered.length === 0 && <li className="ui-combobox__hint">{t("common.combobox.noResults")}</li>}
        </ul>
      )}
      {error && <span className="ui-combobox__error">{error}</span>}
    </div>
  );
}
