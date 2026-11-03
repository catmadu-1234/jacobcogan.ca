import { describe, it, expect } from "vitest";
import { call, seedTwoSites } from "./helpers";

const A = "a@test.dev";
const B = "b@test.dev";

async function workWithTags(email: string, tags: string[]) {
  const w = (await (await call(email, "POST", "/api/works")).json()) as any;
  await call(email, "PATCH", `/api/works/${w.id}`, { tags, expectedUpdatedAt: w.updatedAt });
  return w;
}

describe("tags API", () => {
  it("lists tags with work counts", async () => {
    await seedTwoSites();
    await workWithTags(A, ["Oil", "Paper"]);
    await workWithTags(A, ["Oil"]);
    const list = (await (await call(A, "GET", "/api/tags")).json()) as any[];
    expect(list.map((t) => [t.name, t.count])).toEqual([["Oil", 2], ["Paper", 1]]);
  });

  it("renames a tag in place", async () => {
    await seedTwoSites();
    await workWithTags(A, ["Paper"]);
    const [t] = (await (await call(A, "GET", "/api/tags")).json()) as any[];
    const res = await call(A, "PATCH", `/api/tags/${t.id}`, { name: "Drawing" });
    expect(await res.json()).toMatchObject({ id: t.id, name: "Drawing", slug: "drawing" });
  });

  it("merges into the existing tag when renamed to its name", async () => {
    await seedTwoSites();
    await workWithTags(A, ["Paper"]);
    await workWithTags(A, ["Oil"]);
    const list = (await (await call(A, "GET", "/api/tags")).json()) as any[];
    const paper = list.find((t) => t.name === "Paper");
    const oil = list.find((t) => t.name === "Oil");
    const res = await call(A, "PATCH", `/api/tags/${paper.id}`, { name: "oil" });
    expect(((await res.json()) as any).id).toBe(oil.id);
    const after = (await (await call(A, "GET", "/api/tags")).json()) as any[];
    expect(after.map((t) => [t.name, t.count])).toEqual([["Oil", 2]]);
  });

  it("rejects empty names", async () => {
    await seedTwoSites();
    await workWithTags(A, ["Paper"]);
    const [t] = (await (await call(A, "GET", "/api/tags")).json()) as any[];
    expect((await call(A, "PATCH", `/api/tags/${t.id}`, { name: "  " })).status).toBe(400);
  });

  it("deletes a tag but not another site's", async () => {
    await seedTwoSites();
    await workWithTags(A, ["Oil"]);
    const [t] = (await (await call(A, "GET", "/api/tags")).json()) as any[];
    expect((await call(B, "DELETE", `/api/tags/${t.id}`)).status).toBe(404);
    expect((await call(B, "PATCH", `/api/tags/${t.id}`, { name: "Hacked" })).status).toBe(404);
    expect((await call(A, "DELETE", `/api/tags/${t.id}`)).status).toBe(204);
    expect(((await (await call(A, "GET", "/api/tags")).json()) as any[])).toEqual([]);
  });
});
