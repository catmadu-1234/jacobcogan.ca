import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { listTags, setWorkTags, renameTag, deleteTag, tagsForWork, softDeleteWork } from "../src";
import { seedTwoSites, addWork } from "./fixtures";

const db = () => env.DB;

describe("tags", () => {
  it("creates tags by slug and de-duplicates case-insensitively", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W" });
    const tags = await setWorkTags(db(), a, work.id, ["Oil", "oil", "Paper"]);
    expect(tags.map((t) => t.name)).toEqual(["Oil", "Paper"]);
    expect((await listTags(db(), a)).map((t) => t.slug)).toEqual(["oil", "paper"]);
  });

  it("replaces the previous tag set", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W" });
    await setWorkTags(db(), a, work.id, ["Oil", "Paper"]);
    await setWorkTags(db(), a, work.id, ["Paper"]);
    expect((await tagsForWork(db(), work.id)).map((t) => t.name)).toEqual(["Paper"]);
  });

  it("supports names with no ascii letters", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W" });
    const tags = await setWorkTags(db(), a, work.id, ["日本", "中国"]);
    expect(tags).toHaveLength(2);
    expect(new Set(tags.map((t) => t.slug)).size).toBe(2);
  });

  it("refuses to tag another site's work", async () => {
    const { a, b } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", tags: ["Oil"] });
    expect(await setWorkTags(db(), b, work.id, ["Hacked"])).toEqual([]);
    expect((await tagsForWork(db(), work.id)).map((t) => t.name)).toEqual(["Oil"]);
    expect(await listTags(db(), b)).toEqual([]);
  });

  it("merges when a rename collides with an existing tag", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", tags: ["Paper"] });
    await addWork(db(), a, { title: "V", tags: ["Oil"] });
    const paper = (await listTags(db(), a)).find((t) => t.name === "Paper")!;
    const survivor = (await renameTag(db(), a, paper.id, "Oil"))!;
    expect(survivor.name).toBe("Oil");
    expect((await tagsForWork(db(), work.id)).map((t) => t.name)).toEqual(["Oil"]);
    const tags = await listTags(db(), a);
    expect(tags).toHaveLength(1);
    expect(tags[0]!.count).toBe(2);
  });

  it("renames in place when there is no collision", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", tags: ["Paper"] });
    const t = (await tagsForWork(db(), work.id))[0]!;
    const renamed = (await renameTag(db(), a, t.id, "Drawing"))!;
    expect(renamed).toMatchObject({ id: t.id, name: "Drawing", slug: "drawing" });
  });

  it("counts only non-deleted works", async () => {
    const { a } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", tags: ["Oil"] });
    await addWork(db(), a, { title: "V", tags: ["Oil"] });
    await softDeleteWork(db(), a, work.id);
    expect((await listTags(db(), a))[0]!.count).toBe(1);
  });

  it("deletes a tag, scoped to the site", async () => {
    const { a, b } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "W", tags: ["Oil"] });
    const t = (await tagsForWork(db(), work.id))[0]!;
    expect(await deleteTag(db(), b, t.id)).toBe(false);
    expect(await deleteTag(db(), a, t.id)).toBe(true);
    expect(await tagsForWork(db(), work.id)).toEqual([]);
  });
});
