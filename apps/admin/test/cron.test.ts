import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { runCleanup } from "../src/worker/cron";
import { bytesOf, call, newMedia, putBlob, seedTwoSites } from "./helpers";

const A = "a@test.dev";
const NOW = new Date("2026-11-03T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const keys = async () => (await env.MEDIA.list()).objects.map((o) => o.key).sort();

async function uploaded(opts: { ready?: boolean } = {}) {
  const made = await newMedia(A);
  await putBlob(A, `/api/media/${made.media.id}/blob/original`, bytesOf("o"));
  await putBlob(A, `/api/media/${made.media.id}/blob/w480`, bytesOf("w"));
  if (opts.ready) await call(A, "PATCH", `/api/media/${made.media.id}`, { status: "ready" });
  return made;
}

const setMediaCreated = (id: number, iso: string) =>
  env.DB.prepare("UPDATE media SET created_at = ? WHERE id = ?").bind(iso, id).run();

describe("nightly cleanup", () => {
  it("removes uploads stuck pending for over 24 hours, files and row", async () => {
    const { a } = await seedTwoSites();
    const stale = await uploaded();
    await setMediaCreated(stale.media.id, hoursAgo(25));
    const result = await runCleanup(env, NOW);
    expect(result.orphans).toBe(1);
    expect(await keys()).toEqual([]);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM media WHERE site_id = ?").bind(a).first("n")).toBe(0);
  });

  it("keeps recent pending uploads and ready media", async () => {
    await seedTwoSites();
    const fresh = await uploaded();
    await setMediaCreated(fresh.media.id, hoursAgo(1));
    const ready = await uploaded({ ready: true });
    await setMediaCreated(ready.media.id, hoursAgo(500));
    const result = await runCleanup(env, NOW);
    expect(result).toEqual({ orphans: 0, purged: 0 });
    expect(await keys()).toHaveLength(4);
  });

  it("keeps the media of a work deleted 10 days ago, so Undo still works", async () => {
    await seedTwoSites();
    const made = await uploaded({ ready: true });
    await call(A, "DELETE", `/api/works/${made.work.id}`);
    await env.DB.prepare("UPDATE works SET deleted_at = ? WHERE id = ?").bind(hoursAgo(24 * 10), made.work.id).run();
    expect(await runCleanup(env, NOW)).toEqual({ orphans: 0, purged: 0 });
    expect(await keys()).toHaveLength(2);
    expect((await call(A, "POST", `/api/works/${made.work.id}/restore`)).status).toBe(204);
  });

  it("purges works deleted over 30 days ago together with their stored files", async () => {
    await seedTwoSites();
    const gone = await uploaded({ ready: true });
    const kept = await uploaded({ ready: true });
    await call(A, "DELETE", `/api/works/${gone.work.id}`);
    await env.DB.prepare("UPDATE works SET deleted_at = ? WHERE id = ?").bind(hoursAgo(24 * 31), gone.work.id).run();
    const result = await runCleanup(env, NOW);
    expect(result.purged).toBe(1);
    expect(await keys()).toEqual([`${kept.media.siteId}/${kept.media.id}/original`, `${kept.media.siteId}/${kept.media.id}/w480`]);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM works WHERE id = ?").bind(gone.work.id).first("n")).toBe(0);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM media WHERE id = ?").bind(gone.media.id).first("n")).toBe(0);
  });

  it("does nothing when there is nothing to clean", async () => {
    await seedTwoSites();
    expect(await runCleanup(env, NOW)).toEqual({ orphans: 0, purged: 0 });
  });
});
