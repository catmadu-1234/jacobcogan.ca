import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  createMedia, getMedia, listMediaForWork, updateMedia, reorderMedia, deleteMedia,
  mediaKeys, findOrphans, createWork, updateWork, softDeleteWork, getWork, listReadyMediaForSite,
  markMediaReady, findMediaOfDeletedWorks, getPublicMediaFile,
} from "../src";
import { seedTwoSites, addWork } from "./fixtures";

const db = () => env.DB;
const input = { kind: "image" as const, mime: "image/webp" as const, width: 100, height: 50, bytes: 10, variants: ["original" as const, "w480" as const] };

describe("media", () => {
  it("creates pending media with increasing sort", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const m1 = (await createMedia(db(), a, w.id, input))!;
    const m2 = (await createMedia(db(), a, w.id, input))!;
    expect(m1.status).toBe("pending");
    expect(m1.variants).toEqual(["original", "w480"]);
    expect(m2.sort).toBeGreaterThan(m1.sort);
  });

  it("refuses media for another site's work", async () => {
    const { a, b } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    expect(await createMedia(db(), b, w.id, input)).toBeNull();
  });

  it("does not leak media across sites on get/update/delete", async () => {
    const { a, b } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const m = (await createMedia(db(), a, w.id, input))!;
    expect(await getMedia(db(), b, m.id)).toBeNull();
    expect(await updateMedia(db(), b, m.id, { alt: "x" })).toBeNull();
    expect(await deleteMedia(db(), b, m.id)).toBeNull();
  });

  it("updates alt and status and lists ready-only on request", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const m1 = (await createMedia(db(), a, w.id, input))!;
    await createMedia(db(), a, w.id, input);
    const updated = (await updateMedia(db(), a, m1.id, { alt: "A sunrise", status: "ready" }))!;
    expect(updated.alt).toBe("A sunrise");
    expect(updated.status).toBe("ready");
    expect(await listMediaForWork(db(), a, w.id)).toHaveLength(2);
    expect((await listMediaForWork(db(), a, w.id, { readyOnly: true })).map((m) => m.id)).toEqual([m1.id]);
  });

  it("reorders media within a work", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const m1 = (await createMedia(db(), a, w.id, input))!;
    const m2 = (await createMedia(db(), a, w.id, input))!;
    await reorderMedia(db(), a, w.id, [m2.id, m1.id]);
    expect((await listMediaForWork(db(), a, w.id)).map((m) => m.id)).toEqual([m2.id, m1.id]);
  });

  it("builds R2 keys for every variant", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const m = (await createMedia(db(), a, w.id, input))!;
    expect(mediaKeys(m)).toEqual([`${a}/${m.id}/original`, `${a}/${m.id}/w480`]);
  });

  it("deletes media, returns its keys and clears the cover", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const m = (await createMedia(db(), a, w.id, input))!;
    await updateWork(db(), a, w.id, { coverMediaId: m.id, expectedUpdatedAt: w.updatedAt });
    expect(await deleteMedia(db(), a, m.id)).toEqual([`${a}/${m.id}/original`, `${a}/${m.id}/w480`]);
    expect(await getMedia(db(), a, m.id)).toBeNull();
    expect((await getWork(db(), a, w.id))!.coverMediaId).toBeNull();
  });

  describe("findOrphans", () => {
    it("returns stale pending media but not ready media on a live work", async () => {
      const { a } = await seedTwoSites(db());
      const { media: [ready] } = await addWork(db(), a, { title: "Live" });
      const { media: [stale] } = await addWork(db(), a, { title: "Stale", media: [{ ready: false }] });
      const { media: [fresh] } = await addWork(db(), a, { title: "Fresh", media: [{ ready: false }] });
      await db().prepare("UPDATE media SET created_at = '2026-01-01T00:00:00.000Z' WHERE id IN (?, ?)").bind(stale!.id, ready!.id).run();
      const ids = (await findOrphans(db(), "2026-06-01T00:00:00.000Z")).map((m) => m.id);
      expect(ids).toEqual([stale!.id]);
      expect(ids).not.toContain(fresh!.id);
    });

    it("keeps ready media of a soft-deleted work so the delete can be undone", async () => {
      const { a } = await seedTwoSites(db());
      const { work, media: [m] } = await addWork(db(), a, { title: "Deleted" });
      await softDeleteWork(db(), a, work.id);
      await db().prepare("UPDATE media SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").bind(m!.id).run();
      expect(await findOrphans(db(), "2026-06-01T00:00:00.000Z")).toEqual([]);
    });
  });

  it("lists ready media of live works for one site, in work then sort order", async () => {
    const { a, b } = await seedTwoSites(db());
    const one = await addWork(db(), a, { title: "One", media: [{}, { ready: false }, {}] });
    const gone = await addWork(db(), a, { title: "Gone" });
    await softDeleteWork(db(), a, gone.work.id);
    await addWork(db(), b, { title: "Other site" });
    const ids = (await listReadyMediaForSite(db(), a)).map((m) => m.id);
    expect(ids).toEqual([one.media[0]!.id, one.media[2]!.id]);
  });

  it("marks media ready and records the real stored size", async () => {
    const { a, b } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const m = (await createMedia(db(), a, w.id, input))!;
    expect(await markMediaReady(db(), b, m.id, 999)).toBeNull();
    const ready = (await markMediaReady(db(), a, m.id, 4321))!;
    expect(ready).toMatchObject({ status: "ready", bytes: 4321 });
  });

  it("finds media of works soft-deleted before the cutoff only", async () => {
    const { a } = await seedTwoSites(db());
    const old = await addWork(db(), a, { title: "Old" });
    const recent = await addWork(db(), a, { title: "Recent" });
    await addWork(db(), a, { title: "Live" });
    await softDeleteWork(db(), a, old.work.id);
    await softDeleteWork(db(), a, recent.work.id);
    await db().prepare("UPDATE works SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").bind(old.work.id).run();
    const found = await findMediaOfDeletedWorks(db(), "2026-06-01T00:00:00.000Z");
    expect(found.map((m) => m.id)).toEqual([old.media[0]!.id]);
  });

  describe("getPublicMediaFile", () => {
    it("returns ready media of a visible work", async () => {
      const { a } = await seedTwoSites(db());
      const { media: [m] } = await addWork(db(), a, { title: "Shown" });
      expect((await getPublicMediaFile(db(), a, m!.id))!.id).toBe(m!.id);
    });
    it("hides media of hidden, deleted and other sites' works, and media still pending", async () => {
      const { a, b } = await seedTwoSites(db());
      const hidden = await addWork(db(), a, { title: "Hidden", visible: false });
      const deleted = await addWork(db(), a, { title: "Deleted" });
      await softDeleteWork(db(), a, deleted.work.id);
      const pending = await addWork(db(), a, { title: "Pending", media: [{ ready: false }] });
      const shown = await addWork(db(), a, { title: "Shown" });
      expect(await getPublicMediaFile(db(), a, hidden.media[0]!.id)).toBeNull();
      expect(await getPublicMediaFile(db(), a, deleted.media[0]!.id)).toBeNull();
      expect(await getPublicMediaFile(db(), a, pending.media[0]!.id)).toBeNull();
      expect(await getPublicMediaFile(db(), b, shown.media[0]!.id)).toBeNull();
    });
  });
});
