import { DEFAULT_THEME, type Site } from "../types";
import type { SitePatch } from "../validate";

interface SiteRow {
  id: number; slug: string; name: string; hostname: string | null; theme_json: string;
  about: string; links_json: string; content_version: number;
}

function rowToSite(r: SiteRow): Site {
  return {
    id: r.id, slug: r.slug, name: r.name, hostname: r.hostname,
    theme: { ...DEFAULT_THEME, ...JSON.parse(r.theme_json) },
    about: r.about, links: JSON.parse(r.links_json), contentVersion: r.content_version,
  };
}

async function one(stmt: D1PreparedStatement): Promise<Site | null> {
  const row = await stmt.first<SiteRow>();
  return row ? rowToSite(row) : null;
}

export function getSiteById(db: D1Database, id: number): Promise<Site | null> {
  return one(db.prepare("SELECT * FROM sites WHERE id = ?").bind(id));
}
export function getSiteBySlug(db: D1Database, slug: string): Promise<Site | null> {
  return one(db.prepare("SELECT * FROM sites WHERE slug = ?").bind(slug));
}
export function getSiteByHostname(db: D1Database, host: string): Promise<Site | null> {
  return one(db.prepare("SELECT * FROM sites WHERE hostname = ?").bind(host.toLowerCase()));
}

export async function getUserSiteId(db: D1Database, email: string): Promise<number | null> {
  const row = await db.prepare("SELECT site_id FROM users WHERE email = ?").bind(email).first<{ site_id: number }>();
  return row ? row.site_id : null;
}

export async function updateSite(db: D1Database, siteId: number, patch: SitePatch): Promise<Site> {
  const current = await getSiteById(db, siteId);
  if (!current) throw new Error(`site ${siteId} not found`);
  const theme = { ...current.theme, ...(patch.theme ?? {}) };
  await db
    .prepare("UPDATE sites SET name = ?, about = ?, links_json = ?, theme_json = ? WHERE id = ?")
    .bind(
      patch.name ?? current.name,
      patch.about ?? current.about,
      JSON.stringify(patch.links ?? current.links),
      JSON.stringify(theme),
      siteId,
    )
    .run();
  return (await getSiteById(db, siteId))!;
}

export async function bumpContentVersion(db: D1Database, siteId: number): Promise<void> {
  await db.prepare("UPDATE sites SET content_version = content_version + 1 WHERE id = ?").bind(siteId).run();
}

export async function storageBytes(db: D1Database, siteId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(bytes), 0) AS n FROM media WHERE site_id = ?")
    .bind(siteId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
