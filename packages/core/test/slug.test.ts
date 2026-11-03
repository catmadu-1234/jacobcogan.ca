import { describe, it, expect } from "vitest";
import { slugify } from "../src/slug";

describe("slugify", () => {
  it("strips diacritics and punctuation", () => {
    expect(slugify("Café Noir!")).toBe("cafe-noir");
  });
  it("collapses runs and trims dashes", () => {
    expect(slugify("  --A  B-- ")).toBe("a-b");
  });
  it("returns empty string when nothing usable remains", () => {
    expect(slugify("日本")).toBe("");
  });
  it("caps at 80 chars", () => {
    expect(slugify("x".repeat(100)).length).toBe(80);
  });
});
