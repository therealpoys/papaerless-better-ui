import { describe, expect, it } from "vitest";
import { buildApply, selectionCount, toggle } from "./reviewCard";

describe("buildApply", () => {
  it("nimmt nur gewählte Textfelder, wenn keine Tags gewählt sind", () => {
    expect(buildApply({ fields: ["title"], tags: [] })).toEqual({ fields: ["title"] });
  });
  it("hängt tags und die gewählten Tags an", () => {
    expect(buildApply({ fields: ["title", "documentType"], tags: ["Steuer"] })).toEqual({
      fields: ["title", "documentType", "tags"],
      onlyTags: ["Steuer"],
    });
  });
  it("funktioniert auch nur mit Tags", () => {
    expect(buildApply({ fields: [], tags: ["A", "B"] })).toEqual({ fields: ["tags"], onlyTags: ["A", "B"] });
  });
});

describe("selectionCount", () => {
  it("zählt Felder und Tags zusammen", () => {
    expect(selectionCount({ fields: ["title"], tags: ["A", "B"] })).toBe(3);
    expect(selectionCount({ fields: [], tags: [] })).toBe(0);
  });
});

describe("toggle", () => {
  it("fügt hinzu und entfernt wieder", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });
});
