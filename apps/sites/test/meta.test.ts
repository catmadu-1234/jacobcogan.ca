import { describe, expect, it } from "vitest";
import type { PublicWork } from "@senka/core";
import { firstSentence, neighbours, parseView, workNumber, yearRange } from "../src/lib/meta";

const work = (slug: string, year?: string): PublicWork => ({
  slug, title: slug, tags: [], media: [], cover: null, updatedAt: "",
  details: year ? [{ key: "year", label: "Year", value: year, type: "text" }] : [],
});

describe("parseView", () => {
  it("reads the view from a query string, defaulting to the grid", () => {
    expect(parseView("?view=index")).toBe("index");
    expect(parseView("view=index")).toBe("index");
    expect(parseView(new URLSearchParams("view=index&x=1"))).toBe("index");
    expect(parseView("")).toBe("grid");
    expect(parseView("?view=weird")).toBe("grid");
    expect(parseView("?view=grid")).toBe("grid");
  });
});

describe("firstSentence", () => {
  it("takes the first sentence of the first paragraph", () => {
    expect(firstSentence("Painter and printmaker working between oil, ink and light.\n\nBased by the sea.")).toBe("Painter and printmaker working between oil, ink and light.");
    expect(firstSentence("Drawing, mostly. Slowly.")).toBe("Drawing, mostly.");
  });
  it("shortens text with no sentence end, and returns nothing for empty text", () => {
    const long = firstSentence("word ".repeat(60));
    expect(long.length).toBeLessThanOrEqual(110);
    expect(long.endsWith("…")).toBe(true);
    expect(firstSentence("   ")).toBe("");
  });
});

describe("yearRange", () => {
  it("spans the earliest and latest year found in the works' details", () => {
    expect(yearRange([work("a", "2025"), work("b", "2022"), work("c", "2024")])).toBe("2022–2025");
  });
  it("shows a single year once, and nothing when there are no years", () => {
    expect(yearRange([work("a", "2024"), work("b", "2024")])).toBe("2024");
    expect(yearRange([work("a"), work("b", "n/a")])).toBe("");
  });
  it("finds a year inside a longer value", () => {
    expect(yearRange([work("a", "c. 2019"), work("b", "2021")])).toBe("2019–2021");
  });
});

describe("workNumber", () => {
  it("pads to two digits", () => {
    expect(workNumber(0)).toBe("01");
    expect(workNumber(8)).toBe("09");
    expect(workNumber(11)).toBe("12");
  });
});

describe("neighbours", () => {
  const list = [work("a"), work("b"), work("c")];
  it("gives the previous and next work in display order", () => {
    const r = neighbours(list, "b")!;
    expect([r.prev?.slug, r.next?.slug, r.index, r.wrapped]).toEqual(["a", "c", 1, false]);
  });
  it("has no previous work at the start", () => {
    expect(neighbours(list, "a")!.prev).toBeNull();
  });
  it("loops from the last work back to the first, so browsing never dead-ends", () => {
    const r = neighbours(list, "c")!;
    expect([r.next?.slug, r.wrapped]).toEqual(["a", true]);
  });
  it("offers no neighbours when there is only one work, and null for unknown slugs", () => {
    const r = neighbours([work("only")], "only")!;
    expect([r.prev, r.next]).toEqual([null, null]);
    expect(neighbours(list, "nope")).toBeNull();
  });
});
