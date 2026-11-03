import { describe, expect, it } from "vitest";
import { parseRange } from "../src";

describe("parseRange", () => {
  it("parses closed, open-ended and suffix ranges", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ offset: 0, length: 100 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ offset: 900, length: 100 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ offset: 900, length: 100 });
  });
  it("clamps ends and oversized suffixes to the file", () => {
    expect(parseRange("bytes=0-9999", 1000)).toEqual({ offset: 0, length: 1000 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ offset: 0, length: 1000 });
  });
  it("reports unsatisfiable ranges", () => {
    expect(parseRange("bytes=2000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=-0", 1000)).toBe("invalid");
    expect(parseRange("bytes=0-1", 0)).toBe("invalid");
  });
  it("ignores missing, malformed, reversed and multi-part ranges (serve the whole file)", () => {
    for (const h of [null, "", "bytes=", "items=0-1", "bytes=a-b", "bytes=5-2", "bytes=0-1,5-6", "bytes=-"]) {
      expect(parseRange(h, 1000), String(h)).toBeNull();
    }
  });
});
