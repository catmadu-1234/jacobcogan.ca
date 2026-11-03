import { env } from "cloudflare:test";
import { generateKeyPair } from "jose";
import { describe, it, expect } from "vitest";
import { app, authed, request, seedTwoSites, signToken } from "./helpers";

describe("Cloudflare Access auth", () => {
  it("rejects a request with no token", async () => {
    await seedTwoSites();
    const res = await request("/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("rejects a token for the wrong audience", async () => {
    await seedTwoSites();
    const res = await request("/api/me", { headers: { "Cf-Access-Jwt-Assertion": await signToken("a@test.dev", { aud: "other" }) } });
    expect(res.status).toBe(401);
  });

  it("rejects a token signed by an unknown key", async () => {
    await seedTwoSites();
    const { privateKey } = await generateKeyPair("RS256");
    const res = await request("/api/me", { headers: { "Cf-Access-Jwt-Assertion": await signToken("a@test.dev", { key: privateKey }) } });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    await seedTwoSites();
    const token = await signToken("a@test.dev", { expiresIn: Math.floor(Date.now() / 1000) - 60 });
    const res = await request("/api/me", { headers: { "Cf-Access-Jwt-Assertion": token } });
    expect(res.status).toBe(401);
  });

  it("fails closed when Access is not configured", async () => {
    await seedTwoSites();
    const res = await request("/api/me", { headers: await authed("a@test.dev") }, { ACCESS_AUD: "" });
    expect(res.status).toBe(401);
  });

  it("returns the user's own site for a valid token", async () => {
    await seedTwoSites();
    const res = await request("/api/me", { headers: await authed("a@test.dev") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.email).toBe("a@test.dev");
    expect(body.site.slug).toBe("site-a");
    expect(body.storageBytes).toBe(0);
  });

  it("matches emails case-insensitively", async () => {
    await seedTwoSites();
    const res = await request("/api/me", { headers: await authed("B@Test.DEV") });
    expect(((await res.json()) as any).site.slug).toBe("site-b");
  });

  it("returns 403 for an authenticated email with no site", async () => {
    await seedTwoSites();
    const res = await request("/api/me", { headers: await authed("nobody@test.dev") });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "no-site" });
  });

  it("allows DEV_USER_EMAIL on localhost without a token", async () => {
    await seedTwoSites();
    const res = await app.request("http://localhost/api/me", {}, { ...env, DEV_USER_EMAIL: "a@test.dev" });
    expect(res.status).toBe(200);
  });

  it("ignores DEV_USER_EMAIL on any non-local hostname", async () => {
    await seedTwoSites();
    const res = await app.request("https://senka-admin.example.workers.dev/api/me", {}, { ...env, DEV_USER_EMAIL: "a@test.dev" });
    expect(res.status).toBe(401);
  });

  it("answers unknown API routes with JSON 404 only after authentication", async () => {
    await seedTwoSites();
    expect((await request("/api/nope")).status).toBe(401);
    const res = await request("/api/nope", { headers: await authed("a@test.dev") });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not-found" });
  });
});
