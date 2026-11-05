import { describe, expect, it } from "vitest";
import { navigate, parseHash } from "../../src/app/lib/router";

describe("parseHash", () => {
  it("maps hashes to routes", () => {
    expect(parseHash("#/works/12")).toEqual({ name: "editor", params: { id: "12" } });
    expect(parseHash("#/works")).toEqual({ name: "works", params: {} });
    expect(parseHash("#/studio")).toEqual({ name: "studio", params: {} });
    expect(parseHash("#/studio")).toEqual({ name: "studio", params: {} });
    expect(parseHash("#/settings")).toEqual({ name: "settings", params: {} });
  });
  it("falls back to works for empty or unknown hashes", () => {
    for (const h of ["", "#", "#/", "#/nope", "#/works/abc", "#/works/12/extra", "#/tags", "#/tags/1"]) {
      expect(parseHash(h), h).toEqual({ name: "works", params: {} });
    }
  });
});

describe("navigate", () => {
  it("sets the location hash", () => {
    navigate("#/studio");
    expect(window.location.hash).toBe("#/studio");
  });
});
