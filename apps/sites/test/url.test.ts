import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "../src/lib/url";

describe("safeHttpUrl", () => {
  it("returns http and https addresses", () => {
    expect(safeHttpUrl("https://shop.example.com/x?a=1")).toBe("https://shop.example.com/x?a=1");
    expect(safeHttpUrl("  http://example.com/a  ")).toBe("http://example.com/a");
  });
  it("rejects everything else, including script and data URLs and bare domains", () => {
    for (const v of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "ftp://x.com", "mailto:a@b.c", "shop.example.com", "//evil.com", "", "   "]) {
      expect(safeHttpUrl(v), v).toBeNull();
    }
  });
});
