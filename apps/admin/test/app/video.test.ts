import { describe, expect, it } from "vitest";
import { posterTime, sniffHevc } from "../../src/app/lib/upload/video";

const ascii = (s: string) => new TextEncoder().encode(s);

describe("sniffHevc", () => {
  it("detects HEVC sample entries", () => {
    expect(sniffHevc(ascii("....ftypqt  ....hvc1...."))).toBe(true);
    expect(sniffHevc(ascii("....hev1...."))).toBe(true);
  });
  it("does not flag H.264 or empty input", () => {
    expect(sniffHevc(ascii("....avc1...."))).toBe(false);
    expect(sniffHevc(new Uint8Array(0))).toBe(false);
  });
});

describe("posterTime", () => {
  it("grabs an early frame without running past a very short clip", () => {
    expect(posterTime(30)).toBe(0.1);
    expect(posterTime(0.1)).toBe(0.05);
    expect(posterTime(0)).toBe(0);
  });
});
