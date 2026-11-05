import { describe, expect, it } from "vitest";
import type { PublicWork } from "@senka/core";
import { buildSections, facetsOf, filterWork, filtersToQuery, matches, pageHref, parseFilters, toggleFilter } from "../src/lib/filters";

const work = (slug: string, d: { medium?: string; project?: string; year?: string; tags?: string[] } = {}): PublicWork => ({
  slug, title: slug, media: [], cover: null, updatedAt: "",
  tags: (d.tags ?? []).map((t) => ({ name: t, slug: t.toLowerCase() })),
  details: [
    ...(d.medium !== undefined ? [{ key: "medium", label: "Medium", value: d.medium, type: "text" as const }] : []),
    ...(d.project !== undefined ? [{ key: "project", label: "Project", value: d.project, type: "text" as const }] : []),
    ...(d.year !== undefined ? [{ key: "year", label: "Year", value: d.year, type: "text" as const }] : []),
  ],
});

const works = [
  work("a", { medium: "Oil on linen", project: "Harbour Series", year: "2025", tags: ["Oil"] }),
  work("b", { medium: "Oil on linen", project: "Studies", year: "2024" }),
  work("c", { medium: "Ink on paper", project: "Harbour Series", year: "2024" }),
  work("d", { medium: "Photograph", year: "2022" }),
];

describe("facetsOf", () => {
  it("reads medium, project and year from a work's details, as stable slugs", () => {
    expect(facetsOf(works[0]!)).toEqual({ medium: "oil-on-linen", project: "harbour-series", year: "2025", tags: ["oil"] });
  });
  it("finds the year inside longer text and ignores empty or missing details", () => {
    expect(facetsOf(work("x", { year: "c. 2019", medium: "  " })).year).toBe("2019");
    expect(facetsOf(work("x", { medium: "  " })).medium).toBeUndefined();
    expect(facetsOf(work("x")).project).toBeUndefined();
    expect(facetsOf(work("x", { year: "unknown" })).year).toBeUndefined();
  });
  it("gives names with no latin letters a stable slug rather than nothing", () => {
    expect(facetsOf(work("x", { medium: "水墨" })).medium).toMatch(/^tag-/);
  });
});

describe("parseFilters", () => {
  it("reads known filters from a query string and ignores everything else", () => {
    expect(parseFilters("?medium=oil&year=2024&view=index&x=1")).toEqual({ medium: "oil", year: "2024" });
    expect(parseFilters(new URLSearchParams("project=studies&tag=oil"))).toEqual({ project: "studies", tag: "oil" });
    expect(parseFilters("")).toEqual({});
    expect(parseFilters("?medium=")).toEqual({});
  });
});

describe("matches / filterWork", () => {
  it("requires every active filter to match", () => {
    expect(filterWork(works, { medium: "oil-on-linen" }).map((w) => w.slug)).toEqual(["a", "b"]);
    expect(filterWork(works, { medium: "oil-on-linen", year: "2024" }).map((w) => w.slug)).toEqual(["b"]);
    expect(filterWork(works, { tag: "oil" }).map((w) => w.slug)).toEqual(["a"]);
    expect(filterWork(works, {}).map((w) => w.slug)).toEqual(["a", "b", "c", "d"]);
    expect(filterWork(works, { project: "nope" })).toEqual([]);
  });
  it("matches a work with no value for a filtered facet only when that facet is not filtered", () => {
    expect(matches({ tags: [] }, { project: "studies" })).toBe(false);
    expect(matches({ tags: [] }, {})).toBe(true);
  });
});

describe("buildSections", () => {
  it("makes a section for each facet that has values, using the site's own labels", () => {
    const sections = buildSections(works, {});
    expect(sections.map((s) => [s.key, s.title])).toEqual([["medium", "Medium"], ["project", "Project"], ["year", "Year"]]);
  });
  it("lists options with how many works have them: names alphabetically, years newest first", () => {
    const [medium, project, year] = buildSections(works, {});
    expect(medium!.options.map((o) => [o.label, o.count])).toEqual([["Ink on paper", 1], ["Oil on linen", 2], ["Photograph", 1]]);
    expect(project!.options.map((o) => [o.label, o.count])).toEqual([["Harbour Series", 2], ["Studies", 1]]);
    expect(year!.options.map((o) => [o.label, o.count])).toEqual([["2025", 1], ["2024", 2], ["2022", 1]]);
  });
  it("merges values that differ only in capitals or spacing, keeping the first spelling", () => {
    const merged = buildSections([work("a", { medium: "Oil on Linen" }), work("b", { medium: "oil  on linen" })], {});
    expect(merged[0]!.options).toEqual([{ slug: "oil-on-linen", label: "Oil on Linen", count: 2, active: false }]);
  });
  it("counts what is left once the other filters are applied, but not the section's own choice", () => {
    const [medium, project] = buildSections(works, { year: "2024" });
    expect(medium!.options.map((o) => [o.slug, o.count])).toEqual([["ink-on-paper", 1], ["oil-on-linen", 1], ["photograph", 0]]);
    expect(project!.options.map((o) => [o.slug, o.count])).toEqual([["harbour-series", 1], ["studies", 1]]);
    const [mediumOwn] = buildSections(works, { medium: "oil-on-linen" });
    expect(mediumOwn!.options.map((o) => o.count)).toEqual([1, 2, 1]); // the alternatives stay visible
  });
  it("marks the chosen option", () => {
    const [, , year] = buildSections(works, { year: "2024" });
    expect(year!.options.filter((o) => o.active).map((o) => o.slug)).toEqual(["2024"]);
  });
  it("leaves out facets nobody has filled in", () => {
    expect(buildSections([work("a", { year: "2024" })], {}).map((s) => s.key)).toEqual(["year"]);
    expect(buildSections([work("a")], {})).toEqual([]);
  });
});

describe("toggleFilter", () => {
  it("chooses an option, swaps it for another in the same facet, and clears it when chosen again", () => {
    expect(toggleFilter({}, "medium", "oil")).toEqual({ medium: "oil" });
    expect(toggleFilter({ medium: "oil" }, "medium", "ink")).toEqual({ medium: "ink" });
    expect(toggleFilter({ medium: "oil", year: "2024" }, "medium", "oil")).toEqual({ year: "2024" });
  });
  it("does not change the filters it was given", () => {
    const f = { medium: "oil" };
    toggleFilter(f, "medium", "ink");
    expect(f).toEqual({ medium: "oil" });
  });
});

describe("filtersToQuery / pageHref", () => {
  it("writes filters in a fixed order and only adds the view when it is the index", () => {
    expect(filtersToQuery({}, "grid")).toBe("");
    expect(filtersToQuery({ year: "2024", medium: "oil" }, "grid")).toBe("?medium=oil&year=2024");
    expect(filtersToQuery({ tag: "x" }, "index")).toBe("?tag=x&view=index");
    expect(filtersToQuery({}, "index")).toBe("?view=index");
  });
  it("builds a page address from the site's path prefix", () => {
    expect(pageHref("", {}, "grid")).toBe("/");
    expect(pageHref("", { medium: "oil" }, "grid")).toBe("/?medium=oil");
    expect(pageHref("/site-a", { medium: "oil", year: "2024" }, "index")).toBe("/site-a?medium=oil&year=2024&view=index");
    expect(pageHref("/site-a", {}, "grid")).toBe("/site-a");
  });
});
