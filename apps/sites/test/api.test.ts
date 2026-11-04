import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handlePublicWork, handlePublicWorks } from "../src/lib/publicApi";
import { makeWork, seedSites } from "./fixtures";

const list = (slug: string, query = "") => handlePublicWorks(env, slug, new URL(`https://x.dev/api/public/${slug}/works${query}`));
const detail = (slug: string, work: string) => handlePublicWork(env, slug, work);

describe("public API", () => {
  it("lists only visible works, with the site's name and slug", async () => {
    const { a } = await seedSites();
    await makeWork(a, { title: "Shown" });
    await makeWork(a, { title: "Hidden", visible: false });
    await makeWork(a, { title: "Deleted", deleted: true });
    await makeWork(a, { title: "Pending", pending: true });
    const res = await list("site-a");
    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.site).toEqual({ name: "Site A", slug: "site-a" });
    expect(body.works.map((w: any) => w.title)).toEqual(["Shown"]);
  });

  it("sends CORS and caching headers so other websites can use it", async () => {
    const { a } = await seedSites();
    await makeWork(a, { title: "Shown" });
    const res = await list("site-a");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("exposes only the public shape, never ids, flags or timestamps of the database", async () => {
    const { a } = await seedSites();
    await makeWork(a, { title: "Shown" });
    const body = (await (await list("site-a")).json()) as any;
    expect(Object.keys(body.works[0]).sort()).toEqual(["cover", "details", "media", "slug", "tags", "title", "updatedAt"]);
    const text = JSON.stringify(body);
    for (const leak of ["siteId", "deletedAt", "visible", "hostname", "contentVersion", "r2", "status"]) {
      expect(text, leak).not.toContain(`"${leak}"`);
    }
  });

  it("builds media URLs from MEDIA_BASE", async () => {
    const { a } = await seedSites();
    const w = await makeWork(a, { title: "Shown" });
    const body = (await (await list("site-a")).json()) as any;
    expect(body.works[0].media[0].src).toBe(`/media/${a.id}/${w.media[0]!.id}/w480`);
  });

  it("filters by tag", async () => {
    const { a } = await seedSites();
    await makeWork(a, { title: "Painted", tags: ["Painting"] });
    await makeWork(a, { title: "Drawn", tags: ["Drawing"] });
    const body = (await (await list("site-a", "?tag=drawing")).json()) as any;
    expect(body.works.map((w: any) => w.title)).toEqual(["Drawn"]);
  });

  it("returns one work with previous and next links", async () => {
    const { a } = await seedSites();
    await makeWork(a, { title: "One" });
    const two = await makeWork(a, { title: "Two" });
    await makeWork(a, { title: "Three" });
    const body = (await (await detail("site-a", two.slug)).json()) as any;
    expect(body.work.title).toBe("Two");
    expect(body.prev).toEqual({ slug: "three", title: "Three" });
    expect(body.next).toEqual({ slug: "one", title: "One" });
  });

  it("404s for unknown sites and for hidden, deleted or unknown works", async () => {
    const { a } = await seedSites();
    const hidden = await makeWork(a, { title: "Hidden", visible: false });
    const deleted = await makeWork(a, { title: "Deleted", deleted: true });
    expect((await list("nope")).status).toBe(404);
    expect((await detail("nope", "x")).status).toBe(404);
    for (const slug of [hidden.slug, deleted.slug, "no-such-work"]) {
      const res = await detail("site-a", slug);
      expect(res.status, slug).toBe(404);
      expect(await res.json()).toEqual({ error: "not-found" });
    }
  });

  it("does not show one site's works under another site's address", async () => {
    const { a, b } = await seedSites();
    const w = await makeWork(a, { title: "Mine" });
    expect(((await (await list("site-b")).json()) as any).works).toEqual([]);
    expect((await detail("site-b", w.slug)).status).toBe(404);
    expect(b.id).not.toBe(a.id);
  });
});
