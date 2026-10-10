import { describe, expect, it } from "vitest";
import { applyTheme, getStoredTheme, setTheme, THEME_STORAGE_KEY } from "./theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function fakeRoot() {
  const attrs: Record<string, string> = {};
  return {
    attrs,
    setAttribute: (n: string, v: string) => {
      attrs[n] = v;
    },
    removeAttribute: (n: string) => {
      delete attrs[n];
    },
  };
}

describe("theme", () => {
  it("fällt bei fehlendem oder ungültigem Wert auf System zurück", () => {
    expect(getStoredTheme(memoryStorage())).toBe("system");
    expect(getStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "pink" }))).toBe("system");
    expect(getStoredTheme(null)).toBe("system");
  });

  it("liest die gespeicherte Auswahl", () => {
    expect(getStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
  });

  it("setzt data-theme für Hell/Dunkel und entfernt es für System", () => {
    const root = fakeRoot();
    applyTheme("dark", root);
    expect(root.attrs["data-theme"]).toBe("dark");
    applyTheme("light", root);
    expect(root.attrs["data-theme"]).toBe("light");
    applyTheme("system", root);
    expect(root.attrs["data-theme"]).toBeUndefined();
  });

  it("speichert die Auswahl", () => {
    const storage = memoryStorage();
    expect(setTheme("light", storage, fakeRoot())).toBe(true);
    expect(storage.data[THEME_STORAGE_KEY]).toBe("light");
  });

  it("meldet false, wenn Speichern scheitert", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("voll");
      },
    };
    expect(setTheme("dark", storage, fakeRoot())).toBe(false);
  });
});
