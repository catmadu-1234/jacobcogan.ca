import { env } from "cloudflare:test";
import { getSiteById } from "@senka/core";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { bumpOnWrite, shouldBump } from "../src/worker/bump";
import type { AppEnv } from "../src/worker/env";
import { seedTwoSites } from "./helpers";

describe("shouldBump", () => {
  it("never bumps for reads", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) expect(shouldBump(method, 200), method).toBe(false);
  });
  it("bumps for successful writes", () => {
    for (const status of [200, 201, 204]) expect(shouldBump("PATCH", status), String(status)).toBe(true);
  });
  it("bumps when a write fails on the server, because part of it may already be saved", () => {
    for (const status of [500, 502, 503]) expect(shouldBump("POST", status), String(status)).toBe(true);
  });
  it("does not bump for rejected requests, where nothing was written", () => {
    for (const status of [400, 401, 403, 404, 409, 413]) expect(shouldBump("PUT", status), String(status)).toBe(false);
  });
});

describe("bumpOnWrite", () => {
  async function version(siteId: number) {
    return (await getSiteById(env.DB, siteId))!.contentVersion;
  }
  function appFor(siteId: number) {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("siteId", siteId);
      await next();
    });
    app.use("*", bumpOnWrite());
    app.post("/ok", (c) => c.json({ ok: true }));
    app.post("/rejected", (c) => c.json({ error: "invalid" }, 400));
    app.post("/boom", () => {
      throw new Error("a later step failed after the first one was saved");
    });
    app.get("/read", (c) => c.json({ ok: true }));
    app.onError((_e, c) => c.json({ error: "server" }, 500));
    return app;
  }

  it("bumps the site's version after a write that failed halfway, so cached pages cannot show stale content", async () => {
    const { a } = await seedTwoSites();
    const before = await version(a);
    const res = await appFor(a).request("/boom", { method: "POST" }, env);
    expect(res.status).toBe(500);
    expect(await version(a)).toBe(before + 1);
  });

  it("bumps after a successful write and not after a read or a rejected request", async () => {
    const { a, b } = await seedTwoSites();
    const app = appFor(a);
    const start = await version(a);
    await app.request("/read", {}, env);
    await app.request("/rejected", { method: "POST" }, env);
    expect(await version(a)).toBe(start);
    await app.request("/ok", { method: "POST" }, env);
    expect(await version(a)).toBe(start + 1);
    expect(await version(b)).toBe(1);
  });
});
