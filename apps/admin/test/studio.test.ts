import { describe, it, expect } from "vitest";
import { call, contentVersion, seedTwoSites } from "./helpers";

const A = "a@test.dev";
const B = "b@test.dev";

describe("studio API", () => {
  it("creates a post, saves its words and shows it in the studio list, not the works list", async () => {
    await seedTwoSites();
    const created = await call(A, "POST", "/api/studio");
    expect(created.status).toBe(201);
    const post = (await created.json()) as any;
    expect(post).toMatchObject({ kind: "post", body: "", visible: false });

    const saved = await call(A, "PATCH", `/api/works/${post.id}`, { body: "A little thought.", visible: true, expectedUpdatedAt: post.updatedAt });
    expect(saved.status).toBe(200);

    const feed = (await (await call(A, "GET", "/api/studio")).json()) as any[];
    expect(feed.map((p) => [p.id, p.body, p.visible, p.media])).toEqual([[post.id, "A little thought.", true, []]]);
    expect(await (await call(A, "GET", "/api/works")).json()).toEqual([]);
  });

  it("publishes a post even when the portfolio has required details it does not fill in", async () => {
    await seedTwoSites();
    await call(A, "POST", "/api/fields", { label: "Medium", type: "text", required: true });
    const post = (await (await call(A, "POST", "/api/studio")).json()) as any;
    const res = await call(A, "PATCH", `/api/works/${post.id}`, { visible: true, expectedUpdatedAt: post.updatedAt });
    expect(res.status).toBe(200);
  });

  it("keeps each site's studio private to its owner and bumps the site's version on change", async () => {
    await seedTwoSites();
    const before = await contentVersion(A);
    await call(A, "POST", "/api/studio");
    expect(await contentVersion(A)).toBeGreaterThan(before);
    expect(await (await call(B, "GET", "/api/studio")).json()).toEqual([]);
  });
});
