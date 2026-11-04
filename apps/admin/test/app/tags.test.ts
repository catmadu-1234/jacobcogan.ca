import { describe, expect, it } from "vitest";
import { addTag, suggest } from "../../src/app/lib/tags";

describe("addTag", () => {
  it("trims, adds and ignores case-insensitive duplicates", () => {
    expect(addTag(["Oil"], "  Paper ")).toEqual(["Oil", "Paper"]);
    expect(addTag(["Oil"], "oil")).toEqual(["Oil"]);
    expect(addTag(["Oil"], "   ")).toEqual(["Oil"]);
  });
  it("caps tags at 20 and names at 40 characters", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `t${i}`);
    expect(addTag(twenty, "extra")).toEqual(twenty);
    expect(addTag([], "x".repeat(60))[0]).toHaveLength(40);
  });
});

describe("suggest", () => {
  const all = ["Oil", "Oil pastel", "Paper", "Photo"];
  it("matches by prefix first, then contains, hiding already selected tags", () => {
    expect(suggest("o", all, []).matches).toEqual(["Oil", "Oil pastel", "Photo"]);
    expect(suggest("pa", all, []).matches).toEqual(["Paper", "Oil pastel"]);
    expect(suggest("pastel", all, []).matches).toEqual(["Oil pastel"]);
    expect(suggest("o", all, ["Oil"]).matches).toEqual(["Oil pastel", "Photo"]);
  });
  it("offers to create only when the typed text is not an existing tag", () => {
    expect(suggest("Ink", all, []).canCreate).toBe(true);
    expect(suggest("oil", all, []).canCreate).toBe(false);
    expect(suggest("oil", all, ["Oil"]).canCreate).toBe(false);
    expect(suggest("  ", all, []).canCreate).toBe(false);
  });
  it("shows nothing for an empty query", () => {
    expect(suggest("", all, []).matches).toEqual([]);
  });
});
