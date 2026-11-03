import { env } from "cloudflare:test";
import { createMedia, updateMedia } from "@senka/core";
import { describe, it, expect } from "vitest";
import { call, contentVersion, seedTwoSites } from "./helpers";

const A = "a@test.dev";
const B = "b@test.dev";

async function newWork(email = A): Promise<any> {
  const res = await call(email, "POST", "/api/works");
  expect(res.status).toBe(201);
  return res.json();
}

describe("works API", () => {
  it("creates, titles and reads back a work with a slug", async () => {
    await seedTwoSites();
    const w = await newWork();
    const patched = await call(A, "PATCH", `/api/works/${w.id}`, { title: "Blue Hour", expectedUpdatedAt: w.updatedAt });
    expect(patched.status).toBe(200);
    const read = (await (await call(A, "GET", `/api/works/${w.id}`)).json()) as any;
    expect(read.work.slug).toBe("blue-hour");
    expect(read.media).toEqual([]);
    expect(read.tags).toEqual([]);
  });

  it("returns 409 with the current work for a stale save and keeps the stored data", async () => {
    await seedTwoSites();
    const w = await newWork();
    await call(A, "PATCH", `/api/works/${w.id}`, { title: "First", expectedUpdatedAt: w.updatedAt });
    const stale = await call(A, "PATCH", `/api/works/${w.id}`, { title: "Second", expectedUpdatedAt: w.updatedAt });
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as any;
    expect(body.error).toBe("conflict");
    expect(body.work.title).toBe("First");
  });

  it("never lets another site's user read, change, delete or restore a work", async () => {
    await seedTwoSites();
    const w = await newWork(A);
    expect((await call(B, "GET", `/api/works/${w.id}`)).status).toBe(404);
    expect((await call(B, "PATCH", `/api/works/${w.id}`, { title: "Hacked", expectedUpdatedAt: w.updatedAt })).status).toBe(404);
    expect((await call(B, "DELETE", `/api/works/${w.id}`)).status).toBe(404);
    expect((await call(B, "POST", `/api/works/${w.id}/restore`)).status).toBe(404);
    expect(((await (await call(B, "GET", "/api/works")).json()) as any[])).toEqual([]);
    expect(((await (await call(A, "GET", `/api/works/${w.id}`)).json()) as any).work.title).toBe("");
  });

  it("saves tags with the work and returns them", async () => {
    await seedTwoSites();
    const w = await newWork();
    const res = await call(A, "PATCH", `/api/works/${w.id}`, { tags: ["Oil", "Paper"], expectedUpdatedAt: w.updatedAt });
    expect(((await res.json()) as any).tags.map((t: any) => t.name)).toEqual(["Oil", "Paper"]);
  });

  it("bumps the site content version on successful writes only", async () => {
    await seedTwoSites();
    const start = await contentVersion(A);
    const w = await newWork();
    expect(await contentVersion(A)).toBe(start + 1);
    await call(A, "GET", "/api/works");
    expect(await contentVersion(A)).toBe(start + 1);
    await call(A, "PATCH", `/api/works/${w.id}`, { title: "x".repeat(201), expectedUpdatedAt: w.updatedAt });
    expect(await contentVersion(A)).toBe(start + 1);
    await call(A, "PATCH", `/api/works/${w.id}`, { title: "Ok", expectedUpdatedAt: w.updatedAt });
    expect(await contentVersion(A)).toBe(start + 2);
    await call(A, "PATCH", `/api/works/${w.id}`, { title: "Stale", expectedUpdatedAt: w.updatedAt });
    expect(await contentVersion(A)).toBe(start + 2);
  });

  it("does not bump the other site's content version", async () => {
    await seedTwoSites();
    const before = await contentVersion(B);
    await newWork(A);
    expect(await contentVersion(B)).toBe(before);
  });

  it("rejects invalid input with 400", async () => {
    await seedTwoSites();
    const w = await newWork();
    const tooLong = await call(A, "PATCH", `/api/works/${w.id}`, { title: "x".repeat(201), expectedUpdatedAt: w.updatedAt });
    expect(tooLong.status).toBe(400);
    expect(((await tooLong.json()) as any).error).toBe("invalid");
    expect((await call(A, "PATCH", `/api/works/${w.id}`, undefined, "{not json")).status).toBe(400);
    expect((await call(A, "PATCH", `/api/works/${w.id}`, { title: "No token" })).status).toBe(400);
  });

  it("rejects oversized request bodies with 413", async () => {
    await seedTwoSites();
    const w = await newWork();
    const huge = { fields: { a: "x".repeat(300_000) }, expectedUpdatedAt: w.updatedAt };
    expect((await call(A, "PATCH", `/api/works/${w.id}`, huge)).status).toBe(413);
  });

  it("answers 404 for non-numeric ids", async () => {
    await seedTwoSites();
    expect((await call(A, "GET", "/api/works/abc")).status).toBe(404);
  });

  it("soft-deletes and restores", async () => {
    await seedTwoSites();
    const w = await newWork();
    expect((await call(A, "DELETE", `/api/works/${w.id}`)).status).toBe(204);
    expect((await call(A, "GET", `/api/works/${w.id}`)).status).toBe(404);
    expect(((await (await call(A, "GET", "/api/works")).json()) as any[])).toEqual([]);
    expect((await call(A, "POST", `/api/works/${w.id}/restore`)).status).toBe(204);
    expect((await call(A, "GET", `/api/works/${w.id}`)).status).toBe(200);
  });

  it("lists works with a cover image, preferring the chosen cover", async () => {
    const { a } = await seedTwoSites();
    const w = await newWork();
    const input = { kind: "image" as const, mime: "image/webp" as const, width: 10, height: 10, bytes: 1, variants: ["original" as const] };
    const m1 = (await createMedia(env.DB, a, w.id, input))!;
    const m2 = (await createMedia(env.DB, a, w.id, input))!;
    await updateMedia(env.DB, a, m1.id, { status: "ready" });
    await updateMedia(env.DB, a, m2.id, { status: "ready" });
    let list = (await (await call(A, "GET", "/api/works")).json()) as any[];
    expect(list[0].cover.id).toBe(m1.id);
    await call(A, "PATCH", `/api/works/${w.id}`, { coverMediaId: m2.id, expectedUpdatedAt: w.updatedAt });
    list = (await (await call(A, "GET", "/api/works")).json()) as any[];
    expect(list[0].cover.id).toBe(m2.id);
  });

  it("filters the list by search text and tag", async () => {
    await seedTwoSites();
    const one = await newWork();
    const two = await newWork();
    await call(A, "PATCH", `/api/works/${one.id}`, { title: "Blue Hour", tags: ["Oil"], expectedUpdatedAt: one.updatedAt });
    await call(A, "PATCH", `/api/works/${two.id}`, { title: "Red Study", expectedUpdatedAt: two.updatedAt });
    const byText = (await (await call(A, "GET", "/api/works?q=blue")).json()) as any[];
    expect(byText.map((w) => w.title)).toEqual(["Blue Hour"]);
    const byTag = (await (await call(A, "GET", "/api/works?tag=oil")).json()) as any[];
    expect(byTag.map((w) => w.title)).toEqual(["Blue Hour"]);
  });

  it("reorders works", async () => {
    await seedTwoSites();
    const one = await newWork();
    const two = await newWork();
    expect((await call(A, "PUT", "/api/works/order", [one.id, two.id])).status).toBe(204);
    const list = (await (await call(A, "GET", "/api/works")).json()) as any[];
    expect(list.map((w) => w.id)).toEqual([one.id, two.id]);
    expect((await call(A, "PUT", "/api/works/order", ["x"])).status).toBe(400);
  });

  describe("required details", () => {
    it("refuses to show a work on the site until required details are filled in", async () => {
      await seedTwoSites();
      const def = (await (await call(A, "POST", "/api/fields", { label: "Medium", type: "text", required: true })).json()) as any;
      const w = await newWork();
      const blocked = await call(A, "PATCH", `/api/works/${w.id}`, { visible: true, expectedUpdatedAt: w.updatedAt });
      expect(blocked.status).toBe(400);
      expect(await blocked.json()).toEqual({ error: "missing-required", missing: ["Medium"] });
      const ok = await call(A, "PATCH", `/api/works/${w.id}`, { visible: true, fields: { [def.key]: "Oil" }, expectedUpdatedAt: w.updatedAt });
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as any).work.visible).toBe(true);
    });

    it("lets drafts be saved with required details empty", async () => {
      await seedTwoSites();
      await call(A, "POST", "/api/fields", { label: "Medium", type: "text", required: true });
      const w = await newWork();
      const res = await call(A, "PATCH", `/api/works/${w.id}`, { title: "Draft", expectedUpdatedAt: w.updatedAt });
      expect(res.status).toBe(200);
    });
  });
});
