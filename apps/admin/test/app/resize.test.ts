import { describe, expect, it } from "vitest";
import { fitWidth, plannedVariants, variantWidths } from "../../src/app/lib/upload/resize";

describe("variantWidths", () => {
  it("only produces widths smaller than the original, always including 480", () => {
    expect(variantWidths(5000)).toEqual([480, 1200, 2400]);
    expect(variantWidths(1500)).toEqual([480, 1200]);
    expect(variantWidths(300)).toEqual([480]);
  });
  it("treats widths equal to the original as not smaller", () => {
    expect(variantWidths(2400)).toEqual([480, 1200]);
    expect(variantWidths(1200)).toEqual([480]);
    expect(variantWidths(480)).toEqual([480]);
  });
});

describe("plannedVariants", () => {
  it("lists the original plus a WebP per width", () => {
    expect(plannedVariants("image/jpeg", 5000)).toEqual(["original", "w480", "w1200", "w2400"]);
    expect(plannedVariants("image/png", 1500)).toEqual(["original", "w480", "w1200"]);
  });
  it("keeps GIFs as the original only so they stay animated", () => {
    expect(plannedVariants("image/gif", 5000)).toEqual(["original"]);
  });
});

describe("fitWidth", () => {
  it("scales down keeping the aspect ratio, never up", () => {
    expect(fitWidth(1920, 1080, 1200)).toEqual({ width: 1200, height: 675 });
    expect(fitWidth(800, 600, 1200)).toEqual({ width: 800, height: 600 });
    expect(fitWidth(4000, 1, 480).height).toBeGreaterThanOrEqual(1);
  });
});
