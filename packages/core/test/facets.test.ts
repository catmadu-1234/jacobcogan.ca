import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { WorkPatch, facetsForWork, listFacetValues, renameFacetValue, setWorkFacets, softDeleteWork } from "../src";
import { addWork } from "./fixtures";
import { seedTwoSites } from "./fixtures";

const db = () => env.DB;
const names = (values: { name: string }[]) => values.map((v) => v.name);

describe("work facets", () => {
  it("keeps several values per facet and returns them sorted", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W" });
    const result = await setWorkFacets(db(), a, work.id, { medium: ["Oil", "acrylic"], exhibition: ["Spring Show", "Open Studio"] });
    expect(names(result.medium)).toEqual(["acrylic", "Oil"]);
    expect(names(result.exhibition)).toEqual(["Open Studio", "Spring Show"]);
    expect(result.project).toEqual([]);
  });

  it("matches values by slug within one facet, but never across facets", async () => {
    const { a } = await seedTwoSites(db());
    const one = await addWork(db(), a, { title: "One" });
    const two = await addWork(db(), a, { title: "Two" });
    await setWorkFacets(db(), a, one.work.id, { medium: ["Oil"], content: ["Dogs"] });
    await setWorkFacets(db(), a, two.work.id, { medium: [" oil "], project: ["Dogs"] });
    const all = await listFacetValues(db(), a);
    expect(all.medium.map((v) => [v.name, v.count])).toEqual([["Oil", 2]]);
    expect(names(all.content)).toEqual(["Dogs"]);
    expect(names(all.project)).toEqual(["Dogs"]);
  });

  it("only touches the facets it is given", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", facets: { medium: ["Oil"], project: ["Harbour"] } });
    await setWorkFacets(db(), a, work.id, { medium: [] });
    const left = await facetsForWork(db(), work.id);
    expect(left.medium).toEqual([]);
    expect(names(left.project)).toEqual(["Harbour"]);
  });

  it("drops a value from suggestions once no work carries it", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", facets: { medium: ["Oil", "Oli"] } });
    await setWorkFacets(db(), a, work.id, { medium: ["Oil"] });
    expect(names((await listFacetValues(db(), a)).medium)).toEqual(["Oil"]);
  });

  it("does not suggest values that only a deleted work carries", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", facets: { medium: ["Oil"] } });
    await softDeleteWork(db(), a, work.id);
    expect((await listFacetValues(db(), a)).medium).toEqual([]);
  });

  it("keeps each site's vocabulary separate", async () => {
    const { a, b } = await seedTwoSites(db());
    await addWork(db(), a, { title: "A", facets: { medium: ["Oil"] } });
    expect((await listFacetValues(db(), b)).medium).toEqual([]);
  });

  it("ignores a work from another site", async () => {
    const { a, b } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "A" });
    await setWorkFacets(db(), b, work.id, { medium: ["Oil"] });
    expect((await facetsForWork(db(), work.id)).medium).toEqual([]);
  });
});

describe("WorkPatch year", () => {
  const patch = (year: string) => WorkPatch.safeParse({ fields: { year }, expectedUpdatedAt: "x" });
  it("accepts four digits and an empty year", () => {
    expect(patch("2024").success).toBe(true);
    expect(patch("").success).toBe(true);
  });
  it("rejects anything that is not exactly four digits", () => {
    for (const bad of ["24", "c. 2019", "Spring 2021", "20245", "2024-25"]) expect(patch(bad).success, bad).toBe(false);
  });
});

describe("renameFacetValue", () => {
  it("renames a value for every work that uses it", async () => {
    const { a } = await seedTwoSites(db());
    const one = await addWork(db(), a, { title: "One", facets: { medium: ["Oli"] } });
    const two = await addWork(db(), a, { title: "Two", facets: { medium: ["Oli", "Ink"] } });
    const [oli] = (await listFacetValues(db(), a)).medium.filter((v) => v.name === "Oli");
    const renamed = await renameFacetValue(db(), a, oli!.id, "Oil");
    expect(renamed).toMatchObject({ name: "Oil", slug: "oil" });
    expect(names((await facetsForWork(db(), one.work.id)).medium)).toEqual(["Oil"]);
    expect(names((await facetsForWork(db(), two.work.id)).medium)).toEqual(["Ink", "Oil"]);
  });

  it("merges into an existing value of the same facet and keeps every work attached", async () => {
    const { a } = await seedTwoSites(db());
    const one = await addWork(db(), a, { title: "One", facets: { medium: ["Oli"] } });
    const two = await addWork(db(), a, { title: "Two", facets: { medium: ["Oil"] } });
    const [oli] = (await listFacetValues(db(), a)).medium.filter((v) => v.name === "Oli");
    const kept = await renameFacetValue(db(), a, oli!.id, "oil");
    expect(kept!.name).toBe("Oil");
    expect(names((await facetsForWork(db(), one.work.id)).medium)).toEqual(["Oil"]);
    const all = (await listFacetValues(db(), a)).medium;
    expect(all.map((v) => [v.name, v.count])).toEqual([["Oil", 2]]);
    expect(two.work.id).toBeGreaterThan(0);
  });

  it("does not merge across facets, and ignores another site's value", async () => {
    const { a, b } = await seedTwoSites(db());
    await addWork(db(), a, { title: "One", facets: { medium: ["Dogs"], content: ["Hounds"] } });
    const hounds = (await listFacetValues(db(), a)).content[0]!;
    await renameFacetValue(db(), a, hounds.id, "Dogs");
    const all = await listFacetValues(db(), a);
    expect(names(all.medium)).toEqual(["Dogs"]);
    expect(names(all.content)).toEqual(["Dogs"]);
    expect(await renameFacetValue(db(), b, hounds.id, "x")).toBeNull();
  });
});
