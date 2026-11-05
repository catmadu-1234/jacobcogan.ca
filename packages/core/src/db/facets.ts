import { FACETS, type Facet, type FacetValue } from "../types";
import { tagSlug } from "../slug";

interface FacetRow { id: number; site_id: number; facet: Facet; name: string; slug: string; count?: number }

export type FacetMap = Record<Facet, FacetValue[]>;
export const emptyFacets = (): FacetMap => ({ medium: [], project: [], content: [], exhibition: [] });

const rowToValue = (r: FacetRow): FacetValue => {
  const v: FacetValue = { id: r.id, siteId: r.site_id, facet: r.facet, name: r.name, slug: r.slug };
  if (r.count !== undefined) v.count = r.count;
  return v;
};

function group(rows: FacetRow[]): FacetMap {
  const map = emptyFacets();
  for (const r of rows) map[r.facet].push(rowToValue(r));
  return map;
}

/** Every value a site's works carry, per facet, for suggestions. A value nobody carries any more is left out. */
export async function listFacetValues(db: D1Database, siteId: number): Promise<FacetMap> {
  const { results } = await db
    .prepare(
      `SELECT fv.*, COUNT(w.id) AS count FROM facet_values fv
       JOIN work_facet_values l ON l.value_id = fv.id
       JOIN works w ON w.id = l.work_id AND w.deleted_at IS NULL
       WHERE fv.site_id = ? GROUP BY fv.id ORDER BY fv.name COLLATE NOCASE`,
    )
    .bind(siteId)
    .all<FacetRow>();
  return group(results);
}

export async function facetsForWork(db: D1Database, workId: number): Promise<FacetMap> {
  const { results } = await db
    .prepare(
      `SELECT fv.* FROM facet_values fv JOIN work_facet_values l ON l.value_id = fv.id
       WHERE l.work_id = ? ORDER BY fv.name COLLATE NOCASE`,
    )
    .bind(workId)
    .all<FacetRow>();
  return group(results);
}

/**
 * Replaces the values a work has for each facet named in `input` (facets left out are untouched). Values are
 * matched by slug within their own facet, so "Oil" and "oil" are one Medium but "Dogs" under Content and "dogs" under
 * Medium are different values. New values join the site's vocabulary; values no work carries any more are removed.
 */
export async function setWorkFacets(
  db: D1Database,
  siteId: number,
  workId: number,
  input: Partial<Record<Facet, string[]>>,
): Promise<FacetMap> {
  const own = await db
    .prepare("SELECT id FROM works WHERE id = ? AND site_id = ? AND deleted_at IS NULL")
    .bind(workId, siteId)
    .first();
  if (!own) return emptyFacets();

  const insert = db.prepare("INSERT OR IGNORE INTO facet_values (site_id, facet, name, slug) VALUES (?, ?, ?, ?)");
  const clear = db.prepare(
    "DELETE FROM work_facet_values WHERE work_id = ? AND value_id IN (SELECT id FROM facet_values WHERE site_id = ? AND facet = ?)",
  );
  const link = db.prepare(
    "INSERT OR IGNORE INTO work_facet_values (work_id, value_id) SELECT ?, id FROM facet_values WHERE site_id = ? AND facet = ? AND slug = ?",
  );
  const statements: D1PreparedStatement[] = [];
  for (const facet of FACETS) {
    const names = input[facet];
    if (!names) continue;
    const bySlug = new Map<string, string>();
    for (const raw of names) {
      const name = raw.trim();
      if (name && !bySlug.has(tagSlug(name))) bySlug.set(tagSlug(name), name);
    }
    for (const [slug, name] of bySlug) statements.push(insert.bind(siteId, facet, name, slug));
    statements.push(clear.bind(workId, siteId, facet));
    for (const slug of bySlug.keys()) statements.push(link.bind(workId, siteId, facet, slug));
  }
  statements.push(
    db.prepare("DELETE FROM facet_values WHERE site_id = ? AND id NOT IN (SELECT value_id FROM work_facet_values)").bind(siteId),
  );
  await db.batch(statements);
  return facetsForWork(db, workId);
}
