import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { resolveSiteFromRequest, rewritePath } from "../src/lib/site";
import { seedSites } from "./fixtures";

const url = (s: string) => new URL(s);

describe("resolveSiteFromRequest", () => {
  it("finds a site by its own hostname, ignoring case, with no path prefix", async () => {
    const { b } = await seedSites();
    const r = await resolveSiteFromRequest(env.DB, url("https://ART.example.com/work/x"));
    expect(r).toMatchObject({ basePath: "" });
    expect(r!.site.id).toBe(b.id);
  });

  it("finds a site by the first path segment on the shared address", async () => {
    const { a } = await seedSites();
    const r = await resolveSiteFromRequest(env.DB, url("https://senka-sites.example.workers.dev/site-a/work/x"));
    expect(r).toMatchObject({ basePath: "/site-a" });
    expect(r!.site.id).toBe(a.id);
  });

  it("prefers the hostname over the path", async () => {
    const { b } = await seedSites();
    const r = await resolveSiteFromRequest(env.DB, url("https://art.example.com/site-a/x"));
    expect(r!.site.id).toBe(b.id);
    expect(r!.basePath).toBe("");
  });

  it("returns null for the root, unknown slugs and unknown hosts", async () => {
    await seedSites();
    expect(await resolveSiteFromRequest(env.DB, url("https://x.workers.dev/"))).toBeNull();
    expect(await resolveSiteFromRequest(env.DB, url("https://x.workers.dev/nope/work"))).toBeNull();
  });

  it("never treats reserved paths as site slugs, even if a site is named that way", async () => {
    await env.DB.prepare("INSERT INTO sites (slug, name) VALUES ('media', 'Sneaky'), ('api', 'Sneakier')").run();
    for (const path of ["/media/1/2/original", "/api/public/x", "/_astro/a.js", "/robots.txt"]) {
      expect(await resolveSiteFromRequest(env.DB, url(`https://x.workers.dev${path}`)), path).toBeNull();
    }
  });
});

describe("rewritePath", () => {
  it("maps a site's own hostname onto its slug route", () => {
    expect(rewritePath("/", "site-b", "")).toBe("/site-b");
    expect(rewritePath("/about", "site-b", "")).toBe("/site-b/about");
    expect(rewritePath("/work/blue-hour", "site-b", "")).toBe("/site-b/work/blue-hour");
    expect(rewritePath("/tag/oil", "site-b", "")).toBe("/site-b/tag/oil");
    expect(rewritePath("/sitemap.xml", "site-b", "")).toBe("/site-b/sitemap.xml");
  });
  it("leaves shared-address paths and shared routes alone", () => {
    expect(rewritePath("/site-a/about", "site-a", "/site-a")).toBeNull();
    for (const p of ["/media/1/2/w480", "/_astro/x.js", "/robots.txt", "/api/public/site-b/works"]) {
      expect(rewritePath(p, "site-b", ""), p).toBeNull();
    }
  });
});
