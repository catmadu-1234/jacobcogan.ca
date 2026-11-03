import { describe, expect, it } from "vitest";
import { dominantColor } from "../../src/app/lib/upload/color";

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);

describe("dominantColor", () => {
  it("averages opaque pixels into a lowercase hex colour", () => {
    expect(dominantColor(px(255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255))).toBe("#ff0000");
    expect(dominantColor(px(0, 0, 0, 255, 255, 255, 255, 255))).toBe("#808080");
  });
  it("ignores fully transparent pixels", () => {
    expect(dominantColor(px(0, 0, 255, 255, 255, 0, 0, 0))).toBe("#0000ff");
  });
  it("falls back to the neutral placeholder when nothing is visible", () => {
    expect(dominantColor(px(255, 0, 0, 0))).toBe("#ededea");
    expect(dominantColor(new Uint8ClampedArray(0))).toBe("#ededea");
  });
});
