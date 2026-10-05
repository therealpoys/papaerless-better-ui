import { describe, expect, it } from "vitest";
import { isReviewComplete, withoutTags } from "./reviewCard";

const values = { title: "Rechnung", correspondent: "Telekom", documentType: "" };

describe("withoutTags", () => {
  it("entfernt übernommene Tags unabhängig von der Schreibweise", () => {
    expect(withoutTags(["Steuer", "Auto", "Haus"], [" steuer "])).toEqual(["Auto", "Haus"]);
  });
  it("lässt alles stehen, wenn nichts übernommen wurde", () => {
    expect(withoutTags(["Steuer"], [])).toEqual(["Steuer"]);
  });
});

describe("isReviewComplete", () => {
  it("ist nicht fertig, solange Textfelder offen sind", () => {
    expect(isReviewComplete(values, ["title"], [])).toBe(false);
  });
  it("ist nicht fertig, solange Tags offen sind", () => {
    expect(isReviewComplete(values, ["title", "correspondent"], ["Auto"])).toBe(false);
  });
  it("ignoriert leere Felder und ist fertig, wenn alles Befüllte übernommen ist", () => {
    expect(isReviewComplete(values, ["title", "correspondent"], [])).toBe(true);
  });
});
