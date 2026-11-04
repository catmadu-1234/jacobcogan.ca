import { describe, expect, it } from "vitest";
import { formatBytes } from "../../src/app/lib/format";

describe("formatBytes", () => {
  it("shows one decimal for GB and MB", () => {
    expect(formatBytes(2_254_857_830)).toBe("2.1 GB");
    expect(formatBytes(356_515_840)).toBe("340.0 MB");
  });
  it("shows whole numbers for KB and plain bytes", () => {
    expect(formatBytes(5120)).toBe("5 KB");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });
  it("rolls over to the next unit instead of showing 1024 KB", () => {
    expect(formatBytes(1_048_575)).toBe("1.0 MB");
  });
});
