import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "@senka/core";
import { rowItemVars, themeStyle } from "../src/lib/style";

describe("rowItemVars", () => {
  it("gives the aspect ratio and the placeholder colour as CSS variables", () => {
    expect(rowItemVars({ width: 3000, height: 2000, color: "#aabbcc" })).toEqual({ "--ar": "1.5000", "--bg": "#aabbcc" });
  });
  it("falls back to a neutral colour when there is none or it is not a hex colour", () => {
    expect(rowItemVars({ width: 1, height: 1, color: null })).toEqual({ "--ar": "1.0000", "--bg": "#ededea" });
    expect(rowItemVars({ width: 1, height: 1, color: "red;background:url(x)" })["--bg"]).toBe("#ededea");
  });
  it("never produces a broken ratio", () => {
    expect(rowItemVars({ width: 100, height: 0, color: null })["--ar"]).toBe("1.0000");
    expect(rowItemVars({ width: 0, height: 100, color: null })["--ar"]).toBe("1.0000");
  });
});

describe("themeStyle", () => {
  it("exposes the accent colour and the desktop row height", () => {
    expect(themeStyle(DEFAULT_THEME)).toBe("--accent:#141414;--row-h-md:320px");
    expect(themeStyle({ ...DEFAULT_THEME, accent: "#7A3E2E", rowHeight: 400 })).toBe("--accent:#7A3E2E;--row-h-md:400px");
  });
  it("ignores values that could break out of the style attribute", () => {
    const style = themeStyle({ ...DEFAULT_THEME, accent: "red;background:url(//evil)", rowHeight: Number.NaN });
    expect(style).toBe("--accent:#141414;--row-h-md:320px");
  });
});
