import { describe, expect, it } from "vitest";
import { cleanLinks } from "../../src/app/lib/links";

describe("cleanLinks", () => {
  it("trims, keeps valid http(s) links and drops fully blank rows", () => {
    const result = cleanLinks([
      { label: " Instagram ", url: " https://instagram.com/x " },
      { label: "", url: "" },
      { label: "Shop", url: "http://shop.example.com" },
    ]);
    expect(result).toEqual({
      ok: true,
      links: [
        { label: "Instagram", url: "https://instagram.com/x" },
        { label: "Shop", url: "http://shop.example.com" },
      ],
    });
  });

  it("asks for both parts when a row is half filled, keyed by row number", () => {
    const result = cleanLinks([{ label: "Only name", url: "" }, { label: "", url: "https://a.com" }]);
    expect(result).toEqual({
      ok: false,
      errors: { 0: "Add both a name and a web address.", 1: "Add both a name and a web address." },
    });
  });

  it("rejects addresses that are not http(s), including script URLs", () => {
    for (const url of ["javascript:alert(1)", "ftp://x.com", "data:text/html,x", "not a url", "instagram.com/x"]) {
      const result = cleanLinks([{ label: "x", url }]);
      expect(result, url).toEqual({ ok: false, errors: { 0: "The web address must start with http:// or https://." } });
    }
  });

  it("accepts an empty list", () => {
    expect(cleanLinks([])).toEqual({ ok: true, links: [] });
  });
});
