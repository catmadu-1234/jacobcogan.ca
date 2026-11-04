import type { Tag } from "../types";
import { tagSlug } from "../slug";

interface TagRow { id: number; site_id: number; name: string; slug: string; count?: number }

const rowToTag = (r: TagRow): Tag => {
  const tag: Tag = { id: r.id, siteId: r.site_id, name: r.name, slug: r.slug };
  if (r.count !== undefined) tag.count = r.count;
  return tag;
};

export async function listTags(db: D1Database, siteId: number): Promise<Tag[]> {
  const { results } = await db
    .prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM work_tags wt JOIN works w ON w.id = wt.work_id AND w.deleted_at IS NULL
                    WHERE wt.tag_id = t.id) AS count
       FROM tags t WHERE t.site_id = ? ORDER BY t.name COLLATE NOCASE`,
    )
    .bind(siteId)
    .all<TagRow>();
  return results.map(rowToTag);
}

export async function tagsForWork(db: D1Database, workId: number): Promise<Tag[]> {
  const { results } = await db
    .prepare("SELECT t.* FROM tags t JOIN work_tags wt ON wt.tag_id = t.id WHERE wt.work_id = ? ORDER BY t.name COLLATE NOCASE")
    .bind(workId)
    .all<TagRow>();
  return results.map(rowToTag);
}

/** Replaces a work's tags. Tags are matched by slug, so "Oil" and "oil" are one tag. */
export async function setWorkTags(db: D1Database, siteId: number, workId: number, names: string[]): Promise<Tag[]> {
  const own = await db
    .prepare("SELECT id FROM works WHERE id = ? AND site_id = ? AND deleted_at IS NULL")
    .bind(workId, siteId)
    .first();
  if (!own) return [];
  const bySlug = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name && !bySlug.has(tagSlug(name))) bySlug.set(tagSlug(name), name);
  }
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (site_id, name, slug) VALUES (?, ?, ?)");
  const link = db.prepare("INSERT OR IGNORE INTO work_tags (work_id, tag_id) SELECT ?, id FROM tags WHERE site_id = ? AND slug = ?");
  await db.batch([
    ...[...bySlug].map(([slug, name]) => insertTag.bind(siteId, name, slug)),
    db.prepare("DELETE FROM work_tags WHERE work_id = ?").bind(workId),
    ...[...bySlug.keys()].map((slug) => link.bind(workId, siteId, slug)),
  ]);
  if (bySlug.size === 0) return [];
  const slugs = [...bySlug.keys()];
  const { results } = await db
    .prepare(`SELECT * FROM tags WHERE site_id = ? AND slug IN (${slugs.map(() => "?").join(",")})`)
    .bind(siteId, ...slugs)
    .all<TagRow>();
  const found = new Map(results.map((r) => [r.slug, rowToTag(r)]));
  return slugs.map((s) => found.get(s)!).filter(Boolean);
}

/** Renames a tag; if the new name matches another tag, merges into that one and returns it. */
export async function renameTag(db: D1Database, siteId: number, id: number, name: string): Promise<Tag | null> {
  const cur = await db.prepare("SELECT * FROM tags WHERE id = ? AND site_id = ?").bind(id, siteId).first<TagRow>();
  if (!cur) return null;
  const slug = tagSlug(name);
  const other = await db
    .prepare("SELECT * FROM tags WHERE site_id = ? AND slug = ? AND id != ?")
    .bind(siteId, slug, id)
    .first<TagRow>();
  if (other) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO work_tags (work_id, tag_id) SELECT work_id, ? FROM work_tags WHERE tag_id = ?").bind(other.id, id),
      db.prepare("DELETE FROM work_tags WHERE tag_id = ?").bind(id),
      db.prepare("DELETE FROM tags WHERE id = ? AND site_id = ?").bind(id, siteId),
    ]);
    return rowToTag(other);
  }
  await db.prepare("UPDATE tags SET name = ?, slug = ? WHERE id = ? AND site_id = ?").bind(name.trim(), slug, id, siteId).run();
  const updated = await db.prepare("SELECT * FROM tags WHERE id = ?").bind(id).first<TagRow>();
  return rowToTag(updated!);
}

export async function deleteTag(db: D1Database, siteId: number, id: number): Promise<boolean> {
  const [, del] = await db.batch([
    db.prepare("DELETE FROM work_tags WHERE tag_id = ? AND tag_id IN (SELECT id FROM tags WHERE site_id = ?)").bind(id, siteId),
    db.prepare("DELETE FROM tags WHERE id = ? AND site_id = ?").bind(id, siteId),
  ]);
  return (del!.meta.changes ?? 0) > 0;
}
