import type { Work } from "../types";
import type { WorkPatch } from "../validate";
import { slugify } from "../slug";

interface WorkRow {
  id: number; site_id: number; slug: string; title: string; visible: number; sort: number;
  fields_json: string; cover_media_id: number | null; created_at: string; updated_at: string;
  deleted_at: string | null; kind: Work["kind"]; body: string;
}

const rowToWork = (r: WorkRow): Work => ({
  id: r.id, siteId: r.site_id, slug: r.slug, title: r.title, visible: !!r.visible, sort: r.sort,
  fields: JSON.parse(r.fields_json), coverMediaId: r.cover_media_id,
  createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, kind: r.kind, body: r.body,
});


export async function listWorks(
  db: D1Database,
  siteId: number,
  opts: { q?: string; kind?: Work["kind"] } = {},
): Promise<Work[]> {
  const binds: unknown[] = [];
  const kind = opts.kind ?? "work";
  binds.push(siteId, kind);
  let where = "w.site_id = ? AND w.kind = ? AND w.deleted_at IS NULL";
  if (opts.q) {
    // instr, not LIKE: D1 rejects LIKE patterns longer than about 50 bytes.
    where += " AND instr(lower(w.title), lower(?)) > 0";
    binds.push(opts.q);
  }
  const { results } = await db
    .prepare(`SELECT w.* FROM works w WHERE ${where} ORDER BY ${kind === "post" ? "w.created_at DESC" : "w.sort ASC"}, w.id DESC`)
    .bind(...binds)
    .all<WorkRow>();
  return results.map(rowToWork);
}

export async function getWork(db: D1Database, siteId: number, id: number): Promise<Work | null> {
  const row = await db
    .prepare("SELECT * FROM works WHERE id = ? AND site_id = ? AND deleted_at IS NULL")
    .bind(id, siteId)
    .first<WorkRow>();
  return row ? rowToWork(row) : null;
}

export async function createWork(db: D1Database, siteId: number, kind: Work["kind"] = "work"): Promise<Work> {
  const res = await db
    .prepare(
      "INSERT INTO works (site_id, slug, kind, sort) VALUES (?, ?, ?, (SELECT COALESCE(MIN(sort), 0) - 1 FROM works WHERE site_id = ?))",
    )
    .bind(siteId, `pending-${crypto.randomUUID()}`, kind, siteId)
    .run();
  const id = res.meta.last_row_id as number;
  await db.prepare("UPDATE works SET slug = ? WHERE id = ?").bind(`untitled-${id}`, id).run();
  return (await getWork(db, siteId, id))!;
}

async function uniqueSlug(db: D1Database, siteId: number, base: string, excludeId: number): Promise<string> {
  const { results } = await db
    // Slugs only hold a-z, 0-9 and "-", so everything starting with "base-" sorts between "base-" and "base.".
    // A range instead of LIKE: D1 rejects LIKE patterns longer than about 50 bytes, and a slug can be 80.
    .prepare("SELECT slug FROM works WHERE site_id = ? AND id != ? AND (slug = ? OR (slug >= ? AND slug < ?))")
    .bind(siteId, excludeId, base, `${base}-`, `${base}.`)
    .all<{ slug: string }>();
  const taken = new Set(results.map((r) => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function nextUpdatedAt(previous: string): string {
  const now = new Date().toISOString();
  return now > previous ? now : new Date(Date.parse(previous) + 1).toISOString();
}

export async function updateWork(
  db: D1Database,
  siteId: number,
  id: number,
  patch: WorkPatch,
): Promise<Work | "conflict" | null> {
  const cur = await getWork(db, siteId, id);
  if (!cur) return null;
  if (cur.updatedAt !== patch.expectedUpdatedAt) return "conflict";

  const title = patch.title ?? cur.title;
  let slug = cur.slug;
  if (patch.slug) {
    slug = await uniqueSlug(db, siteId, patch.slug, id);
  } else if (patch.title !== undefined && patch.title !== cur.title && cur.slug === `untitled-${cur.id}`) {
    const base = slugify(patch.title);
    if (base) slug = await uniqueSlug(db, siteId, base, id);
  }
  const updatedAt = nextUpdatedAt(cur.updatedAt);
  const res = await db
    .prepare(
      `UPDATE works SET title = ?, slug = ?, visible = ?, fields_json = ?, cover_media_id = ?, body = ?, updated_at = ?
       WHERE id = ? AND site_id = ? AND deleted_at IS NULL AND updated_at = ?`,
    )
    .bind(
      title,
      slug,
      (patch.visible ?? cur.visible) ? 1 : 0,
      JSON.stringify({ ...cur.fields, ...(patch.fields ?? {}) }),
      patch.coverMediaId === undefined ? cur.coverMediaId : patch.coverMediaId,
      patch.body ?? cur.body,
      updatedAt,
      id,
      siteId,
      patch.expectedUpdatedAt,
    )
    .run();
  if (res.meta.changes === 0) return "conflict";
  return (await getWork(db, siteId, id))!;
}

export async function softDeleteWork(db: D1Database, siteId: number, id: number): Promise<boolean> {
  const res = await db
    .prepare("UPDATE works SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND site_id = ? AND deleted_at IS NULL")
    .bind(id, siteId)
    .run();
  return res.meta.changes > 0;
}

export async function restoreWork(db: D1Database, siteId: number, id: number): Promise<boolean> {
  const res = await db
    .prepare("UPDATE works SET deleted_at = NULL WHERE id = ? AND site_id = ? AND deleted_at IS NOT NULL")
    .bind(id, siteId)
    .run();
  return res.meta.changes > 0;
}

export async function reorderWorks(db: D1Database, siteId: number, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const stmt = db.prepare("UPDATE works SET sort = ? WHERE id = ? AND site_id = ? AND deleted_at IS NULL");
  await db.batch(ids.map((id, i) => stmt.bind(i, id, siteId)));
}

export async function purgeDeletedWorks(db: D1Database, olderThanIso: string): Promise<number[]> {
  const { results } = await db
    .prepare("SELECT id FROM works WHERE deleted_at IS NOT NULL AND deleted_at < ?")
    .bind(olderThanIso)
    .all<{ id: number }>();
  const ids = results.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const marks = chunk.map(() => "?").join(",");
    await db.batch([
      db.prepare(`DELETE FROM media WHERE work_id IN (${marks})`).bind(...chunk),
      db.prepare(`DELETE FROM work_facet_values WHERE work_id IN (${marks})`).bind(...chunk),
      db.prepare(`DELETE FROM work_tags WHERE work_id IN (${marks})`).bind(...chunk),
      db.prepare(`DELETE FROM works WHERE id IN (${marks})`).bind(...chunk),
    ]);
  }
  return ids;
}
