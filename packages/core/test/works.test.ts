import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  createWork, getWork, listWorks, updateWork, softDeleteWork, restoreWork,
  reorderWorks, purgeDeletedWorks,
} from "../src";
import { seedTwoSites } from "./fixtures";

const db = () => env.DB;

async function titled(siteId: number, title: string) {
  const w = await createWork(db(), siteId);
  const r = await updateWork(db(), siteId, w.id, { title, expectedUpdatedAt: w.updatedAt });
  if (r === "conflict" || r === null) throw new Error("setup failed");
  return r;
}

describe("works", () => {
  it("lists the newest work first", async () => {
    const { a } = await seedTwoSites(db());
    const first = await createWork(db(), a);
    const second = await createWork(db(), a);
    expect((await listWorks(db(), a)).map((w) => w.id)).toEqual([second.id, first.id]);
  });

  it("derives the slug from the title and de-duplicates collisions", async () => {
    const { a } = await seedTwoSites(db());
    const one = await titled(a, "Blue Hour");
    const two = await titled(a, "Blue Hour");
    expect(one.slug).toBe("blue-hour");
    expect(two.slug).toBe("blue-hour-2");
  });

  it("keeps a work's URL stable once it has a real title, even one that looks like the placeholder", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const first = (await updateWork(db(), a, w.id, { title: "Untitled #4", expectedUpdatedAt: w.updatedAt })) as any;
    expect(first.slug).toBe("untitled-4");
    const second = (await updateWork(db(), a, w.id, { title: "Untitled #4 (blue)", expectedUpdatedAt: first.updatedAt })) as any;
    expect(second.slug).toBe("untitled-4");
    const third = (await updateWork(db(), a, w.id, { title: "Something else", expectedUpdatedAt: second.updatedAt })) as any;
    expect(third.slug).toBe("untitled-4");
  });

  it("starts with an untitled slug and hidden", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    expect(w.slug).toBe(`untitled-${w.id}`);
    expect(w.visible).toBe(false);
    expect(w.title).toBe("");
  });

  it("returns conflict for a stale expectedUpdatedAt and leaves the row unchanged", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const saved = await updateWork(db(), a, w.id, { title: "First", expectedUpdatedAt: w.updatedAt });
    expect(saved).not.toBe("conflict");
    const stale = await updateWork(db(), a, w.id, { title: "Second", expectedUpdatedAt: w.updatedAt });
    expect(stale).toBe("conflict");
    expect((await getWork(db(), a, w.id))!.title).toBe("First");
  });

  it("changes updatedAt on every save, even within the same millisecond", async () => {
    const { a } = await seedTwoSites(db());
    let w = await createWork(db(), a);
    const seen = new Set([w.updatedAt]);
    for (let i = 0; i < 5; i++) {
      const r = await updateWork(db(), a, w.id, { title: `t${i}`, expectedUpdatedAt: w.updatedAt });
      if (r === "conflict" || r === null) throw new Error("unexpected");
      seen.add(r.updatedAt);
      w = r;
    }
    expect(seen.size).toBe(6);
  });

  it("does not touch another site's work", async () => {
    const { a, b } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    expect(await updateWork(db(), b, w.id, { title: "Hacked", expectedUpdatedAt: w.updatedAt })).toBeNull();
    expect(await getWork(db(), b, w.id)).toBeNull();
    expect(await softDeleteWork(db(), b, w.id)).toBe(false);
  });

  it("merges fields over existing fields", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    const r1 = (await updateWork(db(), a, w.id, { fields: { medium: "oil" }, expectedUpdatedAt: w.updatedAt })) as any;
    const r2 = (await updateWork(db(), a, w.id, { fields: { size: "20cm" }, expectedUpdatedAt: r1.updatedAt })) as any;
    expect(r2.fields).toEqual({ medium: "oil", size: "20cm" });
  });

  it("soft-deletes, hides and restores", async () => {
    const { a } = await seedTwoSites(db());
    const w = await createWork(db(), a);
    expect(await softDeleteWork(db(), a, w.id)).toBe(true);
    expect(await listWorks(db(), a)).toEqual([]);
    expect(await getWork(db(), a, w.id)).toBeNull();
    expect(await restoreWork(db(), a, w.id)).toBe(true);
    expect((await getWork(db(), a, w.id))!.id).toBe(w.id);
  });

  it("searches titles case-insensitively", async () => {
    const { a } = await seedTwoSites(db());
    await titled(a, "Blue Hour");
    await titled(a, "Red Study");
    expect((await listWorks(db(), a, { q: "blue" })).map((w) => w.title)).toEqual(["Blue Hour"]);
  });

  it("treats LIKE wildcards in the search as plain text", async () => {
    const { a } = await seedTwoSites(db());
    await titled(a, "100% Cotton");
    await titled(a, "Other");
    expect((await listWorks(db(), a, { q: "%" })).map((w) => w.title)).toEqual(["100% Cotton"]);
  });

  it("reorders and ignores ids from other sites", async () => {
    const { a, b } = await seedTwoSites(db());
    const x = await createWork(db(), a);
    const y = await createWork(db(), a);
    const foreign = await createWork(db(), b);
    await reorderWorks(db(), a, [x.id, y.id, foreign.id]);
    expect((await listWorks(db(), a)).map((w) => w.id)).toEqual([x.id, y.id]);
    expect((await getWork(db(), b, foreign.id))!.sort).toBe(foreign.sort);
  });

  it("purges works deleted before the cutoff along with their media rows", async () => {
    const { a } = await seedTwoSites(db());
    const old = await createWork(db(), a);
    const recent = await createWork(db(), a);
    await softDeleteWork(db(), a, old.id);
    await softDeleteWork(db(), a, recent.id);
    await db().prepare("UPDATE works SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").bind(old.id).run();
    await db()
      .prepare("INSERT INTO media (site_id, work_id, kind, mime, width, height) VALUES (?, ?, 'image', 'image/jpeg', 10, 10)")
      .bind(a, old.id)
      .run();
    const purged = await purgeDeletedWorks(db(), "2026-06-01T00:00:00.000Z");
    expect(purged).toEqual([old.id]);
    expect((await db().prepare("SELECT count(*) AS n FROM media").first<{ n: number }>())!.n).toBe(0);
    expect(await restoreWork(db(), a, recent.id)).toBe(true);
  });
});
