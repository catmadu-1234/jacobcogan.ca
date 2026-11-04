import { describe, it, expect } from "vitest";
import { slugify, tagSlug } from "../src/slug";

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

describe("tagSlug", () => {
  it("matches slugify for ordinary names", () => {
    expect(tagSlug("Oil Pastel")).toBe("oil-pastel");
  });
  it("gives names with no ascii letters a stable, distinct hash slug", () => {
    expect(tagSlug("日本")).toMatch(/^tag-[0-9a-z]+$/);
    expect(tagSlug("日本")).toBe(tagSlug("日本"));
    expect(tagSlug("日本")).not.toBe(tagSlug("中国"));
  });
});
