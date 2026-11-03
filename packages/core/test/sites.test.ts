import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME, getSiteById, getSiteBySlug, getSiteByHostname, getUserSiteId,
  updateSite, bumpContentVersion, storageBytes,
} from "../src";
import { seedTwoSites } from "./fixtures";

describe("sites and users", () => {
  it("resolves a user's site case-insensitively", async () => {
    const { a } = await seedTwoSites(env.DB);
    expect(await getUserSiteId(env.DB, "A@TEST.dev")).toBe(a);
  });
  it("returns null for an unknown email", async () => {
    await seedTwoSites(env.DB);
    expect(await getUserSiteId(env.DB, "nobody@test.dev")).toBeNull();
  });
  it("defaults the theme", async () => {
    await seedTwoSites(env.DB);
    expect((await getSiteBySlug(env.DB, "site-a"))!.theme).toEqual(DEFAULT_THEME);
  });
  it("gets a site by id and by hostname", async () => {
    const { a } = await seedTwoSites(env.DB);
    await env.DB.prepare("UPDATE sites SET hostname = 'art.example.com' WHERE id = ?").bind(a).run();
    expect((await getSiteById(env.DB, a))!.slug).toBe("site-a");
    expect((await getSiteByHostname(env.DB, "ART.example.com"))!.id).toBe(a);
    expect(await getSiteByHostname(env.DB, "other.example.com")).toBeNull();
  });
  it("bumps the content version", async () => {
    const { a } = await seedTwoSites(env.DB);
    await bumpContentVersion(env.DB, a);
    expect((await getSiteById(env.DB, a))!.contentVersion).toBe(2);
  });
  it("merges theme patches over the existing theme", async () => {
    const { a } = await seedTwoSites(env.DB);
    const site = await updateSite(env.DB, a, { theme: { accent: "#7A3E2E" } });
    expect(site.theme.accent).toBe("#7A3E2E");
    expect(site.theme.preset).toBe("grotesk");
  });
  it("sums media bytes for storage", async () => {
    const { a } = await seedTwoSites(env.DB);
    expect(await storageBytes(env.DB, a)).toBe(0);
  });
});
