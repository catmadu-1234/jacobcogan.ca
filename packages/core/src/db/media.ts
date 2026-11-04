import type { Media, MediaVariant } from "../types";
import type { MediaCreate, MediaPatch } from "../validate";

interface MediaRow {
  id: number; site_id: number; work_id: number | null; kind: Media["kind"]; status: Media["status"];
  mime: string; width: number; height: number; duration: number | null; color: string | null;
  alt: string; variants_json: string; bytes: number; sort: number; created_at: string;
}

export const rowToMedia = (r: MediaRow): Media => ({
  id: r.id, siteId: r.site_id, workId: r.work_id, kind: r.kind, status: r.status, mime: r.mime,
  width: r.width, height: r.height, duration: r.duration, color: r.color, alt: r.alt,
  variants: JSON.parse(r.variants_json) as MediaVariant[], bytes: r.bytes, sort: r.sort, createdAt: r.created_at,
});

export function mediaKeys(m: Pick<Media, "siteId" | "id" | "variants">): string[] {
  return m.variants.map((v) => `${m.siteId}/${m.id}/${v}`);
}

export async function getMedia(db: D1Database, siteId: number, id: number): Promise<Media | null> {
  const row = await db.prepare("SELECT * FROM media WHERE id = ? AND site_id = ?").bind(id, siteId).first<MediaRow>();
  return row ? rowToMedia(row) : null;
}

export async function createMedia(
  db: D1Database,
  siteId: number,
  workId: number,
  input: MediaCreate,
): Promise<Media | null> {
  const work = await db
    .prepare("SELECT id FROM works WHERE id = ? AND site_id = ? AND deleted_at IS NULL")
    .bind(workId, siteId)
    .first();
  if (!work) return null;
  const res = await db
    .prepare(
      `INSERT INTO media (site_id, work_id, kind, mime, width, height, duration, color, variants_json, bytes, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM media WHERE work_id = ?))`,
    )
    .bind(
      siteId, workId, input.kind, input.mime, input.width, input.height, input.duration ?? null,
      input.color ?? null, JSON.stringify(input.variants), input.bytes, workId,
    )
    .run();
  return getMedia(db, siteId, res.meta.last_row_id as number);
}

export async function listMediaForWork(
  db: D1Database,
  siteId: number,
  workId: number,
  opts: { readyOnly?: boolean } = {},
): Promise<Media[]> {
  const sql = `SELECT * FROM media WHERE site_id = ? AND work_id = ?${opts.readyOnly ? " AND status = 'ready'" : ""} ORDER BY sort, id`;
  const { results } = await db.prepare(sql).bind(siteId, workId).all<MediaRow>();
  return results.map(rowToMedia);
}

export async function updateMedia(db: D1Database, siteId: number, id: number, patch: MediaPatch): Promise<Media | null> {
  const cur = await getMedia(db, siteId, id);
  if (!cur) return null;
  await db
    .prepare("UPDATE media SET alt = ?, status = ? WHERE id = ? AND site_id = ?")
    .bind(patch.alt ?? cur.alt, patch.status ?? cur.status, id, siteId)
    .run();
  return getMedia(db, siteId, id);
}

export async function reorderMedia(db: D1Database, siteId: number, workId: number, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const stmt = db.prepare("UPDATE media SET sort = ? WHERE id = ? AND site_id = ? AND work_id = ?");
  await db.batch(ids.map((id, i) => stmt.bind(i + 1, id, siteId, workId)));
}

/** Deletes the row and returns the R2 keys the caller must delete; clears any cover pointing at it. */
export async function deleteMedia(db: D1Database, siteId: number, id: number): Promise<string[] | null> {
  const cur = await getMedia(db, siteId, id);
  if (!cur) return null;
  await db.batch([
    db.prepare("UPDATE works SET cover_media_id = NULL WHERE cover_media_id = ? AND site_id = ?").bind(id, siteId),
    db.prepare("DELETE FROM media WHERE id = ? AND site_id = ?").bind(id, siteId),
  ]);
  return mediaKeys(cur);
}

/**
 * Media nobody can reach: uploads stuck in `pending` past the cutoff, or detached from any work.
 * Media of a soft-deleted work is deliberately kept so "Undo" keeps working until the work is purged.
 */
export async function findOrphans(db: D1Database, olderThanIso: string): Promise<Media[]> {
  const { results } = await db
    .prepare(
      `SELECT m.* FROM media m LEFT JOIN works w ON w.id = m.work_id
       WHERE m.created_at < ? AND (m.status = 'pending' OR m.work_id IS NULL OR w.id IS NULL)
       ORDER BY m.id`,
    )
    .bind(olderThanIso)
    .all<MediaRow>();
  return results.map(rowToMedia);
}

/** All ready media of a site's live works in one query, for building cover thumbnails without N+1 lookups. */
export async function listReadyMediaForSite(db: D1Database, siteId: number): Promise<Media[]> {
  const { results } = await db
    .prepare(
      `SELECT m.* FROM media m JOIN works w ON w.id = m.work_id
       WHERE m.site_id = ? AND m.status = 'ready' AND w.deleted_at IS NULL
       ORDER BY m.work_id, m.sort, m.id`,
    )
    .bind(siteId)
    .all<MediaRow>();
  return results.map(rowToMedia);
}

/** Marks an upload complete and records the size actually stored in R2 (not the client's claim). */
export async function markMediaReady(db: D1Database, siteId: number, id: number, bytes: number): Promise<Media | null> {
  const res = await db
    .prepare("UPDATE media SET status = 'ready', bytes = ? WHERE id = ? AND site_id = ?")
    .bind(bytes, id, siteId)
    .run();
  return res.meta.changes > 0 ? getMedia(db, siteId, id) : null;
}

/** Media of works soft-deleted before the cutoff: the cron must delete their R2 objects before purging the works. */
export async function findMediaOfDeletedWorks(db: D1Database, olderThanIso: string): Promise<Media[]> {
  const { results } = await db
    .prepare(
      `SELECT m.* FROM media m JOIN works w ON w.id = m.work_id
       WHERE w.deleted_at IS NOT NULL AND w.deleted_at < ? ORDER BY m.id`,
    )
    .bind(olderThanIso)
    .all<MediaRow>();
  return results.map(rowToMedia);
}

/** A media row only if the public site may serve it: ready, on a visible work that is not deleted. */
export async function getPublicMediaFile(db: D1Database, siteId: number, id: number): Promise<Media | null> {
  const row = await db
    .prepare(
      `SELECT m.* FROM media m JOIN works w ON w.id = m.work_id
       WHERE m.id = ? AND m.site_id = ? AND m.status = 'ready' AND w.visible = 1 AND w.deleted_at IS NULL`,
    )
    .bind(id, siteId)
    .first<MediaRow>();
  return row ? rowToMedia(row) : null;
}
